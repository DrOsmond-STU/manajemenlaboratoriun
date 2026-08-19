<?php

namespace Tests;

use App\Models\User;
use Database\Seeders\PeranIzinSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Spatie\Permission\PermissionRegistrar;

abstract class TestCase extends BaseTestCase
{
    private bool $peranSudahDisiapkan = false;

    /**
     * Pengguna dengan peran tertentu.
     *
     * Sengaja meminta peran secara eksplisit, dan sengaja TIDAK memakai
     * super-admin sebagai jalan pintas. Super-admin melewati seluruh
     * pemeriksaan izin lewat Gate::before, sehingga uji yang memakainya akan
     * tetap lulus walaupun rutenya lupa dipasangi izin sama sekali — persis
     * kesalahan yang paling perlu ketahuan.
     */
    protected function penggunaBerperan(string $peran, array $atribut = []): User
    {
        $this->siapkanPeran();

        return User::factory()->create($atribut)->assignRole($peran);
    }

    protected function siapkanPeran(): void
    {
        if ($this->peranSudahDisiapkan) {
            return;
        }

        $this->seed(PeranIzinSeeder::class);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->peranSudahDisiapkan = true;
    }
}
