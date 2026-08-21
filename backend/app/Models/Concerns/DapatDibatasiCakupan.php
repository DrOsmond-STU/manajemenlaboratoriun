<?php

namespace App\Models\Concerns;

use App\Models\User;
use App\Support\CakupanData;
use Illuminate\Database\Eloquent\Builder;

/**
 * Penapisan cakupan data pada kueri.
 *
 * Dipakai lewat `->dalamCakupan($pengguna)` di controller. Sengaja BUKAN
 * global scope: global scope berlaku diam-diam pada setiap kueri, termasuk
 * pada perintah artisan, seeder, dan pekerjaan latar yang justru harus
 * melihat seluruh data. Kelalaian semacam itu tidak menampakkan diri sebagai
 * galat — hanya sebagai laporan yang diam-diam tidak lengkap.
 *
 * Dengan pemanggilan eksplisit, tempat yang membatasi terbaca di kodenya, dan
 * tempat yang sengaja tidak membatasi juga terbaca.
 */
trait DapatDibatasiCakupan
{
    /**
     * Batasi kueri pada data yang boleh dilihat pengguna.
     *
     * Bentuk pembatasannya berbeda-beda per model: ruangan dibatasi kolom
     * `gedung` miliknya sendiri, aset lewat ruangan tempatnya berada, dan
     * pemesanan selalu menyertakan pengajuan milik sendiri. Karena itu setiap
     * model menyediakan `terapkanCakupan()`-nya sendiri.
     */
    public function scopeDalamCakupan(Builder $query, ?User $pengguna): Builder
    {
        if ($pengguna === null) {
            return $query;
        }

        return static::terapkanCakupan($query, $pengguna);
    }

    abstract protected static function terapkanCakupan(Builder $query, User $pengguna): Builder;

    /**
     * Gedung yang membatasi pengguna ini; kosong berarti tidak dibatasi.
     *
     * @return list<string>
     */
    protected static function gedungPengguna(User $pengguna): array
    {
        return CakupanData::dibatasiGedung($pengguna)
            ? $pengguna->gedungDiampu()->all()
            : [];
    }
}
