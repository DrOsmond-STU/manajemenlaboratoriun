<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLaboratoryRequest;
use App\Http\Requests\UpdateLaboratoryRequest;
use App\Http\Resources\LaboratoryResource;
use App\Models\Laboratory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class LaboratoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Laboratory::class);

        $query = Laboratory::query()
            ->dalamCakupan($request->user())
            ->with(['room:id,kode,nama,gedung', 'penanggungJawab:id,name'])
            ->withCount('assets')
            ->orderBy('kode');

        if ($request->filled('cari')) {
            $query->cari($request->string('cari')->toString());
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('jenis')) {
            $query->where('jenis', $request->string('jenis')->toString());
        }

        return LaboratoryResource::collection($query->paginate(50));
    }

    public function store(StoreLaboratoryRequest $request): JsonResponse
    {
        $this->authorize('create', Laboratory::class);

        $lab = Laboratory::create($request->validated());

        return LaboratoryResource::make($lab->load('room:id,kode,nama,gedung'))
            ->response()->setStatusCode(201);
    }

    public function show(Laboratory $laboratory): LaboratoryResource
    {
        $this->authorize('view', $laboratory);

        return LaboratoryResource::make(
            $laboratory->load(['room:id,kode,nama,gedung', 'penanggungJawab:id,name'])->loadCount('assets')
        );
    }

    public function update(UpdateLaboratoryRequest $request, Laboratory $laboratory): LaboratoryResource
    {
        $this->authorize('update', $laboratory);

        $laboratory->update($request->validated());

        return LaboratoryResource::make(
            $laboratory->load(['room:id,kode,nama,gedung', 'penanggungJawab:id,name'])->loadCount('assets')
        );
    }

    /**
     * Hapus laboratorium (hapus lunak).
     *
     * Ditolak bila masih ada aset terdaftar padanya. Kunci asing `nullOnDelete`
     * pada assets hanya bekerja saat penghapusan PERMANEN; hapus lunak
     * membiarkan `laboratory_id` menunjuk baris yang tak lagi muncul di daftar
     * mana pun — aset menjadi milik laboratorium hantu.
     */
    public function destroy(Laboratory $laboratory): JsonResponse
    {
        $this->authorize('delete', $laboratory);

        $jumlahAset = $laboratory->assets()->count();

        if ($jumlahAset > 0) {
            throw ValidationException::withMessages([
                'laboratory' => "Laboratorium masih memiliki {$jumlahAset} aset terdaftar. "
                    .'Pindahkan asetnya lebih dulu, atau ubah status laboratorium menjadi '
                    .'tidak_aktif bila hanya ingin menghentikan kegiatannya.',
            ]);
        }

        $laboratory->delete();

        return response()->json(['pesan' => 'Laboratorium dihapus.']);
    }
}
