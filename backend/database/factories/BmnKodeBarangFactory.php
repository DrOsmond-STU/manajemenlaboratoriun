<?php

namespace Database\Factories;

use App\Models\BmnKodeBarang;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BmnKodeBarang>
 */
class BmnKodeBarangFactory extends Factory
{
    protected $model = BmnKodeBarang::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // Golongan 3 (Peralatan dan Mesin) bidang 08 (Alat Laboratorium) —
        // cakupan yang relevan untuk sistem ini.
        $kode = sprintf(
            '3.08.%02d.%02d.%03d',
            $this->faker->numberBetween(1, 12),
            $this->faker->numberBetween(1, 30),
            $this->faker->unique()->numberBetween(1, 999),
        );

        return [
            'kode' => $kode,
            'uraian' => $this->faker->randomElement([
                'Chromatography Set', 'Spectrophotometer', 'Autoclave', 'Microscope',
                'Analytical Balance', 'Centrifuge', 'Water Bath', 'Fume Hood',
            ]),
            'masa_manfaat' => $this->faker->randomElement([4, 5, 8, 10, 15]),
        ];
    }

    /** Kode barang dengan nilai tertentu, untuk uji yang bergantung pada kodenya. */
    public function kode(string $kode): static
    {
        return $this->state(fn () => ['kode' => $kode]);
    }

    public function masaManfaat(int $tahun): static
    {
        return $this->state(fn () => ['masa_manfaat' => $tahun]);
    }
}
