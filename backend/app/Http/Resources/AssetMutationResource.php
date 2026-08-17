<?php

namespace App\Http\Resources;

use App\Models\AssetMutation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AssetMutation */
class AssetMutationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'jenis' => $this->jenis,
            'jenis_nama' => $this->jenisNama(),
            'dari' => $this->nilai_lama,
            'ke' => $this->nilai_baru,
            'catatan' => $this->catatan,
            'waktu' => $this->created_at?->toIso8601String(),
            'oleh' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'nama' => $this->user->name,
            ] : null),
        ];
    }
}
