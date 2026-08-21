<?php

namespace App\Policies;

use App\Models\Laboratory;
use App\Models\User;

/**
 * Otorisasi laboratorium, mengikuti kolom `laboratorium` pada matriks akses.
 */
class LaboratoryPolicy
{
    public function viewAny(User $pengguna): bool
    {
        return $pengguna->hasPermissionTo('laboratorium.lihat');
    }

    public function view(User $pengguna, Laboratory $lab): bool
    {
        return $this->viewAny($pengguna);
    }

    public function create(User $pengguna): bool
    {
        return $pengguna->hasPermissionTo('laboratorium.buat');
    }

    public function update(User $pengguna, Laboratory $lab): bool
    {
        return $pengguna->hasPermissionTo('laboratorium.ubah');
    }

    public function delete(User $pengguna, Laboratory $lab): bool
    {
        return $pengguna->hasPermissionTo('laboratorium.hapus');
    }
}
