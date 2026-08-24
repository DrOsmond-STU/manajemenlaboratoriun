<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEventParticipantRequest;
use App\Http\Resources\EventParticipantResource;
use App\Models\Event;
use App\Models\EventParticipant;
use App\Services\EventParticipantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EventParticipantController extends Controller
{
    public function __construct(private readonly EventParticipantService $peserta) {}

    public function index(Request $request, Event $acara): AnonymousResourceCollection
    {
        $query = $acara->participants()->orderBy('nama');

        if ($request->filled('cari')) {
            $query->cari($request->string('cari')->toString());
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        return EventParticipantResource::collection($query->get());
    }

    public function store(StoreEventParticipantRequest $request, Event $acara): JsonResponse
    {
        $peserta = $this->peserta->daftarkan($acara, $request->validated());

        return EventParticipantResource::make($peserta)->response()->setStatusCode(201);
    }

    public function hadir(EventParticipant $peserta): EventParticipantResource
    {
        return EventParticipantResource::make($this->peserta->tandaiHadir($peserta));
    }

    public function tidakHadir(EventParticipant $peserta): EventParticipantResource
    {
        return EventParticipantResource::make($this->peserta->tandaiTidakHadir($peserta));
    }
}
