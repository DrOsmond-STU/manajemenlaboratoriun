<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\AssetMaintenance;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetMaintenance> */
class AssetMaintenanceFactory extends Factory
{
    protected $model = AssetMaintenance::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'asset_id' => Asset::factory(),
            'jenis' => 'preventif',
            'jadwal' => now()->addDays($this->faker->numberBetween(1, 90))->toDateString(),
            'status' => 'dijadwalkan',
        ];
    }

    public function kalibrasi(): static
    {
        return $this->state(fn () => ['jenis' => 'kalibrasi']);
    }

    public function selesai(?string $berlakuSampai = null): static
    {
        return $this->state(fn () => [
            'status' => 'selesai',
            'dikerjakan_pada' => now()->subDay()->toDateString(),
            'no_sertifikat' => 'SERT-'.$this->faker->unique()->numberBetween(1000, 9999),
            'berlaku_sampai' => $berlakuSampai,
        ]);
    }
}
