<?php

namespace App\Http\Resources;

use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Room */
class RoomResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kode' => $this->kode,
            'nama' => $this->nama,
            'gedung' => $this->gedung,
            'lantai' => $this->lantai,
            'kapasitas' => $this->kapasitas,
            'status' => $this->status,
            'perlu_persetujuan' => $this->perlu_persetujuan,
            'jumlah_booking_aktif' => $this->whenCounted('bookingsAktif'),
        ];
    }
}
