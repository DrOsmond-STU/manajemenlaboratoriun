<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEventRequest;
use App\Http\Requests\UpdateEventRequest;
use App\Http\Resources\EventResource;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EventController extends Controller
{
    private const RELASI = ['pic:id,name', 'room:id,kode,nama'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Event::query()
            ->with(self::RELASI)
            ->orderByDesc('tanggal')
            ->orderByDesc('id');

        if ($request->filled('cari')) {
            $query->cari($request->string('cari')->toString());
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('jenis')) {
            $query->where('jenis', $request->string('jenis')->toString());
        }

        // Opsional: Laporan Event butuh jumlah peserta terdaftar/hadir per
        // baris untuk menghitung tingkat kehadiran. Query TAMBAHAN ini
        // (dua withCount) hanya dijalankan bila diminta — Manajemen Event
        // sendiri tidak memerlukannya dan tidak boleh menanggung biayanya.
        // Pola yang sama dengan AssetController menyertakan `wajib_kalibrasi`
        // hanya ketika parameternya dikirim.
        if ($request->boolean('dengan_peserta')) {
            $query->withCount([
                'participants',
                'participants as peserta_hadir_count' => fn ($q) => $q->where('status', 'hadir'),
            ]);
        }

        return EventResource::collection($query->paginate(50));
    }

    public function store(StoreEventRequest $request): JsonResponse
    {
        $event = Event::create([
            ...$request->validated(),
            'status' => 'direncanakan',
            'dibuat_oleh' => $request->user()?->id,
        ]);

        return EventResource::make($event->load(self::RELASI))->response()->setStatusCode(201);
    }

    public function update(UpdateEventRequest $request, Event $acara): EventResource
    {
        $acara->update($request->validated());

        return EventResource::make($acara->load(self::RELASI));
    }
}
