<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\UbahSandiRequest;
use App\Http\Resources\PenggunaResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

/**
 * Masuk, keluar, identitas diri, dan ganti sandi.
 *
 * Memakai sesi berbasis cookie (Sanctum SPA), bukan token bearer. Alasannya:
 * antarmuka berjalan pada subdomain yang sama, dan cookie `HttpOnly` tidak
 * dapat dibaca JavaScript — sehingga satu celah XSS tidak langsung berarti
 * pencurian token.
 */
class AuthController extends Controller
{
    public function masuk(LoginRequest $request): JsonResponse
    {
        $request->autentikasi();

        // WAJIB. Tanpa ini, identitas sesi tidak berubah setelah masuk,
        // sehingga penyerang yang berhasil menanamkan id sesi kepada korban
        // sebelum korban masuk akan ikut terautentikasi bersama korban
        // (session fixation).
        $request->session()->regenerate();

        return PenggunaResource::make($request->user()->load('roles'))
            ->response()
            ->setStatusCode(200);
    }

    public function keluar(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        // Keduanya diperlukan: invalidate membuang isi sesi, regenerateToken
        // mengganti token CSRF sehingga token lama tidak dapat dipakai ulang.
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        // Guard bawaan adalah `sanctum`, yang menyimpan pengguna hasil
        // resolusinya sendiri. Tanpa ini, guard tersebut masih menganggap
        // seseorang masuk sepanjang sisa daur hidup permintaan ini — di
        // produksi tidak terasa karena tiap permintaan proses baru, tetapi
        // membiarkan keadaan itu berarti kode mana pun setelah baris ini
        // bekerja atas identitas yang sudah dicabut.
        Auth::forgetGuards();

        return response()->json(['pesan' => 'Berhasil keluar.']);
    }

    public function saya(Request $request): PenggunaResource
    {
        return PenggunaResource::make($request->user()->load('roles'));
    }

    public function ubahSandi(UbahSandiRequest $request): JsonResponse
    {
        $pengguna = $request->user();
        $pengguna->password = Hash::make($request->string('sandi_baru')->toString());
        $pengguna->save();

        // Mengganti sandi harus mengakhiri sesi lain. Bila sandi diganti
        // karena diduga bocor, sesi penyerang yang masih terbuka justru yang
        // paling perlu diputus.
        //
        // Harus lewat guard `web`: guard bawaan adalah `sanctum`, yang berupa
        // RequestGuard dan tidak punya logoutOtherDevices sama sekali —
        // memanggilnya di sana melempar galat, bukan diam-diam tidak bekerja.
        Auth::guard('web')->logoutOtherDevices($request->string('sandi_baru')->toString());
        $request->session()->regenerate();

        return response()->json(['pesan' => 'Kata sandi diperbarui. Sesi lain diakhiri.']);
    }
}
