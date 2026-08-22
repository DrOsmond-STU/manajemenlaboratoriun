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
            // Hanya terisi pada feed gabungan lintas aset (mutasiSemua());
            // panggilan riwayat() per-aset tidak memuat relasi ini karena
            // asetnya sudah diketahui dari konteks layar.
            'aset' => $this->whenLoaded('asset', fn () => $this->asset ? [
                'id' => $this->asset->id,
                'nama' => $this->asset->nama,
                'kode_internal' => $this->asset->kode_internal,
            ] : null),
        ];
    }
}
