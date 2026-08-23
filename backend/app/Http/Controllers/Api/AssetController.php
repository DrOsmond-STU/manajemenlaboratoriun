<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MutasiAssetRequest;
use App\Http\Requests\StoreAssetRequest;
use App\Http\Requests\UpdateAssetRequest;
use App\Http\Resources\AssetMutationResource;
use App\Http\Resources\AssetResource;
use App\Models\Asset;
use App\Models\AssetMutation;
use App\Services\AssetService;
use App\Services\RingkasanAset;
use App\Support\Satker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AssetController extends Controller
{
    public function __construct(
        private readonly AssetService $assets,
        private readonly RingkasanAset $ringkasan,
    ) {}

    /**
     * Angka ringkasan atas SELURUH aset dalam cakupan, bukan atas halaman
     * yang sedang tampil.
     *
     * Terpisah dari index() karena daftarnya berhalaman: ringkasan yang
     * dihitung antarmuka dari 25 baris pertama akan melaporkan nilai perolehan
     * seperempat miliar untuk satuan kerja yang asetnya puluhan miliar — dan
     * angka itu tidak tampak salah, ia hanya kecil.
     */
    public function ringkasan(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->ringkasan->untuk($request->user(), [
                'kode_barang' => $request->string('kode_barang')->toString() ?: null,
                'kondisi' => $request->string('kondisi')->toString() ?: null,
                'room_id' => $request->integer('room_id') ?: null,
                'laboratory_id' => $request->integer('laboratory_id') ?: null,
                'wajib_kalibrasi' => $request->has('wajib_kalibrasi') ? $request->boolean('wajib_kalibrasi') : null,
            ]),
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Asset::query()
            ->dalamCakupan($request->user())
            ->with(['kodeBarang:kode,uraian', 'room:id,kode,nama', 'penanggungJawab:id,name', 'laboratory:id,kode,nama', 'fotoUtama'])
            ->withCount('photos')
            ->latest('id');

        // Kalibrasi selesai TERAKHIR saja per aset, dimuat lewat SATU kueri
        // batch (WHERE asset_id IN (...)) — HANYA saat diminta secara
        // eksplisit lewat `wajib_kalibrasi` (dipakai layar Manajemen Alat).
        // Tanpa penjagaan ini, Asset Register akan ikut memuat relasi yang
        // tidak pernah ditampilkannya. AssetResource jatuh balik ke
        // Asset::kalibrasiTerakhir() (satu kueri per baris) bila relasi ini
        // tidak dimuat — aman untuk endpoint lain, hanya lebih mahal.
        if ($request->has('wajib_kalibrasi')) {
            $query->with(['maintenances' => fn ($q) => $q->kalibrasi()
                ->where('status', 'selesai')->whereNotNull('berlaku_sampai')
                ->orderByDesc('berlaku_sampai')]);
        }

        if ($request->filled('cari')) {
            $query->cari($request->string('cari')->toString());
        }

        if ($request->filled('kondisi')) {
            $query->kondisi($request->string('kondisi')->toString());
        }

        if ($request->filled('status_penggunaan')) {
            $query->statusPenggunaan($request->string('status_penggunaan')->toString());
        }

        if ($request->filled('room_id')) {
            $query->where('room_id', $request->integer('room_id'));
        }

        if ($request->filled('laboratory_id')) {
            $query->where('laboratory_id', $request->integer('laboratory_id'));
        }

        // Dipakai layar Manajemen Alat Laboratorium untuk menyaring hanya
        // alat yang wajib kalibrasi — meja dan lemari tidak, dan menampilkan
        // Register BMN lengkap di layar itu akan menenggelamkan alat lab
        // sungguhan di antara furnitur dan aset umum lainnya.
        if ($request->has('wajib_kalibrasi')) {
            $query->where('wajib_kalibrasi', $request->boolean('wajib_kalibrasi'));
        }

        // Tapis per jenjang kode barang, misalnya '3.08' untuk seluruh alat
        // laboratorium — sesuai sifat berjenjang kodefikasi BMN.
        if ($request->filled('kode_barang')) {
            $query->where('kode_barang', 'like', $request->string('kode_barang')->toString().'%');
        }

        // Halaman lebih besar dari 25 dilayani bila diminta eksplisit —
        // dipakai Studio Label & Barcode yang perlu daftar barang untuk
        // dipilih, bukan hanya satu halaman. Dibatasi 200: cukup untuk
        // hampir seluruh satuan kerja laboratorium, dan bukan tarikan tak
        // terbatas ke satu permintaan.
        $ukuranHalaman = $request->filled('per_halaman')
            ? max(1, min(200, $request->integer('per_halaman')))
            : 25;

        return AssetResource::collection($query->paginate($ukuranHalaman));
    }

    public function store(StoreAssetRequest $request): JsonResponse
    {
        $asset = $this->assets->daftarkan(
            $request->validated(),
            Satker::kodeLokasi(),
        );

        return AssetResource::make(
            $asset->load(['kodeBarang:kode,uraian', 'room:id,kode,nama', 'laboratory:id,kode,nama', 'fotoUtama'])->loadCount('photos')
        )->response()->setStatusCode(201);
    }

    public function show(Asset $asset): AssetResource
    {
        return AssetResource::make(
            $asset->load(['kodeBarang:kode,uraian', 'room:id,kode,nama', 'penanggungJawab:id,name', 'laboratory:id,kode,nama', 'fotoUtama'])
                ->loadCount('photos')
        );
    }

    public function update(UpdateAssetRequest $request, Asset $asset): AssetResource
    {
        $data = $request->validated();
        $catatan = $data['catatan_perubahan'] ?? null;
        unset($data['catatan_perubahan']);

        $asset = $this->assets->ubah($asset, $data, $request->user(), $catatan);

        return AssetResource::make(
            $asset->load(['kodeBarang:kode,uraian', 'room:id,kode,nama', 'penanggungJawab:id,name', 'laboratory:id,kode,nama', 'fotoUtama'])
                ->loadCount('photos')
        );
    }

    /** Perpindahan ruangan, terpisah dari penyuntingan data teknis alat. */
    public function mutasi(MutasiAssetRequest $request, Asset $asset): AssetResource
    {
        $asset = $this->assets->mutasi(
            $asset,
            $request->integer('room_id') ?: null,
            $request->user(),
            $request->string('catatan')->toString() ?: null,
        );

        return AssetResource::make(
            $asset->load(['kodeBarang:kode,uraian', 'room:id,kode,nama', 'laboratory:id,kode,nama', 'fotoUtama'])->loadCount('photos')
        );
    }

    /** Riwayat perubahan, terbaru lebih dahulu. */
    public function riwayat(Asset $asset): AnonymousResourceCollection
    {
        return AssetMutationResource::collection(
            $asset->mutations()->with('user:id,name')->latest('id')->paginate(50)
        );
    }

    /**
     * Riwayat mutasi LINTAS SELURUH aset dalam cakupan, terbaru lebih dahulu.
     *
     * Beda dengan riwayat(): itu satu aset, ini layar "Asset Movement &
     * Mutasi" yang butuh feed gabungan. Dibatasi cakupan lewat `whereHas`
     * pada relasi aset — mutasi sendiri tidak menyimpan gedung/unit kerja.
     */
    public function mutasiSemua(Request $request): AnonymousResourceCollection
    {
        $query = AssetMutation::query()
            ->whereHas('asset', fn ($q) => $q->dalamCakupan($request->user()))
            ->with(['user:id,name', 'asset:id,nama,kode_internal'])
            ->latest('id');

        if ($request->filled('cari')) {
            $kata = $request->string('cari')->toString();
            $query->whereHas('asset', fn ($q) => $q
                ->where('nama', 'ilike', "%{$kata}%")
                ->orWhere('kode_internal', 'ilike', "%{$kata}%"));
        }

        if ($request->filled('jenis')) {
            $query->where('jenis', $request->string('jenis')->toString());
        }

        return AssetMutationResource::collection($query->paginate(50));
    }

    public function destroy(Request $request, Asset $asset): JsonResponse
    {
        $this->assets->hapus(
            $asset,
            $request->user(),
            $request->string('alasan')->toString() ?: null,
        );

        // 200 dengan penjelasan, bukan 204 kosong: penghapusannya lunak, dan
        // pemanggil perlu tahu bahwa NUP-nya tetap tertahan.
        return response()->json([
            'pesan' => 'Aset dihapus. NUP '.$asset->nup_fmt.' tetap tertahan dan tidak dipakai ulang.',
        ]);
    }
}
