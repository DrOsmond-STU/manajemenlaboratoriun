<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Daftar pengguna untuk PEMILIHAN, bukan untuk penelusuran.
 *
 * Formulir ruangan, laboratorium, dan aset perlu memilih penanggung jawab,
 * supervisor, dan teknisi. Tanpa daftar ini, satu-satunya cara mengisinya
 * adalah mengetik id pengguna secara manual — dan salah ketik satu angka
 * memberikan tanggung jawab kepada orang yang sama sekali lain, tanpa satu
 * pun tanda.
 *
 * YANG DIKIRIM SENGAJA SESEDIKIT MUNGKIN: id, nama, dan unit kerja. Surel
 * TIDAK ikut. Daftar surel seluruh pegawai adalah bahan baku yang paling
 * berguna bagi siapa pun yang menyiapkan serangan phishing, dan endpoint ini
 * dapat diakses hampir semua peran karena hampir semua formulir memerlukannya.
 * Nama saja sudah cukup untuk memilih; surel tidak menambah apa pun kecuali
 * risiko.
 *
 * Tidak ada penomoran halaman: pencarian wajib bila jumlahnya banyak, dan
 * batas keras 50 baris membuat endpoint ini tidak dapat dipakai menyedot
 * seluruh direktori pegawai sedikit demi sedikit.
 */
class PenggunaController extends Controller
{
    private const BATAS = 50;

    public function index(Request $request): JsonResponse
    {
        $query = User::query()->select('id', 'name', 'unit_kerja')->orderBy('name');

        if ($request->filled('cari')) {
            $kata = $request->string('cari')->toString();
            $query->where('name', 'ilike', "%{$kata}%");
        }

        // Menyaring per peran — misalnya hanya teknisi lab — supaya pemilih
        // teknisi tidak menawarkan seluruh pegawai.
        if ($request->filled('peran')) {
            $query->role($request->string('peran')->toString());
        }

        $baris = $query->limit(self::BATAS)->get();

        return response()->json([
            'data' => $baris->map(fn (User $u) => [
                'id' => $u->id,
                'nama' => $u->name,
                'unit_kerja' => $u->unit_kerja,
            ]),
            // Pemanggil perlu tahu daftarnya terpotong, supaya antarmuka dapat
            // meminta pengguna mempersempit pencarian alih-alih diam-diam
            // menyembunyikan orang yang dicari.
            'terpotong' => $baris->count() === self::BATAS,
        ]);
    }
}
