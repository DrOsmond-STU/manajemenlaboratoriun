<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Penjadwalan dan penyelesaian pemeliharaan/kalibrasi.
 */
class MaintenanceService
{
    /**
     * Jadwalkan pekerjaan.
     *
     * @param  array<string,mixed>  $data
     */
    public function jadwalkan(array $data): AssetMaintenance
    {
        $data['status'] = 'dijadwalkan';

        return AssetMaintenance::create($data);
    }

    /**
     * Tandai selesai.
     *
     * Kalibrasi menuntut lebih banyak daripada pemeliharaan biasa: tanpa nomor
     * sertifikat dan masa berlaku, hasilnya tidak dapat dipertanggungjawabkan
     * saat audit — dan yang lebih berbahaya, sistem tidak punya dasar untuk
     * menghitung kapan alat itu kedaluwarsa. Alat tanpa masa berlaku akan
     * dianggap selamanya sah.
     *
     * @param  array<string,mixed>  $data
     *
     * @throws ValidationException
     */
    public function selesaikan(
        AssetMaintenance $pekerjaan,
        array $data,
        AssetService $aset,
        ?User $pelaku = null,
    ): AssetMaintenance {
        if (in_array($pekerjaan->status, ['selesai', 'dibatalkan'], true)) {
            throw ValidationException::withMessages([
                'status' => "Pekerjaan sudah berstatus {$pekerjaan->status} dan tidak dapat diselesaikan lagi.",
            ]);
        }

        if ($pekerjaan->jenis === AssetMaintenance::JENIS_KALIBRASI) {
            $this->pastikanKelengkapanKalibrasi($data);
        }

        return DB::transaction(function () use ($pekerjaan, $data, $aset, $pelaku) {
            $pekerjaan->update([
                ...$data,
                'status' => 'selesai',
                'dikerjakan_pada' => $data['dikerjakan_pada'] ?? now()->toDateString(),
            ]);

            // Pemeliharaan korektif lazimnya memperbaiki alat; bila kondisinya
            // dilaporkan berubah, master aset dan riwayatnya ikut diperbarui —
            // sama seperti pada pengembalian peminjaman. Hanya berlaku bila
            // pekerjaannya sungguhan melekat pada alat — pekerjaan yang
            // melekat pada ruangan atau laboratorium tidak punya "kondisi
            // aset" untuk diperbarui.
            if ($pekerjaan->asset && isset($data['kondisi_setelah']) && $data['kondisi_setelah'] !== $pekerjaan->asset->kondisi) {
                $aset->ubah(
                    $pekerjaan->asset,
                    ['kondisi' => $data['kondisi_setelah']],
                    $pelaku,
                    $pekerjaan->jenisNama().' selesai (pekerjaan #'.$pekerjaan->id.')',
                );
            }

            return $pekerjaan->refresh();
        });
    }

    /**
     * Alat yang kalibrasinya kedaluwarsa.
     *
     * @return Collection<int, Asset>
     */
    public function alatKalibrasiKedaluwarsa()
    {
        return Asset::query()
            ->where('wajib_kalibrasi', true)
            ->whereDoesntHave('maintenances', fn ($q) => $q
                ->kalibrasi()
                ->where('status', 'selesai')
                ->whereDate('berlaku_sampai', '>=', now()))
            ->get();
    }

    /**
     * @param  array<string,mixed>  $data
     *
     * @throws ValidationException
     */
    private function pastikanKelengkapanKalibrasi(array $data): void
    {
        $kurang = [];

        if (blank($data['no_sertifikat'] ?? null)) {
            $kurang['no_sertifikat'] = 'Nomor sertifikat wajib diisi untuk kalibrasi yang diselesaikan.';
        }

        if (blank($data['berlaku_sampai'] ?? null)) {
            $kurang['berlaku_sampai'] = 'Masa berlaku wajib diisi. Tanpa itu, alat akan dianggap '
                .'sah selamanya dan tidak pernah muncul sebagai kedaluwarsa.';
        }

        if ($kurang !== []) {
            throw ValidationException::withMessages($kurang);
        }
    }
}
