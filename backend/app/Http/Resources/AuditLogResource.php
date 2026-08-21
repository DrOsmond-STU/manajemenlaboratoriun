<?php

namespace App\Http\Resources;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AuditLog */
class AuditLogResource extends JsonResource
{
    /**
     * @return array<string,mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'peristiwa' => [
                'kode' => $this->peristiwa,
                'nama' => AuditLog::PERISTIWA[$this->peristiwa] ?? $this->peristiwa,
            ],
            'objek' => [
                'model' => $this->model,
                'id' => $this->model_id,
                'label' => $this->label,
            ],
            'pelaku' => [
                'id' => $this->user_id,
                // Nama yang disalin saat peristiwa terjadi, bukan nama
                // sekarang: bila pengguna berganti nama atau dihapus, yang
                // benar bagi pemeriksa adalah nama pada saat kejadian.
                'nama' => $this->nama_pelaku,
            ],
            'sebelum' => $this->sebelum,
            'sesudah' => $this->sesudah,
            'ip' => $this->ip,
            'rute' => $this->rute,
            'waktu' => $this->created_at?->toIso8601String(),
        ];
    }
}
