<?php

namespace App\Http\Resources;

use App\Models\Visitor;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Visitor */
class VisitorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'instansi' => $this->instansi,
            'tujuan' => $this->tujuan,
            'host' => $this->whenLoaded('host', fn () => $this->host ? [
                'id' => $this->host->id,
                'nama' => $this->host->name,
            ] : null),
            'ruangan' => $this->whenLoaded('room', fn () => $this->room ? [
                'id' => $this->room->id,
                'kode' => $this->room->kode,
                'nama' => $this->room->nama,
            ] : null),
            'tanggal' => $this->tanggal?->toDateString(),
            'masuk_pada' => $this->masuk_pada?->toIso8601String(),
            'keluar_pada' => $this->keluar_pada?->toIso8601String(),
            'badge' => $this->badge,
            'status' => ['kode' => $this->status, 'nama' => Visitor::STATUS[$this->status] ?? $this->status],
            'catatan' => $this->catatan,
        ];
    }
}
