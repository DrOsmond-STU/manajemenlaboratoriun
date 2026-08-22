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
            'status' => [
                'kode' => $this->status,
                'nama' => Booking::STATUS[$this->status] ?? $this->status,
                // Antarmuka perlu tahu apakah slotnya masih tertahan, dan itu
                // bukan sesuatu yang boleh disimpulkan sendiri dari daftar
                // kode: aturannya sama persis dengan klausa pada pemicu basis
                // data, dan menyalinnya ke peramban berarti dua salinan yang
                // akan menyimpang.
                'memblokir' => ! in_array($this->status, Booking::STATUS_TIDAK_MEMBLOKIR, true),
            ],
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
