<?php

namespace App\Http\Resources;

use App\Models\Asset;
use App\Models\AssetAuditScan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AssetAuditScan */
class AssetAuditScanResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $temuan = $this->temuan();

        return [
            'id' => $this->id,
            'aset' => $this->whenLoaded('asset', fn () => $this->asset ? [
                'id' => $this->asset->id,
                'nama' => $this->asset->nama,
                'kode_internal' => $this->asset->kode_internal,
                'bmn_id' => $this->asset->bmn_id,
            ] : null),
            'lokasi' => [
                'tercatat' => $this->lokasi_tercatat,
                'ditemukan' => $this->lokasi_ditemukan,
            ],
            'kondisi' => [
                'tercatat' => ['kode' => $this->kondisi_tercatat, 'nama' => Asset::KONDISI[$this->kondisi_tercatat] ?? null],
                'ditemukan' => ['kode' => $this->kondisi_ditemukan, 'nama' => Asset::KONDISI[$this->kondisi_ditemukan] ?? null],
            ],
            'temuan' => ['kode' => $temuan, 'nama' => AssetAuditScan::TEMUAN[$temuan]],
            'auditor' => $this->whenLoaded('auditor', fn () => $this->auditor ? [
                'id' => $this->auditor->id,
                'nama' => $this->auditor->name,
            ] : null),
            'dipindai_pada' => $this->dipindai_pada?->toIso8601String(),
            'catatan' => $this->catatan,
        ];
    }
}
