<?php

namespace Database\Factories;

use App\Models\Laboratory;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Laboratory> */
class LaboratoryFactory extends Factory
{
    protected $model = Laboratory::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'kode' => 'LAB-'.strtoupper($this->faker->unique()->bothify('???-##')),
            'nama' => 'Laboratorium '.$this->faker->randomElement(['Kimia Analitik', 'Mikrobiologi', 'Fisika Material', 'Uji Lingkungan']),
            'jenis' => $this->faker->randomElement(['Pengujian', 'Riset', 'Kalibrasi']),
            'luas_m2' => $this->faker->numberBetween(60, 200),
            'kapasitas' => $this->faker->numberBetween(10, 30),
            'jam_layanan' => '07:30 – 17:00',
            'akreditasi' => 'ISO/IEC 17025:2017',
            'status' => 'aktif',
        ];
    }
}
