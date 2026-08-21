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
            'jenis' => $this->jenis,
            'gedung' => $this->gedung,
            'lantai' => $this->lantai,
            'luas_m2' => $this->luas_m2,
            'kapasitas' => $this->kapasitas,

            'tarif' => [
                'skema' => $this->skema_tarif,
                // Namanya ikut dikirim supaya antarmuka tidak perlu memelihara
                // salinan daftar yang sama — salinan itu pasti menyimpang, dan
                // yang tampil lalu jadi kode mentah seperti "internal_gratis".
                'skema_nama' => Room::SKEMA_TARIF[$this->skema_tarif] ?? $this->skema_tarif,
                'nilai' => $this->tarif,
            ],

            'status' => [
                'kode' => $this->status,
                'nama' => Room::STATUS[$this->status] ?? $this->status,
            ],

            'perlu_persetujuan' => $this->perlu_persetujuan,

            'penanggung_jawab' => $this->whenLoaded(
                'penanggungJawab',
                fn () => $this->penanggungJawab
                    ? ['id' => $this->penanggungJawab->id, 'nama' => $this->penanggungJawab->name]
                    : null,
            ),

            // Selalu larik, tidak pernah null. Antarmuka yang memanggil .map()
            // pada null akan patah, dan "belum ada fasilitas" memang paling
            // tepat diwakili larik kosong.
            'tata_letak' => $this->tata_letak ?? [],
            'fasilitas' => $this->fasilitas ?? [],

            'keterangan' => $this->keterangan,
            'jumlah_booking_aktif' => $this->whenCounted('bookingsAktif'),
        ];
    }
}
