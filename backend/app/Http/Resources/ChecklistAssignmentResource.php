<?php

namespace App\Http\Resources;

use App\Models\ChecklistAssignment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ChecklistAssignment */
class ChecklistAssignmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'periode' => ['kode' => $this->periode, 'nama' => ChecklistAssignment::PERIODE[$this->periode] ?? $this->periode],
            'aktif' => $this->aktif,
            'templat' => $this->whenLoaded('template', fn () => [
                'id' => $this->template->id,
                'nama' => $this->template->nama,
                'jenis' => $this->template->jenisNama(),
            ]),
            'sumber_daya' => $this->sumberDayaRingkas(),
            'penanggung_jawab' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id, 'nama' => $this->user->name,
            ]),
        ];
    }
}
