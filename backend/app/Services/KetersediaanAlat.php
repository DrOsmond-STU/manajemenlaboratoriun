<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\EquipmentLoan;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Alat mana yang bebas dipinjam pada sebuah rentang waktu.
 *
 * Cerminan KetersediaanRuangan, dan dengan alasan yang sama: menghitungnya di
 * peramban berarti memakai daftar peminjaman berumur beberapa menit, lalu
 * menolak pengguna pada langkah terakhir setelah layarnya sendiri berkata
 * alatnya tersedia.
 *
 * Satu perbedaan penting dari ruangan: alat punya syarat kelayakan yang tidak
 * ada pada ruangan — KALIBRASI. Alat ukur yang kalibrasinya kedaluwarsa secara
 * teknis "bebas", tetapi hasil pengujian yang memakainya tidak sah. Karena itu
 * ia ditandai tidak tersedia, dan alasannya disebutkan — bukan disembunyikan.
 */
class KetersediaanAlat
{
    /**
     * @return array<int, array<string,mixed>>
     */
    public function untukRentang(?User $pengguna, Carbon $mulai, Carbon $selesai, ?string $cari = null): array
    {
        $alat = Asset::query()
            ->dalamCakupan($pengguna)
            ->when($cari, fn ($q) => $q->cari($cari))
            ->with(['room:id,kode,nama', 'laboratory:id,kode,nama'])
            ->orderBy('nama')
            ->limit(100)
            ->get();

        // Satu kueri untuk seluruh alat. Daftar ini dipanggil ulang setiap
        // kali pengguna menggeser jam, dan N+1 di sini berarti seratus kueri
        // per ketikan.
        $terpakai = EquipmentLoan::query()
            ->whereIn('asset_id', $alat->pluck('id'))
            ->menahan()
            // Setengah terbuka [mulai, selesai) — sama persis dengan pemicu.
            ->where('mulai', '<', $selesai)
            ->where('selesai', '>', $mulai)
            ->with('user:id,name')
            ->get(['id', 'asset_id', 'user_id', 'keperluan', 'mulai', 'selesai', 'status'])
            ->groupBy('asset_id');

        return $alat->map(function (Asset $a) use ($terpakai) {
            $tabrakan = $terpakai->get($a->id, collect());
            $kalibrasiLewat = $a->kalibrasiKedaluwarsa();
            $rusak = $a->kondisi === 'RB';

            $alasan = match (true) {
                $tabrakan->isNotEmpty() => 'Sedang dipinjam pada rentang waktu ini',
                $rusak => 'Kondisi rusak berat',
                $kalibrasiLewat => 'Kalibrasi kedaluwarsa',
                default => null,
            };

            return [
                'id' => $a->id,
                'nama' => $a->nama,
                'kode_internal' => $a->kode_internal,
                'bmn_id' => $a->bmn_id,
                'merk' => $a->merk,
                'tipe' => $a->tipe,
                'serial_number' => $a->serial_number,
                'kondisi' => [
                    'kode' => $a->kondisi,
                    'nama' => Asset::KONDISI[$a->kondisi] ?? $a->kondisi,
                ],
                'wajib_kalibrasi' => (bool) $a->wajib_kalibrasi,
                'kalibrasi_kedaluwarsa' => $kalibrasiLewat,
                'lokasi' => $a->laboratory?->nama ?? $a->room?->nama,

                'tersedia' => $alasan === null,
                'alasan' => $alasan,

                'bentrok' => $tabrakan->map(fn (EquipmentLoan $p) => [
                    'id' => $p->id,
                    'keperluan' => $p->keperluan,
                    'peminjam' => $p->user?->name,
                    'mulai' => $p->mulai->toIso8601String(),
                    'selesai' => $p->selesai->toIso8601String(),
                    'status' => $p->status,
                ])->values()->all(),
            ];
        })->values()->all();
    }
}
