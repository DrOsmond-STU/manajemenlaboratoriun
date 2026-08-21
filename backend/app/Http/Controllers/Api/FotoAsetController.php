<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetPhoto;
use App\Services\FotoAsetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FotoAsetController extends Controller
{
    public function __construct(private readonly FotoAsetService $foto) {}

    public function index(Request $request, Asset $asset): JsonResponse
    {
        return response()->json([
            'data' => $asset->photos()->get()->map(fn (AssetPhoto $f) => $this->bentuk($f)),
        ]);
    }

    public function store(Request $request, Asset $asset): JsonResponse
    {
        $request->validate([
            // Batas ukuran ditegakkan DUA KALI: di sini untuk pesan yang
            // terbaca, dan oleh batasan CHECK di basis data. Batas PHP
            // (upload_max_filesize) adalah lapis ketiga yang berada di luar
            // kendali kode ini dan berbeda-beda antar server.
            'foto' => ['required', 'file', 'max:10240'],
            'keterangan' => ['nullable', 'string', 'max:200'],
        ], [
            'foto.max' => 'Ukuran foto paling besar 10 MB.',
        ]);

        $foto = $this->foto->simpan(
            $asset,
            $request->file('foto'),
            $request->user(),
            $request->string('keterangan')->toString() ?: null,
        );

        return response()->json(['data' => $this->bentuk($foto)], 201);
    }

    /**
     * Melayani berkas fotonya.
     *
     * Lewat rute, bukan sebagai berkas statis di docroot. Foto aset
     * laboratorium memperlihatkan nomor seri, label BMN, dan tata letak
     * ruangan tempat alat mahal disimpan — dan nama berkas yang berpola
     * membuat menebaknya sepele bila berkasnya publik.
     */
    public function tampilkan(Request $request, Asset $asset, AssetPhoto $foto): StreamedResponse
    {
        // Foto yang bukan milik aset pada jalurnya ditolak. Tanpa pemeriksaan
        // ini, siapa pun yang boleh melihat satu aset dapat mengambil foto
        // aset mana pun hanya dengan mengganti angka pada URL — termasuk aset
        // di gedung yang tidak boleh dilihatnya.
        abort_unless($foto->asset_id === $asset->id, 404);

        $disk = Storage::disk('local');

        abort_unless($disk->exists($foto->jalur), 404);

        return $disk->response($foto->jalur, null, [
            'Content-Type' => $foto->mime,
            // Ditampilkan sebagai gambar, tidak dieksekusi apa pun isinya.
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function jadikanUtama(Asset $asset, AssetPhoto $foto): JsonResponse
    {
        abort_unless($foto->asset_id === $asset->id, 404);

        $this->foto->jadikanUtama($foto);

        return response()->json(['pesan' => 'Foto utama diperbarui.']);
    }

    public function destroy(Asset $asset, AssetPhoto $foto): JsonResponse
    {
        abort_unless($foto->asset_id === $asset->id, 404);

        $this->foto->hapus($foto);

        return response()->json(['pesan' => 'Foto dihapus.']);
    }

    /**
     * @return array<string,mixed>
     */
    private function bentuk(AssetPhoto $f): array
    {
        return [
            'id' => $f->id,
            'url' => route('assets.foto.tampilkan', ['asset' => $f->asset_id, 'foto' => $f->id]),
            'nama_asli' => $f->nama_asli,
            'mime' => $f->mime,
            'ukuran' => $f->ukuran,
            'utama' => $f->utama,
            'urutan' => $f->urutan,
            'keterangan' => $f->keterangan,
        ];
    }
}
