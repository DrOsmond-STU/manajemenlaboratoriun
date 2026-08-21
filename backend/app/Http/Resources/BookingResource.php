<?php

namespace App\Http\Resources;

use App\Models\Booking;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Booking */
class BookingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'keperluan' => $this->keperluan,
            'jumlah_peserta' => $this->jumlah_peserta,
            'mulai' => $this->mulai?->toIso8601String(),
            'selesai' => $this->selesai?->toIso8601String(),
            'status' => $this->status,
            'catatan' => $this->catatan,
            'persetujuan' => [
                'disetujui_pada' => $this->disetujui_pada?->toIso8601String(),
                'alasan_penolakan' => $this->alasan_penolakan,
                'oleh' => $this->whenLoaded('penyetuju', fn () => $this->penyetuju ? [
                    'id' => $this->penyetuju->id, 'nama' => $this->penyetuju->name,
                ] : null),
            ],
            'ruangan' => $this->whenLoaded('room', fn () => [
                'id' => $this->room->id,
                'kode' => $this->room->kode,
                'nama' => $this->room->nama,
            ]),
            'pemohon' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'nama' => $this->user->name,
            ]),
        ];
    }
}
