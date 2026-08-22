<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\MatriksAkses;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Matriks peran × modul — hanya baca.
 *
 * MatriksAkses::MATRIKS adalah kode, bukan baris pada tabel: mengedit
 * matriksnya lewat antarmuka berarti mengubah otorisasi tanpa tinjauan kode
 * (lihat docblock MatriksAkses). Endpoint ini karenanya tidak punya store
 * maupun update — hanya memperlihatkan apa yang sudah ditegakkan kode.
 */
class PeranController extends Controller
{
    private const NAMA_TINGKAT = ['-' => '—', 'LIHAT' => 'Lihat', 'BUAT' => 'Buat', 'UBAH' => 'Ubah', 'PENUH' => 'Penuh'];

    public function index(): JsonResponse
    {
        // Dihitung lewat kueri langsung pada tabel penghubung, BUKAN
        // Role::withCount('users'): relasi Spatie itu me-resolve model lewat
        // config('auth.defaults.guard') saat instance Role-nya masih kosong
        // (belum punya guard_name), dan middleware Sanctum MENGUBAH nilai
        // config itu menjadi 'sanctum' selama permintaan berlangsung — guard
        // yang tidak terdaftar di config/auth.php, sehingga relasinya gagal
        // resolve model dan melempar "Class name must be a valid object or
        // a string". Kueri langsung tidak bergantung pada guard sama sekali.
        $jumlahPerPeran = DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('model_has_roles.model_type', User::class)
            ->selectRaw('roles.name, count(*) as jumlah')
            ->groupBy('roles.name')
            ->pluck('jumlah', 'roles.name');

        return response()->json([
            'modul' => collect(MatriksAkses::MODUL)
                ->map(fn ($nama, $kode) => ['kode' => $kode, 'nama' => $nama])
                ->values(),
            'peran' => collect(MatriksAkses::NAMA_PERAN)
                ->map(fn ($nama, $kode) => [
                    'kode' => $kode,
                    'nama' => $nama,
                    'jumlah_pengguna' => (int) ($jumlahPerPeran[$kode] ?? 0),
                    'perlu_dikonfirmasi' => in_array($kode, MatriksAkses::PERLU_DIKONFIRMASI, true),
                ])
                ->values(),
            'matriks' => MatriksAkses::MATRIKS,
            'nama_tingkat' => self::NAMA_TINGKAT,
        ]);
    }
}
