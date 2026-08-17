<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAssetRequest;
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
}
