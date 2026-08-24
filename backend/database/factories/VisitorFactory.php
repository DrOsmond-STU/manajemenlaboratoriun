<?php

namespace Database\Factories;

use App\Models\Visitor;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Visitor> */
class VisitorFactory extends Factory
{
    protected $model = Visitor::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama' => $this->faker->name(),
            'instansi' => $this->faker->company(),
            'tujuan' => $this->faker->randomElement(['Audit Supplier', 'Survei Lokasi', 'Instalasi Perangkat', 'Kunjungan Kerja']),
            'tanggal' => now()->toDateString(),
            'status' => 'terjadwal',
        ];
    }

    public function diDalam(): static
    {
        return $this->state(fn () => ['status' => 'di_dalam', 'masuk_pada' => now(), 'badge' => 'V-'.$this->faker->numberBetween(100, 999)]);
    }

    public function selesai(): static
    {
        return $this->state(fn () => [
            'status' => 'selesai',
            'masuk_pada' => now()->subHours(2),
            'keluar_pada' => now(),
            'badge' => 'V-'.$this->faker->numberBetween(100, 999),
        ]);
    }
}
