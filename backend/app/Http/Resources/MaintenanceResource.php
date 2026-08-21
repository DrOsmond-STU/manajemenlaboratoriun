<?php

namespace App\Http\Resources;

use App\Models\AssetMaintenance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AssetMaintenance */
class MaintenanceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'jenis' => ['kode' => $this->jenis, 'nama' => $this->jenisNama()],
            'status' => [
                'kode' => $this->status,
                'nama' => AssetMaintenance::STATUS[$this->status] ?? $this->status,
            ],
            'jadwal' => $this->jadwal?->toDateString(),
            'dikerjakan_pada' => $this->dikerjakan_pada?->toDateString(),
            'terlambat' => $this->terlambat(),
            'pelaksana' => $this->pelaksana,
            'hasil' => $this->hasil,
            'biaya' => $this->biaya,
            'kalibrasi' => $this->when($this->jenis === AssetMaintenance::JENIS_KALIBRASI, fn () => [
                'no_sertifikat' => $this->no_sertifikat,
                'lembaga' => $this->lembaga_kalibrasi,
                'berlaku_sampai' => $this->berlaku_sampai?->toDateString(),
                'kedaluwarsa' => $this->berlaku_sampai?->isPast() ?? null,
            ]),
            'alat' => $this->whenLoaded('asset', fn () => [
                'id' => $this->asset->id,
                'nama' => $this->asset->nama,
                'kode_internal' => $this->asset->kode_internal,
            ]),
            'petugas' => $this->whenLoaded('petugas', fn () => $this->petugas ? [
                'id' => $this->petugas->id,
                'nama' => $this->petugas->name,
            ] : null),
            'catatan' => $this->catatan,
        ];
    }
}
