<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\Room;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Pendaftaran aset BMN.
 *
 * Tugas utamanya menjaga agar pemberian NUP dan penyimpanan aset terjadi dalam
 * satu transaksi. Bila penyimpanan gagal, nomor yang sudah diklaim ikut
 * dibatalkan sehingga tidak ada NUP yang bolong.
 */
class AssetService
{
    /** SQLSTATE PostgreSQL untuk pelanggaran indeks unik. */
    private const SQLSTATE_UNIQUE_VIOLATION = '23505';

    /** SQLSTATE PostgreSQL untuk pelanggaran CHECK — dipakai pemicu identitas BMN. */
    private const SQLSTATE_CHECK_VIOLATION = '23514';

    public function __construct(
        private readonly NupAllocator $nup,
        private readonly KodeInternalGenerator $kodeInternal,
        private readonly AssetMutationRecorder $riwayat,
    ) {}

    /**
     * Daftarkan aset baru.
     *
     * NUP dan kode internal dibentuk di sini, bukan diterima dari pemanggil,
     * supaya tidak ada jalur yang bisa menyisipkan nomor karangan.
     *
     * @param  array<string,mixed>  $data
     *
     * @throws ValidationException bila identitas BMN atau kode internal kembar
     */
    public function daftarkan(array $data, string $kodeLokasi, ?string $polaInternal = null): Asset
    {
        $kodeBarang = (string) $data['kode_barang'];
        $master = BmnKodeBarang::where('kode', $kodeBarang)->firstOrFail();

        try {
            return DB::transaction(function () use ($data, $kodeLokasi, $kodeBarang, $master, $polaInternal) {
                $nup = $this->nup->berikutnya($kodeLokasi, $kodeBarang);

                $data['kode_lokasi'] = $kodeLokasi;
                $data['nup'] = $nup;

                // Masa manfaat dan KIB mengikuti master kode barang bila tidak
                // ditentukan, agar penyusutan tidak bergantung pada ketelitian
                // pengisian per barang.
                $data['masa_manfaat'] ??= $master->masa_manfaat;
                $data['kib'] ??= $master->kib;

                $data['kode_internal'] = $this->kodeInternal->pastikanUnik(
                    $data['kode_internal'] ?? $this->kodeInternal->buat(
                        $polaInternal ?? config('bmn.pola_internal'),
                        $this->tokenDari($data, $master, $nup),
                    )
                );

                // `bmn_id` dibentuk basis data, sehingga instance hasil create()
                // belum memuatnya — tanpa refresh, identitas BMN terbaca null
                // pada tanggapan API.
                return Asset::create($data)->refresh();
            });
        } catch (QueryException $e) {
            throw $this->terjemahkanKembar($e);
        }
    }

    /**
     * Ubah data aset.
     *
     * Identitas BMN sengaja tidak dapat diubah dari sini — bukan karena
     * diabaikan, tetapi karena pemicu basis data menolaknya. Lihat migrasi
     * `kunci_identitas_bmn_pada_assets`.
     *
     * @param  array<string,mixed>  $data
     *
     * @throws ValidationException bila kode internal kembar atau identitas BMN diubah
     */
    public function ubah(Asset $asset, array $data, ?User $pelaku = null, ?string $catatan = null): Asset
    {
        // Direkam sebelum diubah; setelah `update()` nilai lamanya sudah hilang.
        $sebelum = $asset->only(['room_id', 'kondisi', 'penanggung_jawab_id', 'status_penggunaan']);

        try {
            return DB::transaction(function () use ($asset, $data, $sebelum, $pelaku, $catatan) {
                $asset->update($data);
                $asset->refresh();

                $this->riwayat->catat($asset, $sebelum, $pelaku, $catatan);

                return $asset;
            });
        } catch (QueryException $e) {
            throw $this->terjemahkanKembar($e);
        }
    }

    /**
     * Pindahkan aset ke ruangan lain.
     *
     * Dipisahkan dari `ubah()` karena perpindahan barang adalah tindakan
     * tersendiri dalam penatausahaan BMN — perlu alasan, dan lazimnya
     * dilakukan orang yang berbeda dari yang menyunting data teknis alat.
     *
     * @throws ValidationException bila ruangan tujuan sama dengan asal
     */
    public function mutasi(Asset $asset, ?int $roomTujuan, ?User $pelaku = null, ?string $catatan = null): Asset
    {
        if ((string) $asset->room_id === (string) $roomTujuan) {
            throw ValidationException::withMessages([
                'room_id' => 'Aset sudah berada di ruangan tersebut.',
            ]);
        }

        return $this->ubah($asset, ['room_id' => $roomTujuan], $pelaku, $catatan);
    }

    /**
     * Hapus aset (hapus lunak).
     *
     * Sengaja hapus lunak, bukan hapus permanen: NUP yang sudah diberikan tidak
     * boleh dipakai ulang oleh barang lain, karena nomor itu sudah beredar pada
     * label dan dokumen. Baris yang tertinggal itulah yang menahannya —
     * indeks unik identitas BMN tetap melihatnya.
     */
    public function hapus(Asset $asset, ?User $pelaku = null, ?string $alasan = null): void
    {
        DB::transaction(function () use ($asset, $pelaku, $alasan) {
            if ($alasan !== null && $asset->status_penggunaan !== 'Dihapuskan') {
                $sebelum = $asset->only(['room_id', 'kondisi', 'penanggung_jawab_id', 'status_penggunaan']);
                $asset->status_penggunaan = 'Dihapuskan';
                $asset->save();

                $this->riwayat->catat($asset, $sebelum, $pelaku, $alasan);
            }

            $asset->delete();
        });
    }

    /**
     * @param  array<string,mixed>  $data
     * @return array<string,string|int|null>
     */
    private function tokenDari(array $data, BmnKodeBarang $master, int $nup): array
    {
        $tgl = isset($data['tgl_perolehan']) ? Carbon::parse($data['tgl_perolehan']) : now();

        $room = isset($data['room_id'])
            ? Room::find($data['room_id'])
            : null;

        return [
            'SATKER' => config('bmn.singkatan_satker'),
            'LAB' => $room?->kode ?? '',
            'GEDUNG' => $room?->gedung ?? '',
            'KATEGORI' => strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $master->uraian) ?? '', 0, 4)),
            'TAHUN' => $tgl->year,
            'BULAN' => $tgl->month,
            'NUP' => $nup,
        ];
    }

    /**
     * Ubah pelanggaran indeks unik menjadi pesan yang dapat ditindaklanjuti
     * pengguna; galat lain diteruskan apa adanya agar tidak tersamarkan.
     */
    private function terjemahkanKembar(QueryException $e): \Throwable
    {
        // Pemicu identitas BMN melempar CHECK violation. Diterjemahkan agar
        // pengguna membaca aturannya, bukan pesan pemicu basis data.
        if ($e->getCode() === self::SQLSTATE_CHECK_VIOLATION
            && str_contains($e->getMessage(), 'Identitas BMN tidak boleh diubah')) {
            return ValidationException::withMessages([
                'kode_barang' => 'Identitas BMN (kode lokasi, kode barang, NUP) tidak dapat diubah '
                    .'setelah aset terdaftar, karena nomornya sudah beredar pada label dan dokumen. '
                    .'Bila kode barang salah pilih, hapus aset ini lalu daftarkan ulang.',
            ]);
        }

        if ($e->getCode() !== self::SQLSTATE_UNIQUE_VIOLATION) {
            return $e;
        }

        $pesan = $e->getMessage();

        if (str_contains($pesan, 'assets_kode_internal_unique')) {
            return ValidationException::withMessages([
                'kode_internal' => 'Kode internal tersebut sudah dipakai barang lain.',
            ]);
        }

        if (str_contains($pesan, 'assets_identitas_bmn_unik') || str_contains($pesan, 'assets_bmn_id_unik')) {
            return ValidationException::withMessages([
                'kode_barang' => 'Identitas BMN (kode lokasi + kode barang + NUP) sudah terpakai. '
                    .'Bila data lama baru saja diimpor, jalankan penyelarasan NUP lebih dulu.',
            ]);
        }

        return $e;
    }
}
