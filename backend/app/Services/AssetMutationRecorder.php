<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\Room;
use App\Models\User;

/**
 * Pencatat riwayat perubahan aset.
 *
 * Riwayat dibangkitkan dari SELISIH keadaan sebelum dan sesudah, bukan dari
 * niat pemanggil. Bila pemanggil yang menyatakan "ini perpindahan ruangan",
 * cepat atau lambat akan ada jalur yang lupa menyatakannya dan perubahannya
 * lenyap dari riwayat tanpa jejak. Dengan membandingkan keadaan, satu-satunya
 * cara agar perubahan tidak tercatat adalah tidak terjadi.
 *
 * Nilai disimpan sebagai teks yang terbaca manusia — nama ruangan, bukan
 * `room_id` — supaya riwayat tetap bermakna walau ruangannya kelak dihapus
 * atau diganti namanya. Riwayat yang isinya angka acuan akan kehilangan arti
 * persis ketika paling dibutuhkan.
 */
class AssetMutationRecorder
{
    /** Kolom yang diawasi, beserta cara membacanya menjadi teks. */
    private const DIAWASI = ['room_id', 'kondisi', 'penanggung_jawab_id', 'status_penggunaan'];

    /**
     * @param  array<string,mixed>  $sebelum  Nilai kolom sebelum perubahan.
     * @return int Jumlah baris riwayat yang tercatat.
     */
    public function catat(Asset $asset, array $sebelum, ?User $pelaku = null, ?string $catatan = null): int
    {
        $tercatat = 0;

        foreach (self::DIAWASI as $kolom) {
            $lama = $sebelum[$kolom] ?? null;
            $baru = $asset->getAttribute($kolom);

            // Perbandingan longgar disengaja: `null` dan `''` sama-sama berarti
            // "belum ditempatkan", dan 3 dari basis data sama dengan '3' dari
            // borang. Tanpa ini, riwayat akan penuh perubahan semu.
            if ((string) $lama === (string) $baru) {
                continue;
            }

            AssetMutation::create([
                'asset_id' => $asset->id,
                'jenis' => $this->jenisDari($kolom),
                'nilai_lama' => $this->bacaan($kolom, $lama),
                'nilai_baru' => $this->bacaan($kolom, $baru),
                'user_id' => $pelaku?->id,
                'catatan' => $catatan,
            ]);

            $tercatat++;
        }

        return $tercatat;
    }

    private function jenisDari(string $kolom): string
    {
        return match ($kolom) {
            'room_id' => 'penempatan',
            'kondisi' => 'kondisi',
            'penanggung_jawab_id' => 'penanggung_jawab',
            default => 'status_penggunaan',
        };
    }

    /** Ubah nilai kolom menjadi teks yang tetap bermakna di kemudian hari. */
    private function bacaan(string $kolom, mixed $nilai): ?string
    {
        if ($nilai === null || $nilai === '') {
            return null;
        }

        return match ($kolom) {
            'room_id' => Room::withTrashed()->find($nilai)?->nama ?? "Ruangan #{$nilai}",
            'penanggung_jawab_id' => User::find($nilai)?->name ?? "Pengguna #{$nilai}",
            'kondisi' => Asset::KONDISI[$nilai] ?? (string) $nilai,
            default => (string) $nilai,
        };
    }
}
