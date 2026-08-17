<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\Room;
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

    public function __construct(
        private readonly NupAllocator $nup,
        private readonly KodeInternalGenerator $kodeInternal,
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
