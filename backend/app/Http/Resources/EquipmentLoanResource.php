<?php

namespace App\Http\Resources;

use App\Models\Asset;
use App\Models\EquipmentLoan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EquipmentLoan */
class EquipmentLoanResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'keperluan' => $this->keperluan,
            'lokasi_pemakaian' => $this->lokasi_pemakaian,
            'unit_kerja' => $this->unit_kerja,
            'jadwal' => [
                'mulai' => $this->mulai?->toIso8601String(),
                'selesai' => $this->selesai?->toIso8601String(),
            ],
            'serah_terima' => [
                'diambil_pada' => $this->diambil_pada?->toIso8601String(),
                'dikembalikan_pada' => $this->dikembalikan_pada?->toIso8601String(),
            ],
            'status' => [
                'kode' => $this->status,
                'nama' => EquipmentLoan::STATUS[$this->status] ?? $this->status,
            ],
            'terlambat' => $this->terlambat(),
            'kondisi_saat_kembali' => $this->kondisi_saat_kembali
                ? [
                    'kode' => $this->kondisi_saat_kembali,
                    'nama' => Asset::KONDISI[$this->kondisi_saat_kembali] ?? $this->kondisi_saat_kembali,
                ]
                : null,
            'alat' => $this->whenLoaded('asset', fn () => [
                'id' => $this->asset->id,
                'nama' => $this->asset->nama,
                'kode_internal' => $this->asset->kode_internal,
                'bmn_id' => $this->asset->bmn_id,
            ]),
            'peminjam' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'nama' => $this->user->name,
            ]),
            'catatan' => $this->catatan,
        ];
    }
}
