<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\PeranIzinSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BuatPenggunaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PeranIzinSeeder::class);
    }

    public function test_membuat_pengguna_dengan_peran(): void
    {
        $this->artisan('flms:buat-pengguna', [
            'email' => 'admin@contoh.test',
            '--nama' => 'Admin Sistem',
            '--peran' => ['super-admin'],
            '--sandi-acak' => true,
        ])->assertSuccessful();

        $pengguna = User::where('email', 'admin@contoh.test')->firstOrFail();

        $this->assertSame('Admin Sistem', $pengguna->name);
        $this->assertTrue($pengguna->hasRole('super-admin'));
    }

    public function test_sandi_acak_ditampilkan_sekali_dan_tersimpan_ter_hash(): void
    {
        $this->artisan('flms:buat-pengguna', [
            'email' => 'admin@contoh.test',
            '--peran' => ['super-admin'],
            '--sandi-acak' => true,
        ])->expectsOutputToContain('hanya ditampilkan sekali')->assertSuccessful();

        $tersimpan = User::where('email', 'admin@contoh.test')->value('password');

        // Sandi tidak boleh tersimpan apa adanya.
        $this->assertStringStartsWith('$2y$', $tersimpan);
        $this->assertFalse(Hash::check('admin@contoh.test', $tersimpan));
    }

    public function test_peran_wajib_diisi(): void
    {
        $this->artisan('flms:buat-pengguna', ['email' => 'a@contoh.test'])
            ->expectsOutputToContain('Peran wajib diisi')
            ->assertFailed();

        $this->assertDatabaseCount('users', 0);
    }

    public function test_peran_tidak_dikenal_ditolak(): void
    {
        $this->artisan('flms:buat-pengguna', [
            'email' => 'a@contoh.test',
            '--peran' => ['dewa'],
            '--sandi-acak' => true,
        ])->expectsOutputToContain('Peran tidak dikenal')->assertFailed();

        $this->assertDatabaseCount('users', 0);
    }

    public function test_surel_kembar_ditolak(): void
    {
        User::factory()->create(['email' => 'a@contoh.test']);

        $this->artisan('flms:buat-pengguna', [
            'email' => 'a@contoh.test',
            '--peran' => ['employee'],
            '--sandi-acak' => true,
        ])->expectsOutputToContain('sudah ada')->assertFailed();

        $this->assertDatabaseCount('users', 1);
    }

    public function test_sandi_lemah_ditolak(): void
    {
        $this->artisan('flms:buat-pengguna', [
            'email' => 'a@contoh.test',
            '--peran' => ['employee'],
        ])->expectsQuestion('Kata sandi', 'pendek')
            ->expectsQuestion('Ulangi kata sandi', 'pendek')
            ->assertFailed();

        $this->assertDatabaseCount('users', 0);
    }
}
