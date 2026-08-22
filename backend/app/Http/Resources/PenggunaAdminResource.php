<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 *
 * Sumber daya khusus admin — beda dari PenggunaResource (identitas diri
 * sendiri). Boleh menyebut aktif/tidaknya pengguna lain dan gedung yang
 * diampu, karena hanya dipakai layar yang sudah dijaga izin `pengguna.*`.
 */
class PenggunaAdminResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->name,
            'email' => $this->email,
            'unit_kerja' => $this->unit_kerja,
            'aktif' => $this->aktif,
            'peran' => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')->all()),
            'gedung' => $this->whenLoaded('gedung', fn () => $this->gedung->pluck('gedung')->all()),
            'dibuat_pada' => $this->created_at?->toIso8601String(),
        ];
    }
}
