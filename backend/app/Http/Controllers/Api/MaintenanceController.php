<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SelesaikanMaintenanceRequest;
use App\Http\Requests\StoreMaintenanceRequest;
use App\Http\Resources\AssetResource;
use App\Http\Resources\MaintenanceResource;
use App\Models\AssetMaintenance;
use App\Services\AssetService;
use App\Services\MaintenanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Pemeliharaan dan kalibrasi.
 *
 * Satu controller untuk keduanya, sebagaimana satu tabel — daftar jatuh tempo
 * yang dilihat teknisi menggabungkan keduanya, dan memisahkannya hanya
 * memaksa penggabungan kembali di setiap tempat.
 *
 * Izinnya tetap terpisah mengikuti matriks: menulis kalibrasi menuntut
 * `kalibrasi.*`, menulis pemeliharaan menuntut `pemeliharaan.*`.
 */
class MaintenanceController extends Controller
{
    public function __construct(private readonly MaintenanceService $pemeliharaan) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->pastikanBolehMembaca($request);

        $query = AssetMaintenance::query()
            ->with(['asset:id,nama,kode_internal', 'petugas:id,name'])
            ->orderBy('jadwal');

        if ($request->filled('asset_id')) {
            $query->where('asset_id', $request->integer('asset_id'));
        }

        if ($request->filled('jenis')) {
            $query->where('jenis', $request->string('jenis')->toString());
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->boolean('terlambat')) {
            $query->terlambat();
        }

        if ($request->filled('jatuh_tempo_hari')) {
            $query->jatuhTempo($request->integer('jatuh_tempo_hari'));
        }

        return MaintenanceResource::collection($query->paginate(50));
    }

    public function store(StoreMaintenanceRequest $request): JsonResponse
    {
        $this->pastikanBolehMenulis($request, $request->string('jenis')->toString());

        $pekerjaan = $this->pemeliharaan->jadwalkan($request->validated());

        return MaintenanceResource::make($pekerjaan->load('asset:id,nama,kode_internal'))
            ->response()->setStatusCode(201);
    }

    public function show(Request $request, AssetMaintenance $pemeliharaan): MaintenanceResource
    {
        $this->pastikanBolehMembaca($request);

        return MaintenanceResource::make(
            $pemeliharaan->load(['asset:id,nama,kode_internal', 'petugas:id,name'])
        );
    }

    public function selesaikan(
        SelesaikanMaintenanceRequest $request,
        AssetMaintenance $pemeliharaan,
        AssetService $aset,
    ): MaintenanceResource {
        $this->pastikanBolehMenulis($request, $pemeliharaan->jenis);

        $hasil = $this->pemeliharaan->selesaikan(
            $pemeliharaan,
            $request->validated(),
            $aset,
            $request->user(),
        );

        return MaintenanceResource::make($hasil->load('asset:id,nama,kode_internal'));
    }

    /**
     * Alat yang kalibrasinya kedaluwarsa — daftar yang paling dicari saat
     * menyiapkan audit, dan yang paling berisiko bila terlewat.
     */
    public function kalibrasiKedaluwarsa(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('kalibrasi.lihat'), 403);

        return AssetResource::collection($this->pemeliharaan->alatKalibrasiKedaluwarsa());
    }

    private function pastikanBolehMembaca(Request $request): void
    {
        abort_unless(
            $request->user()->hasAnyPermission(['pemeliharaan.lihat', 'kalibrasi.lihat']),
            403,
        );
    }

    private function pastikanBolehMenulis(Request $request, string $jenis): void
    {
        $izin = $jenis === AssetMaintenance::JENIS_KALIBRASI ? 'kalibrasi.ubah' : 'pemeliharaan.ubah';

        abort_unless($request->user()->can($izin), 403);
    }
}
