<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 *
 * Sengaja TIDAK memuat `password`, `remember_token`, maupun kolom internal
 * lain. Model sudah menyembunyikannya lewat $hidden, tetapi sumber daya ini
 * menyebut kolomnya satu per satu sebagai lapis kedua — sehingga kolom
 * sensitif yang ditambahkan kelak tidak ikut bocor hanya karena lupa
 * dimasukkan ke $hidden.
 */
class PenggunaResource extends JsonResource
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
            'peran' => $this->whenLoaded('roles', fn () => $this->roles->pluck('name')->all()),
            'izin' => $this->when(
                $request->user()?->is($this->resource) ?? false,
                fn () => $this->getAllPermissions()->pluck('name')->sort()->values()->all(),
            ),
        ];
    }
}
