<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Support\AsalPeristiwa;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Pencatatan jejak audit untuk perubahan yang BUKAN penyuntingan kolom model.
 *
 * Perubahan hak akses adalah contohnya: memberi peran kepada pengguna tidak
 * mengubah satu kolom pun pada tabel `users` — yang berubah adalah baris pada
 * tabel penghubung. Peristiwa model biasa tidak pernah menyala, sehingga
 * perubahan paling sensitif dalam sistem justru yang paling mudah luput bila
 * pencatatannya hanya bersandar pada trait `Diaudit`.
 */
class AuditService
{
    /**
     * @param  array<string,mixed>  $sebelum
     * @param  array<string,mixed>  $sesudah
     */
    public static function catat(
        string $peristiwa,
        Model $subjek,
        array $sebelum = [],
        array $sesudah = [],
        ?string $label = null,
    ): AuditLog {
        $pelaku = Auth::user();

        return AuditLog::create([
            'peristiwa' => $peristiwa,
            'model' => class_basename($subjek),
            'model_id' => $subjek->getKey(),
            'label' => $label ?? ($subjek->nama ?? $subjek->name ?? null),
            'user_id' => $pelaku?->id,
            'nama_pelaku' => $pelaku?->name,
            'sebelum' => $sebelum ?: null,
            'sesudah' => $sesudah ?: null,
            'ip' => Request::ip(),
            'rute' => AsalPeristiwa::jejak(),
        ]);
    }

    /**
     * Mencatat peristiwa yang tidak menunjuk satu baris tertentu.
     *
     * Penyusunan ulang sekelompok baris sekaligus adalah contohnya. Mencatat
     * tiap barisnya menghasilkan puluhan entri yang tidak menjawab pertanyaan
     * yang sebenarnya diajukan pemeriksa — "apa yang berubah pada perspektif
     * ini, dari apa menjadi apa" — dan, karena penghapusan massal tidak
     * melepas peristiwa model, entri itu pun berat sebelah: yang ditambahkan
     * tercatat, yang hilang tidak.
     *
     * @param  array<string,mixed>  $sebelum
     * @param  array<string,mixed>  $sesudah
     */
    public static function catatPeristiwa(
        string $peristiwa,
        string $model,
        string $label,
        array $sebelum = [],
        array $sesudah = [],
    ): AuditLog {
        $pelaku = Auth::user();

        return AuditLog::create([
            'peristiwa' => $peristiwa,
            'model' => $model,
            'model_id' => null,
            'label' => $label,
            'user_id' => $pelaku?->id,
            'nama_pelaku' => $pelaku?->name,
            'sebelum' => $sebelum ?: null,
            'sesudah' => $sesudah ?: null,
            'ip' => Request::ip(),
            'rute' => AsalPeristiwa::jejak(),
        ]);
    }
}
