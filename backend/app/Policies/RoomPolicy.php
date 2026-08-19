<?php

namespace App\Policies;

use App\Models\Room;
use App\Models\User;

/**
 * Otorisasi ruangan.
 *
 * Ruangan berada di persimpangan dua modul pada matriks akses, dan itu bukan
 * kebetulan yang bisa diabaikan:
 *
 *   - Sebagai MASTER DATA, ruangan dibuat, diubah, dan dihapus oleh pengelola.
 *   - Sebagai OBJEK BOOKING, ruangan harus dapat DILIHAT oleh siapa pun yang
 *     berhak memesan. Employee tidak punya izin master-data sama sekali;
 *     mengunci daftar ruangan di balik master-data.lihat akan membuat mereka
 *     tidak dapat memilih ruangan yang hendak dipesan — modul booking-nya
 *     tetap "berfungsi" tetapi tidak ada gunanya.
 *
 * Karena itu membaca memakai gabungan dua izin, sedangkan menulis tetap
 * murni master data.
 */
class RoomPolicy
{
    public function viewAny(User $pengguna): bool
    {
        return $pengguna->hasAnyPermission(['master-data.lihat', 'booking-ruangan.lihat']);
    }

    public function view(User $pengguna, Room $ruangan): bool
    {
        return $this->viewAny($pengguna);
    }

    public function create(User $pengguna): bool
    {
        return $pengguna->hasPermissionTo('master-data.buat');
    }

    public function update(User $pengguna, Room $ruangan): bool
    {
        return $pengguna->hasPermissionTo('master-data.ubah');
    }

    /**
     * Menghapus ruangan adalah tindakan yang paling merugikan bila keliru:
     * jadwal yang menempel padanya kehilangan acuan. Karena itu dibatasi pada
     * tingkat PENUH, bukan UBAH.
     */
    public function delete(User $pengguna, Room $ruangan): bool
    {
        return $pengguna->hasPermissionTo('master-data.kelola');
    }
}
