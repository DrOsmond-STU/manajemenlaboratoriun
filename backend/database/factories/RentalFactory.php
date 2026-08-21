<?php

namespace Database\Factories;

use App\Models\Rental;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Rental> */
class RentalFactory extends Factory
{
    protected $model = Rental::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $mulai = now()->addDays($this->faker->numberBetween(1, 60))->setTime(8, 0);

        return [
            'penyewa' => $this->faker->name(),
            'instansi' => 'PT '.$this->faker->company(),
            'email' => $this->faker->safeEmail(),
            'mulai' => $mulai,
            'selesai' => $mulai->copy()->addHours(8),
            'segmen' => 'umum',
            'status' => 'dikonfirmasi',
        ];
    }
}
