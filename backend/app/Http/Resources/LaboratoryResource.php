<?php

namespace App\Http\Resources;

use App\Models\Laboratory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Laboratory */
class LaboratoryResource extends JsonResource
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
            'unit_kerja' => $this->unit_kerja,
            'luas_m2' => $this->luas_m2,
            'kapasitas' => $this->kapasitas,
            'jam_layanan' => $this->jam_layanan,
            'akreditasi' => $this->akreditasi,

            // Selalu larik, tidak pernah null — antarmuka yang memanggil
            // .map() pada null akan patah, dan "belum ada fasilitas" paling
            // tepat diwakili larik kosong.
            'fasilitas' => $this->fasilitas ?? [],
            'status' => [
                'kode' => $this->status,
                'nama' => Laboratory::STATUS[$this->status] ?? $this->status,
            ],
            'ruangan' => $this->whenLoaded('room', fn () => $this->room ? [
                'id' => $this->room->id,
                'kode' => $this->room->kode,
                'nama' => $this->room->nama,
                'gedung' => $this->room->gedung,
            ] : null),
            'penanggung_jawab' => $this->whenLoaded('penanggungJawab', fn () => $this->penanggungJawab ? [
                'id' => $this->penanggungJawab->id,
                'nama' => $this->penanggungJawab->name,
            ] : null),
            'supervisor' => $this->whenLoaded('supervisor', fn () => $this->supervisor ? [
                'id' => $this->supervisor->id,
                'nama' => $this->supervisor->name,
            ] : null),
            'teknisi' => $this->whenLoaded(
                'teknisi',
                fn () => $this->teknisi->map(fn ($t) => ['id' => $t->id, 'nama' => $t->name])->values(),
            ),
            'jumlah_aset' => $this->whenCounted('assets'),
            'keterangan' => $this->keterangan,
        ];
    }
}
