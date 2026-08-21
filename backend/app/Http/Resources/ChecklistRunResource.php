<?php

namespace App\Http\Resources;

use App\Models\ChecklistRun;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ChecklistRun */
class ChecklistRunResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => ['kode' => $this->status, 'nama' => ChecklistRun::STATUS[$this->status] ?? $this->status],
            'dimulai_pada' => $this->dimulai_pada?->toIso8601String(),
            'selesai_pada' => $this->selesai_pada?->toIso8601String(),
            'hasil' => [
                'butir_total' => $this->butir_total,
                'butir_lulus' => $this->butir_lulus,
                'skor' => $this->skor,
            ],
            'templat' => $this->whenLoaded('template', fn () => [
                'id' => $this->template->id,
                'nama' => $this->template->nama,
                'jenis' => $this->template->jenisNama(),
            ]),
            'sumber_daya' => $this->sumberDayaRingkas(),
            'pelaksana' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id, 'nama' => $this->user->name,
            ]),
            'jawaban' => $this->whenLoaded('answers', fn () => $this->answers->map(fn ($j) => [
                'butir_id' => $j->checklist_item_id,
                'nilai' => $j->nilai,
                'lulus' => $j->lulus,
                'catatan' => $j->catatan,
            ])),
            'catatan' => $this->catatan,
        ];
    }
}
