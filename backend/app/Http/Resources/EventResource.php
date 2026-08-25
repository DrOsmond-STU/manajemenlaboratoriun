<?php

namespace App\Http\Resources;

use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Event */
class EventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'jenis' => $this->jenis,
            'organizer' => $this->organizer,
            'pic' => $this->whenLoaded('pic', fn () => $this->pic ? [
                'id' => $this->pic->id,
                'nama' => $this->pic->name,
            ] : null),
            'ruangan' => $this->whenLoaded('room', fn () => $this->room ? [
                'id' => $this->room->id,
                'kode' => $this->room->kode,
                'nama' => $this->room->nama,
            ] : null),
            'tanggal' => $this->tanggal?->toDateString(),
            'jumlah_peserta' => $this->jumlah_peserta,
            'anggaran' => $this->anggaran,
            'status' => ['kode' => $this->status, 'nama' => Event::STATUS[$this->status] ?? $this->status],
            'catatan' => $this->catatan,

            // Hanya ada bila diminta lewat ?dengan_peserta=1 (lihat
            // EventController::index). isset($this->resource->...), BUKAN
            // whenCounted() — count beralias ('participants as
            // peserta_hadir_count') tidak dikenali whenCounted(), dan
            // AssetAuditSessionResource pernah salah pada pola serupa
            // dengan $this->attributes langsung.
            'jumlah_peserta_terdaftar' => $this->when(isset($this->resource->participants_count), fn () => $this->resource->participants_count),
            'jumlah_peserta_hadir' => $this->when(isset($this->resource->peserta_hadir_count), fn () => $this->resource->peserta_hadir_count),
        ];
    }
}
