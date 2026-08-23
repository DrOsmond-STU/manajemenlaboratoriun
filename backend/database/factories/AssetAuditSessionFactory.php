<?php

namespace Database\Factories;

use App\Models\AssetAuditSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssetAuditSession> */
class AssetAuditSessionFactory extends Factory
{
    protected $model = AssetAuditSession::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama' => 'Audit '.$this->faker->unique()->words(2, true),
            'mulai' => now()->toDateString(),
            'target_selesai' => now()->addDays(14)->toDateString(),
            'status' => 'berjalan',
        ];
    }

    public function selesai(): static
    {
        return $this->state(fn () => ['status' => 'selesai', 'selesai_pada' => now()]);
    }
}
