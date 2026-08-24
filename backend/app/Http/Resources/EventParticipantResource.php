<?php

namespace App\Http\Resources;

use App\Models\EventParticipant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EventParticipant */
class EventParticipantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event_id' => $this->event_id,
            'nama' => $this->nama,
            'instansi' => $this->instansi,
            'email' => $this->email,
            'telepon' => $this->telepon,
            'status' => ['kode' => $this->status, 'nama' => EventParticipant::STATUS[$this->status] ?? $this->status],
            'hadir_pada' => $this->hadir_pada?->toIso8601String(),
            'catatan' => $this->catatan,
        ];
    }
}
