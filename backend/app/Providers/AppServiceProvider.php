<?php

namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->aturanSandi();
        $this->superAdminSerbaBisa();
    }

    /**
     * Aturan kata sandi, ditetapkan satu kali di sini.
     *
     * `uncompromised()` memeriksa sandi terhadap basis data kebocoran publik
     * lewat panggilan jaringan. Itu berharga di produksi, tetapi merugikan di
     * lingkungan uji: setiap uji yang menyentuh sandi akan menunggu jaringan,
     * dan pemeriksaannya gagal-lolos bila jaringan tak terjangkau — sehingga
     * ujinya lambat sekaligus tidak menguji apa pun.
     */
    private function aturanSandi(): void
    {
        Password::defaults(function () {
            $aturan = Password::min(12)->letters()->numbers();

            return $this->app->isProduction() ? $aturan->uncompromised() : $aturan;
        });
    }

    /**
     * Super Admin melewati seluruh pemeriksaan izin.
     *
     * Ditaruh di Gate::before, bukan dengan memberinya semua izin satu per
     * satu, supaya modul yang ditambahkan kelak otomatis tercakup. Bila
     * bergantung pada daftar izin, setiap modul baru menuntut seseorang ingat
     * memperbarui peran Super Admin — dan kalau lupa, admin sistem justru
     * terkunci dari fitur yang baru dibuat.
     */
    private function superAdminSerbaBisa(): void
    {
        Gate::before(fn ($pengguna) => $pengguna->hasRole('super-admin') ? true : null);
    }
}
