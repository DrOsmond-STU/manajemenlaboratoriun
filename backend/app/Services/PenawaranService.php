<?php

namespace App\Services;

use App\Models\Quotation;
use App\Models\Rental;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Penawaran (quotation) — tahap sebelum tagihan.
 */
class PenawaranService
{
    public function __construct(
        private readonly PenagihanService $penagihan,
        private readonly NupAllocator $nomor,
    ) {}

    /**
     * Buat penawaran baru untuk sebuah penyewaan.
     *
     * Dasar harganya sama dengan penerbitan invoice langsung — tarif aktif
     * yang cocok dengan fasilitas dan segmen penyewaan — plus baris manual
     * untuk add-on/paket yang dipilih staf untuk penawaran ini.
     *
     * @param  list<array{deskripsi:string, kuantitas:int, satuan:string, harga_satuan:int}>  $barisTambahan
     *
     * @throws ValidationException
     */
    public function buat(
        Rental $sewa,
        User $pembuat,
        int $ppnPersen = 0,
        int $berlakuHari = 14,
        array $barisTambahan = [],
    ): Quotation {
        $baris = [...$this->penagihan->barisDariTarif($sewa), ...$barisTambahan];

        if ($baris === []) {
            throw ValidationException::withMessages([
                'rental_id' => 'Tidak ada tarif yang cocok untuk penyewaan ini, dan tidak ada baris '
                    .'tambahan yang diberikan. Penawaran tanpa baris bernilai nol dan hanya '
                    .'menimbulkan kebingungan saat dikirim ke klien.',
            ]);
        }

        return DB::transaction(function () use ($sewa, $pembuat, $ppnPersen, $berlakuHari, $baris) {
            $penawaran = Quotation::create([
                'rental_id' => $sewa->id,
                'nomor' => $this->nomorBerikutnya(),
                'tanggal' => now()->toDateString(),
                'berlaku_sampai' => now()->addDays($berlakuHari)->toDateString(),
                'ppn_persen' => $ppnPersen,
                'status' => 'terkirim',
                'dibuat_oleh' => $pembuat->id,
            ]);

            foreach ($baris as $b) {
                $penawaran->lines()->create($b);
            }

            return $penawaran->refresh();
        });
    }

    /**
     * Putuskan penawaran: pindah ke negosiasi, disetujui, atau ditolak.
     *
     * Hanya penawaran yang masih aktif (terkirim/negosiasi) dan belum
     * kedaluwarsa yang boleh diputuskan — status disetujui/ditolak adalah
     * final, dan tanggal berlakunya sudah lewat berarti klien perlu
     * penawaran baru, bukan keputusan atas yang lama.
     *
     * @throws ValidationException
     */
    public function putuskan(Quotation $penawaran, string $keputusan): Quotation
    {
        if (! in_array($penawaran->status, ['terkirim', 'negosiasi'], true)) {
            throw ValidationException::withMessages([
                'status' => 'Penawaran ini sudah berstatus final ('
                    .(Quotation::STATUS[$penawaran->status] ?? $penawaran->status).') dan tidak dapat diubah lagi.',
            ]);
        }

        if ($penawaran->kedaluwarsa()) {
            throw ValidationException::withMessages([
                'status' => 'Penawaran ini sudah kedaluwarsa. Buat penawaran baru untuk penyewaan ini.',
            ]);
        }

        $penawaran->update(['status' => $keputusan]);

        return $penawaran->refresh();
    }

    /** Nomor penawaran berurut per tahun, aman terhadap balapan — pola sama dengan nomor invoice. */
    private function nomorBerikutnya(): string
    {
        $tahun = now()->year;
        $urut = $this->nomor->berikutnya('quotation', (string) $tahun);

        return sprintf('QUO/%d/%05d', $tahun, $urut);
    }
}
