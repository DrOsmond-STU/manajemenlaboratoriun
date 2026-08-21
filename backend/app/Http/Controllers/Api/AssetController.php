<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MutasiAssetRequest;
use App\Http\Requests\StoreAssetRequest;
use App\Http\Requests\UpdateAssetRequest;
use App\Http\Resources\AssetMutationResource;
use App\Http\Resources\AssetResource;
use App\Models\Asset;
use App\Services\AssetService;
use App\Support\Satker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AssetController extends Controller
{
    public function __construct(private readonly AssetService $assets) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Asset::query()
            ->dalamCakupan($request->user())
            ->with(['kodeBarang:kode,uraian', 'room:id,kode,nama', 'penanggungJawab:id,name'])
            ->latest('id');

        if ($request->filled('cari')) {
            $query->cari($request->string('cari')->toString());
        }

        if ($request->filled('kondisi')) {
            $query->kondisi($request->string('kondisi')->toString());
        }

        if ($request->filled('room_id')) {
            $query->where('room_id', $request->integer('room_id'));
        }

        // Tapis per jenjang kode barang, misalnya '3.08' untuk seluruh alat
        // laboratorium — sesuai sifat berjenjang kodefikasi BMN.
        if ($request->filled('kode_barang')) {
            $query->where('kode_barang', 'like', $request->string('kode_barang')->toString().'%');
        }

        return AssetResource::collection($query->paginate(25));
    }

    public function store(StoreAssetRequest $request): JsonResponse
    {
        $asset = $this->assets->daftarkan(
            $request->validated(),
            Satker::kodeLokasi(),
        );

        return AssetResource::make($asset->load(['kodeBarang:kode,uraian', 'room:id,kode,nama']))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Asset $asset): AssetResource
    {
        return AssetResource::make(
            $asset->load(['kodeBarang:kode,uraian', 'room:id,kode,nama', 'penanggungJawab:id,name'])
        );
    }

    public function update(UpdateAssetRequest $request, Asset $asset): AssetResource
    {
        $data = $request->validated();
        $catatan = $data['catatan_perubahan'] ?? null;
        unset($data['catatan_perubahan']);

        $asset = $this->assets->ubah($asset, $data, $request->user(), $catatan);

        return AssetResource::make(
            $asset->load(['kodeBarang:kode,uraian', 'room:id,kode,nama', 'penanggungJawab:id,name'])
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

        return AssetResource::make($asset->load(['kodeBarang:kode,uraian', 'room:id,kode,nama']));
    }

    /** Riwayat perubahan, terbaru lebih dahulu. */
    public function riwayat(Asset $asset): AnonymousResourceCollection
    {
        return AssetMutationResource::collection(
            $asset->mutations()->with('user:id,name')->latest('id')->paginate(50)
        );
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
