<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\KembalikanPinjamanRequest;
use App\Http\Requests\StoreEquipmentLoanRequest;
use App\Http\Resources\EquipmentLoanResource;
use App\Models\EquipmentLoan;
use App\Services\AssetService;
use App\Services\EquipmentLoanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EquipmentLoanController extends Controller
{
    public function __construct(private readonly EquipmentLoanService $peminjaman) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = EquipmentLoan::query()
            ->dalamCakupan($request->user())
            ->with(['asset:id,nama,kode_internal,bmn_id', 'user:id,name'])
            ->latest('mulai');

        if ($request->filled('asset_id')) {
            $query->where('asset_id', $request->integer('asset_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->boolean('hanya_menahan')) {
            $query->menahan();
        }

        // Yang terlambat adalah pertanyaan pertama pengelola alat setiap pagi.
        if ($request->boolean('terlambat')) {
            $query->where('status', 'dipinjam')->where('selesai', '<', now());
        }

        return EquipmentLoanResource::collection($query->paginate(25));
    }

    public function store(StoreEquipmentLoanRequest $request): JsonResponse
    {
        $pinjaman = $this->peminjaman->ajukan($request->validated(), $request->user());

        return EquipmentLoanResource::make($pinjaman->load('asset:id,nama,kode_internal,bmn_id'))
            ->response()->setStatusCode(201);
    }

    public function show(EquipmentLoan $peminjaman): EquipmentLoanResource
    {
        return EquipmentLoanResource::make(
            $peminjaman->load(['asset:id,nama,kode_internal,bmn_id', 'user:id,name'])
        );
    }

    /** Serah terima: alat diambil peminjam. */
    public function serahkan(EquipmentLoan $peminjaman): EquipmentLoanResource
    {
        return EquipmentLoanResource::make(
            $this->peminjaman->serahkan($peminjaman)->load('asset:id,nama,kode_internal,bmn_id')
        );
    }

    /** Pengembalian, sekaligus mencatat kondisi alat saat kembali. */
    public function kembalikan(
        KembalikanPinjamanRequest $request,
        EquipmentLoan $peminjaman,
        AssetService $aset,
    ): EquipmentLoanResource {
        $hasil = $this->peminjaman->kembalikan(
            $peminjaman,
            $request->string('kondisi')->toString() ?: null,
            $request->string('catatan')->toString() ?: null,
            $aset,
            $request->user(),
        );

        return EquipmentLoanResource::make($hasil->load('asset:id,nama,kode_internal,bmn_id'));
    }
}
