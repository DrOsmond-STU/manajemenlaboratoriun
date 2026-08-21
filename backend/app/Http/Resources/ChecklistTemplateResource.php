<?php

namespace App\Http\Resources;

use App\Models\ChecklistTemplate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ChecklistTemplate */
class ChecklistTemplateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'jenis' => ['kode' => $this->jenis, 'nama' => $this->jenisNama()],
            'deskripsi' => $this->deskripsi,
            'aktif' => $this->aktif,
            'jumlah_butir' => $this->whenCounted('items'),
            'jumlah_penugasan' => $this->whenCounted('assignments'),
            'butir' => ChecklistItemResource::collection($this->whenLoaded('items')),
            'dibuat_oleh' => $this->whenLoaded('pembuat', fn () => $this->pembuat ? [
                'id' => $this->pembuat->id, 'nama' => $this->pembuat->name,
            ] : null),
        ];
    }
}
