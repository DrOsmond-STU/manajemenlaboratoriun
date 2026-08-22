<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MulaiChecklistRequest;
use App\Http\Requests\StoreChecklistAssignmentRequest;
use App\Http\Requests\StoreChecklistTemplateRequest;
use App\Http\Resources\ChecklistAssignmentResource;
use App\Http\Resources\ChecklistRunResource;
use App\Http\Resources\ChecklistTemplateResource;
use App\Models\ChecklistAssignment;
use App\Models\ChecklistRun;
use App\Models\ChecklistTemplate;
use App\Services\ChecklistService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class ChecklistController extends Controller
{
    public function __construct(private readonly ChecklistService $checklist) {}

    // --- Templat ------------------------------------------------------------

    public function daftarTemplat(Request $request): AnonymousResourceCollection
    {
        $query = ChecklistTemplate::query()
            ->withCount(['items', 'assignments'])
            ->with('pembuat:id,name')
            ->orderBy('nama');

        if ($request->filled('jenis')) {
            $query->where('jenis', $request->string('jenis')->toString());
        }

        if ($request->boolean('hanya_aktif')) {
            $query->aktif();
        }

        return ChecklistTemplateResource::collection($query->paginate(50));
    }

    public function buatTemplat(StoreChecklistTemplateRequest $request): JsonResponse
    {
        $data = $request->validated();

        $templat = DB::transaction(function () use ($data, $request) {
            $templat = ChecklistTemplate::create([
                'nama' => $data['nama'],
                'jenis' => $data['jenis'],
                'deskripsi' => $data['deskripsi'] ?? null,
                'aktif' => $data['aktif'] ?? true,
                'dibuat_oleh' => $request->user()->id,
            ]);

            foreach (array_values($data['items']) as $i => $butir) {
                $templat->items()->create([
                    'urutan' => $i + 1,
                    'teks' => $butir['teks'],
                    'tipe' => $butir['tipe'] ?? 'ya_tidak',
                    'wajib' => $butir['wajib'] ?? true,
                    'pilihan' => $butir['pilihan'] ?? null,
                    'satuan' => $butir['satuan'] ?? null,
                    'petunjuk' => $butir['petunjuk'] ?? null,
                ]);
            }

            return $templat;
        });

        return ChecklistTemplateResource::make($templat->load('items')->loadCount('items'))
            ->response()->setStatusCode(201);
    }

    public function lihatTemplat(ChecklistTemplate $templat): ChecklistTemplateResource
    {
        return ChecklistTemplateResource::make(
            $templat->load(['items', 'pembuat:id,name'])->loadCount(['items', 'assignments'])
        );
    }

    // --- Penugasan ------------------------------------------------------------

    public function tugaskan(StoreChecklistAssignmentRequest $request): JsonResponse
    {
        $penugasan = ChecklistAssignment::create($request->validated());

        return ChecklistAssignmentResource::make(
            $penugasan->load(['template', 'user:id,name', 'room:id,nama', 'laboratory:id,nama', 'asset:id,nama'])
        )->response()->setStatusCode(201);
    }

    /**
     * Checklist yang menjadi tanggung jawab saya.
     *
     * Inilah wujud "checklist melekat pada user": daftar yang menjawab
     * pertanyaan "apa yang harus saya kerjakan" tanpa perlu menelusuri
     * seluruh templat yang ada.
     */
    public function tugasSaya(Request $request): AnonymousResourceCollection
    {
        $query = ChecklistAssignment::query()
            ->where('user_id', $request->user()->id)
            ->aktif()
            ->with(['template', 'room:id,nama', 'laboratory:id,nama', 'asset:id,nama', 'user:id,name']);

        return ChecklistAssignmentResource::collection($query->paginate(50));
    }

    // --- Pelaksanaan ------------------------------------------------------------

    public function mulai(MulaiChecklistRequest $request): JsonResponse
    {
        $templat = ChecklistTemplate::findOrFail($request->integer('checklist_template_id'));

        $run = $this->checklist->mulai($templat, $request->sumberDaya(), $request->user());

        return ChecklistRunResource::make($run->load('template.items'))
            ->response()->setStatusCode(201);
    }

    public function jawab(Request $request, ChecklistRun $pelaksanaan): JsonResponse
    {
        $data = $request->validate([
            'checklist_item_id' => ['required', 'integer'],
            'nilai' => ['nullable', 'string', 'max:300'],
            'catatan' => ['nullable', 'string', 'max:1000'],
        ]);

        $this->checklist->jawab(
            $pelaksanaan,
            $data['checklist_item_id'],
            $data['nilai'] ?? null,
            $data['catatan'] ?? null,
        );

        return response()->json(['pesan' => 'Jawaban tersimpan.']);
    }

    public function selesaikan(Request $request, ChecklistRun $pelaksanaan): ChecklistRunResource
    {
        $data = $request->validate(['catatan' => ['nullable', 'string', 'max:2000']]);

        $hasil = $this->checklist->selesaikan($pelaksanaan, $data['catatan'] ?? null);

        return ChecklistRunResource::make(
            $hasil->load(['template', 'answers', 'user:id,name'])
        );
    }

    public function daftarPelaksanaan(Request $request): AnonymousResourceCollection
    {
        $query = ChecklistRun::query()
            ->with(['template', 'user:id,name', 'room:id,nama', 'laboratory:id,nama', 'asset:id,nama'])
            ->latest('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->boolean('milik_saya')) {
            $query->where('user_id', $request->user()->id);
        }

        if ($request->filled(['jenis_sumber_daya', 'sumber_daya_id'])) {
            $query->untukSumberDaya(
                $request->string('jenis_sumber_daya')->toString(),
                $request->integer('sumber_daya_id'),
            );
        }

        return ChecklistRunResource::collection($query->paginate(50));
    }

    public function lihatPelaksanaan(ChecklistRun $pelaksanaan): ChecklistRunResource
    {
        return ChecklistRunResource::make(
            $pelaksanaan->load(['template.items', 'answers', 'user:id,name',
                'room:id,nama', 'laboratory:id,nama', 'asset:id,nama'])
        );
    }
}
