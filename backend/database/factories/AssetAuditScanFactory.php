<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\AssetAuditScan;
use App\Models\AssetAuditSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetAuditScan> */
class AssetAuditScanFactory extends Factory
{
    protected $model = AssetAuditScan::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'asset_audit_session_id' => AssetAuditSession::factory(),
            'asset_id' => Asset::factory(),
            'lokasi_tercatat' => 'Gedung A / LAB-001',
            'lokasi_ditemukan' => 'Gedung A / LAB-001',
            'kondisi_tercatat' => 'B',
            'kondisi_ditemukan' => 'B',
            'dipindai_pada' => now(),
        ];
    }

    public function lokasiBerbeda(): static
    {
        return $this->state(fn () => ['lokasi_ditemukan' => 'Gudang Pusat']);
    }

    public function kondisiBerbeda(): static
    {
        return $this->state(fn () => ['kondisi_ditemukan' => 'RR']);
    }
}
