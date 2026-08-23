<?php

namespace App\Http\Resources;

use App\Models\AssetAuditSession;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AssetAuditSession */
class AssetAuditSessionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'mulai' => $this->mulai?->toDateString(),
            'target_selesai' => $this->target_selesai?->toDateString(),
            'status' => ['kode' => $this->status, 'nama' => AssetAuditSession::STATUS[$this->status] ?? $this->status],
            'selesai_pada' => $this->selesai_pada?->toIso8601String(),
            'pembuat' => $this->whenLoaded('pembuat', fn () => $this->pembuat ? [
                'id' => $this->pembuat->id,
                'nama' => $this->pembuat->name,
            ] : null),
            'catatan' => $this->catatan,
            // Diisi controller lewat setAttribute() saat show() — bukan
            // relasi Eloquent biasa, karena ringkasan ini agregat lintas
            // SELURUH populasi aset dalam cakupan, bukan sesuatu yang bisa
            // dimuat lewat with().
            'ringkasan' => $this->when(isset($this->resource->ringkasan), fn () => $this->resource->ringkasan),
            // Hanya baris yang MENYIMPANG dari catatan — "sesuai" tidak
            // butuh baris tersendiri di sini, angkanya sudah ada di
            // ringkasan.sesuai. Menampilkan seluruh baris "Sesuai" akan
            // menenggelamkan temuan yang justru perlu ditindaklanjuti.
            'temuan' => $this->whenLoaded('scans', fn () => AssetAuditScanResource::collection(
                $this->scans->filter(fn ($s) => $s->temuan() !== 'sesuai')->values()
            )),
        ];
    }
}
