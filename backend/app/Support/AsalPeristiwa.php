<?php

namespace App\Support;

use Illuminate\Support\Facades\Request;

/**
 * Dari mana sebuah peristiwa yang diaudit berasal.
 *
 * Bukan sekadar jalur HTTP: sebagian besar perubahan paling berdampak dalam
 * sistem ini justru TIDAK datang lewat HTTP — seeder peran, impor master
 * kode barang, perintah artisan pembuatan pengguna, pekerjaan terjadwal.
 * Request::path() mengembalikan "/" untuk semuanya, yang membuat jejak
 * auditnya berbunyi seolah seseorang membuka halaman depan lalu mengubah
 * hak akses dari sana.
 */
class AsalPeristiwa
{
    public static function jejak(): ?string
    {
        if (app()->runningInConsole()) {
            $perintah = self::perintah();

            return $perintah === null ? 'konsol' : 'konsol: '.$perintah;
        }

        $jalur = Request::path();

        return ($jalur === '' || $jalur === '/') ? null : mb_substr($jalur, 0, 200);
    }

    private static function perintah(): ?string
    {
        $argv = $_SERVER['argv'] ?? [];

        // argv[0] adalah "artisan"; argv[1] nama perintahnya. Argumen
        // selebihnya sengaja TIDAK ikut — perintah dapat membawa nilai yang
        // tidak layak masuk jejak audit.
        $nama = $argv[1] ?? null;

        return is_string($nama) && $nama !== '' ? mb_substr($nama, 0, 190) : null;
    }
}
