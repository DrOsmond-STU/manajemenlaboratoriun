<?php

namespace App\Http\Resources;

use App\Models\Tariff;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Tariff */
class TariffResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'jenis' => ['kode' => $this->jenis, 'nama' => Tariff::JENIS[$this->jenis] ?? $this->jenis],
            'sumber_daya' => $this->sumberDayaRingkas(),
            'satuan_waktu' => ['kode' => $this->satuan_waktu, 'nama' => Tariff::SATUAN[$this->satuan_waktu] ?? $this->satuan_waktu],
            'harga' => $this->harga,
            'segmen' => ['kode' => $this->segmen, 'nama' => Tariff::SEGMEN[$this->segmen] ?? $this->segmen],
            'deskripsi' => $this->deskripsi,
            'kapasitas' => $this->kapasitas,
            'aktif' => $this->aktif,
        ];
    }
}
