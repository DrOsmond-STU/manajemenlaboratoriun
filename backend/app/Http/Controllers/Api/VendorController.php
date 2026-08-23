<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreVendorRequest;
use App\Http\Requests\UpdateVendorRequest;
use App\Http\Resources\VendorResource;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class VendorController extends Controller
{
    /**
     * jumlah_pekerjaan dan total_biaya dihitung SEKALI di sini lewat
     * withCount/withSum — bukan dihitung ulang per baris di tempat lain,
     * dan bukan N+1 query. Angka yang sama dipakai layar "Vendor & Mitra"
     * dan panel "Performa Vendor" pada Laporan Maintenance.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Vendor::query()
            ->withCount('maintenances')
            ->withSum('maintenances', 'biaya')
            ->orderBy('nama');

        if ($request->filled('cari')) {
            $query->cari($request->string('cari')->toString());
        }

        if ($request->filled('kategori')) {
            $query->where('kategori', $request->string('kategori')->toString());
        }

        if ($request->has('aktif')) {
            $query->where('aktif', $request->boolean('aktif'));
        }

        return VendorResource::collection($query->paginate(50));
    }

    public function store(StoreVendorRequest $request): JsonResponse
    {
        $vendor = Vendor::create([...$request->validated(), 'aktif' => true]);

        return VendorResource::make(
            $vendor->loadCount('maintenances')->loadSum('maintenances', 'biaya')
        )->response()->setStatusCode(201);
    }

    public function show(Vendor $vendor): VendorResource
    {
        return VendorResource::make(
            $vendor->loadCount('maintenances')->loadSum('maintenances', 'biaya')
        );
    }

    public function update(UpdateVendorRequest $request, Vendor $vendor): VendorResource
    {
        $vendor->update($request->validated());

        return VendorResource::make(
            $vendor->loadCount('maintenances')->loadSum('maintenances', 'biaya')
        );
    }

    /**
     * Hapus lunak lewat nonaktifkan, BUKAN hapus baris — riwayat pekerjaan
     * lama (asset_maintenances.vendor_id) tetap tertaut ke vendor yang
     * sudah tidak aktif. Menghapus barisnya akan meninggalkan riwayat yang
     * tampak seolah dikerjakan "tidak ada vendor" (nullOnDelete), padahal
     * sebenarnya vendornya ada, hanya sudah tidak dipakai lagi.
     */
    public function destroy(Vendor $vendor): JsonResponse
    {
        $vendor->update(['aktif' => false]);

        return response()->json(['pesan' => 'Vendor dinonaktifkan. Riwayat pekerjaan tetap tersimpan.']);
    }
}
