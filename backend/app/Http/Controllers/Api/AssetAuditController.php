<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAssetAuditScanRequest;
use App\Http\Requests\StoreAssetAuditSessionRequest;
use App\Http\Resources\AssetAuditScanResource;
use App\Http\Resources\AssetAuditSessionResource;
use App\Models\AssetAuditSession;
use App\Services\AssetAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AssetAuditController extends Controller
{
    public function __construct(private readonly AssetAuditService $audit) {}

    public function index(): AnonymousResourceCollection
    {
        $sesi = AssetAuditSession::query()
            ->with('pembuat:id,name')
            ->withCount('scans')
            ->orderByDesc('mulai')
            ->paginate(20);

        return AssetAuditSessionResource::collection($sesi);
    }

    public function store(StoreAssetAuditSessionRequest $request): JsonResponse
    {
        $sesi = $this->audit->mulaiSesi($request->validated(), $request->user());

        return AssetAuditSessionResource::make($sesi->load('pembuat:id,name'))
            ->response()->setStatusCode(201);
    }

    public function show(Request $request, AssetAuditSession $sesi): AssetAuditSessionResource
    {
        $sesi->load(['pembuat:id,name', 'scans.asset:id,nama,kode_internal,bmn_id', 'scans.auditor:id,name']);
        $sesi->setAttribute('ringkasan', $this->audit->ringkasan($sesi, $request->user()));

        return AssetAuditSessionResource::make($sesi);
    }

    public function scan(StoreAssetAuditScanRequest $request, AssetAuditSession $sesi): JsonResponse
    {
        $pindaian = $this->audit->catatScan($sesi, $request->validated(), $request->user());

        return AssetAuditScanResource::make($pindaian->load(['asset:id,nama,kode_internal,bmn_id', 'auditor:id,name']))
            ->response()->setStatusCode(201);
    }

    public function tutup(Request $request, AssetAuditSession $sesi): AssetAuditSessionResource
    {
        $sesi = $this->audit->tutupSesi($sesi);
        $sesi->load(['pembuat:id,name', 'scans.asset:id,nama,kode_internal,bmn_id', 'scans.auditor:id,name']);
        $sesi->setAttribute('ringkasan', $this->audit->ringkasan($sesi, $request->user()));

        return AssetAuditSessionResource::make($sesi);
    }
}
