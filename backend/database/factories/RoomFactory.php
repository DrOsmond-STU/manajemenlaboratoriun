<?php

namespace Database\Factories;

use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Room> */
class RoomFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'kode' => 'RM-'.$this->faker->unique()->numberBetween(1000, 9999),
            'nama' => 'Ruang '.$this->faker->word(),
            'gedung' => 'Gedung '.$this->faker->randomElement(['A', 'B', 'C']),
            'lantai' => (string) $this->faker->numberBetween(1, 5),
            'kapasitas' => $this->faker->numberBetween(10, 200),
            'status' => 'tersedia',
            'perlu_persetujuan' => false,
        ];
    }
}
