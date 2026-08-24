<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckInVisitorRequest;
use App\Http\Requests\StoreVisitorRequest;
use App\Http\Resources\VisitorResource;
use App\Models\Visitor;
use App\Services\VisitorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class VisitorController extends Controller
{
    private const RELASI = ['host:id,name', 'room:id,kode,nama'];

    public function __construct(private readonly VisitorService $pengunjung) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Visitor::query()
            ->with(self::RELASI)
            ->orderByDesc('tanggal')
            ->orderByDesc('id');

        if ($request->filled('cari')) {
            $query->cari($request->string('cari')->toString());
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('tanggal')) {
            $query->where('tanggal', $request->date('tanggal'));
        }

        return VisitorResource::collection($query->paginate(50));
    }

    public function store(StoreVisitorRequest $request): JsonResponse
    {
        $tamu = $this->pengunjung->daftarkan($request->validated(), $request->user()?->id);

        return VisitorResource::make($tamu->load(self::RELASI))->response()->setStatusCode(201);
    }

    public function checkIn(CheckInVisitorRequest $request, Visitor $pengunjung): VisitorResource
    {
        $tamu = $this->pengunjung->checkIn($pengunjung, $request->validated());

        return VisitorResource::make($tamu->load(self::RELASI));
    }

    public function checkOut(Visitor $pengunjung): VisitorResource
    {
        $tamu = $this->pengunjung->checkOut($pengunjung);

        return VisitorResource::make($tamu->load(self::RELASI));
    }
}
