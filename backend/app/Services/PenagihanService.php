<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Quotation;
use App\Models\Rental;
use App\Models\Tariff;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Penerbitan tagihan dan pencatatan pembayaran.
 */
class PenagihanService
{
    private const SQLSTATE_CHECK_VIOLATION = '23514';

    public function __construct(private readonly NupAllocator $nomor) {}

    /**
     * Terbitkan tagihan untuk sebuah penyewaan.
     *
     * Barisnya disalin dari tarif yang berlaku SAAT INI dan disimpan sebagai
     * cuplikan. Setelah terbit, kenaikan tarif tidak lagi mengubah tagihan ini.
     *
     * @param  list<array{deskripsi:string, kuantitas:int, satuan:string, harga_satuan:int}>  $barisTambahan
     *
     * @throws ValidationException
     */
    public function terbitkan(
        Rental $sewa,
        User $penerbit,
        int $ppnPersen = 0,
        int $jatuhTempoHari = 14,
        array $barisTambahan = [],
    ): Invoice {
        if ($sewa->status === 'dibatalkan') {
            throw ValidationException::withMessages([
                'rental_id' => 'Penyewaan yang dibatalkan tidak dapat ditagihkan.',
            ]);
        }

        $baris = [...$this->barisDariTarif($sewa), ...$barisTambahan];

        if ($baris === []) {
            throw ValidationException::withMessages([
                'rental_id' => 'Tidak ada tarif yang cocok untuk penyewaan ini, dan tidak ada baris '
                    .'tambahan yang diberikan. Tagihan tanpa baris bernilai nol dan hanya '
                    .'menimbulkan kebingungan saat ditagihkan.',
            ]);
        }

        return DB::transaction(function () use ($sewa, $penerbit, $ppnPersen, $jatuhTempoHari, $baris) {
            $tagihan = Invoice::create([
                'rental_id' => $sewa->id,
                'nomor' => $this->nomorBerikutnya(),
                'tanggal' => now()->toDateString(),
                'jatuh_tempo' => now()->addDays($jatuhTempoHari)->toDateString(),
                'ppn_persen' => $ppnPersen,
                'status' => 'terbit',
                'dibuat_oleh' => $penerbit->id,
            ]);

            foreach ($baris as $b) {
                $tagihan->lines()->create($b);
            }

            return $tagihan->refresh();
        });
    }

    /**
     * Terbitkan tagihan dari penawaran yang sudah disetujui.
     *
     * Barisnya disalin APA ADANYA dari quotation_lines — bukan diambil ulang
     * dari tarif yang berlaku saat ini. Penawaran yang sudah disetujui klien
     * adalah kesepakatan; tarif yang naik setelah negosiasi tidak boleh
     * diam-diam mengubah angka yang sudah disepakati.
     *
     * @throws ValidationException
     */
    public function terbitkanDariPenawaran(Quotation $penawaran, User $penerbit, int $jatuhTempoHari = 14): Invoice
    {
        if (! $penawaran->dapatDiterbitkanInvoice()) {
            throw ValidationException::withMessages([
                'quotation_id' => $penawaran->invoice()->exists()
                    ? 'Penawaran ini sudah diterbitkan menjadi invoice.'
                    : 'Hanya penawaran berstatus "Disetujui" yang dapat diterbitkan menjadi invoice.',
            ]);
        }

        return DB::transaction(function () use ($penawaran, $penerbit, $jatuhTempoHari) {
            $tagihan = Invoice::create([
                'rental_id' => $penawaran->rental_id,
                'quotation_id' => $penawaran->id,
                'nomor' => $this->nomorBerikutnya(),
                'tanggal' => now()->toDateString(),
                'jatuh_tempo' => now()->addDays($jatuhTempoHari)->toDateString(),
                'ppn_persen' => $penawaran->ppn_persen,
                'status' => 'terbit',
                'dibuat_oleh' => $penerbit->id,
            ]);

            foreach ($penawaran->lines as $baris) {
                $tagihan->lines()->create([
                    'deskripsi' => $baris->deskripsi,
                    'kuantitas' => $baris->kuantitas,
                    'satuan' => $baris->satuan,
                    'harga_satuan' => $baris->harga_satuan,
                ]);
            }

            return $tagihan->refresh();
        });
    }

    /**
     * Catat pembayaran.
     *
     * @throws ValidationException
     */
    public function catatPembayaran(Invoice $tagihan, array $data, User $pencatat): Payment
    {
        if ($tagihan->status === 'dibatalkan') {
            throw ValidationException::withMessages([
                'invoice_id' => 'Tagihan yang dibatalkan tidak dapat menerima pembayaran.',
            ]);
        }

        try {
            return DB::transaction(function () use ($tagihan, $data, $pencatat) {
                $bayar = $tagihan->payments()->create([
                    ...$data,
                    'dicatat_oleh' => $pencatat->id,
                ]);

                $this->segarkanStatus($tagihan);

                return $bayar;
            });
        } catch (QueryException $e) {
            throw $this->terjemahkanKelebihan($e, $tagihan);
        }
    }

    /**
     * Perbarui status tagihan dari jumlah yang sudah dibayar.
     *
     * Status adalah nilai turunan, jadi selalu dihitung ulang dari
     * pembayarannya — bukan ditebak dari tindakan terakhir. Menebaknya berarti
     * satu pembayaran yang dihapus meninggalkan tagihan berstatus "lunas"
     * padahal uangnya tidak pernah masuk.
     */
    public function segarkanStatus(Invoice $tagihan): Invoice
    {
        $tagihan->refresh();

        $total = $tagihan->total();
        $terbayar = $tagihan->terbayar();

        $status = match (true) {
            $tagihan->status === 'dibatalkan' => 'dibatalkan',
            $terbayar <= 0 => 'terbit',
            $terbayar >= $total => 'lunas',
            default => 'sebagian',
        };

        if ($status !== $tagihan->status) {
            $tagihan->update(['status' => $status]);
        }

        return $tagihan->refresh();
    }

    /**
     * Nomor tagihan berurut per tahun, aman terhadap balapan.
     *
     * Memakai pencatat yang sama dengan NUP BMN. Nomor tagihan kembar berarti
     * dua dokumen keuangan berbeda mengaku sebagai dokumen yang sama — dan itu
     * baru ketahuan saat rekonsiliasi.
     */
    private function nomorBerikutnya(): string
    {
        $tahun = now()->year;
        $urut = $this->nomor->berikutnya('invoice', (string) $tahun);

        return sprintf('INV/%d/%05d', $tahun, $urut);
    }

    /**
     * Baris tagihan dari tarif yang berlaku untuk penyewaan ini.
     *
     * Dipakai penerbitan invoice langsung DAN pembuatan penawaran — keduanya
     * mengambil dasar harga yang sama dari tarif aktif.
     *
     * @return list<array<string,mixed>>
     */
    public function barisDariTarif(Rental $sewa): array
    {
        $tarif = Tariff::query()
            ->aktif()
            ->where('segmen', $sewa->segmen)
            ->where(fn ($q) => $q
                ->when($sewa->room_id, fn ($r) => $r->orWhere('room_id', $sewa->room_id))
                ->when($sewa->laboratory_id, fn ($r) => $r->orWhere('laboratory_id', $sewa->laboratory_id)))
            ->get();

        $baris = [];

        foreach ($tarif as $t) {
            $kuantitas = match ($t->satuan_waktu) {
                'jam' => $sewa->durasiJam(),
                'hari' => $sewa->durasiHari(),
                default => 1,
            };

            $baris[] = [
                'deskripsi' => $t->nama,
                'kuantitas' => $kuantitas,
                'satuan' => $t->satuan_waktu,
                'harga_satuan' => $t->harga,
            ];
        }

        return $baris;
    }

    private function terjemahkanKelebihan(QueryException $e, Invoice $tagihan): \Throwable
    {
        if ($e->getCode() !== self::SQLSTATE_CHECK_VIOLATION
            || ! str_contains($e->getMessage(), 'payments_melebihi_tagihan')) {
            return $e;
        }

        return ValidationException::withMessages([
            'jumlah' => 'Pembayaran melebihi sisa tagihan. Sisa yang belum dibayar: Rp '
                .number_format($tagihan->sisa(), 0, ',', '.').'.',
        ]);
    }
}
