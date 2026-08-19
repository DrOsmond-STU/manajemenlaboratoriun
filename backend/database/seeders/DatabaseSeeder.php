<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Master kode barang harus lebih dulu: aset merujuk ke sana lewat
        // kunci asing, jadi urutannya tidak boleh dibalik.
        $this->call(BmnKodeBarangSeeder::class);

        // Peran dan izin harus ada sebelum pengguna dibuat, karena pengguna
        // langsung diberi peran saat dibuat.
        $this->call(PeranIzinSeeder::class);

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);
    }
}
