<?php

namespace App\Http\Resources;

use App\Models\ChecklistItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ChecklistItem */
class ChecklistItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'urutan' => $this->urutan,
            'teks' => $this->teks,
            'tipe' => ['kode' => $this->tipe, 'nama' => ChecklistItem::TIPE[$this->tipe] ?? $this->tipe],
            'wajib' => $this->wajib,
            'pilihan' => $this->pilihan,
            'satuan' => $this->satuan,
            'petunjuk' => $this->petunjuk,
        ];
    }
}
