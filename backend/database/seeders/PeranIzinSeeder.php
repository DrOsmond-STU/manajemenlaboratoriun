<?php

namespace Database\Seeders;

use App\Support\MatriksAkses;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Peran dan izin, dibentuk dari MatriksAkses.
 *
 * Aman dijalankan berulang: peran yang sudah ada disegarkan izinnya, bukan
 * digandakan. `syncPermissions` sengaja dipakai alih-alih `givePermissionTo`,
 * supaya izin yang DIHAPUS dari matriks juga ikut dicabut — tanpa itu, izin
 * yang sudah tidak semestinya akan menempel selamanya pada peran lama.
 */
class PeranIzinSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (MatriksAkses::semuaIzin() as $nama) {
            Permission::findOrCreate($nama, 'web');
        }

        foreach (array_keys(MatriksAkses::NAMA_PERAN) as $peran) {
            $role = Role::findOrCreate($peran, 'web');
            $role->syncPermissions(MatriksAkses::izinPeran($peran));
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
