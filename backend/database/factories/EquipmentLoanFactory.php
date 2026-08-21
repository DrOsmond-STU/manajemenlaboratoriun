<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\EquipmentLoan;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<EquipmentLoan> */
class EquipmentLoanFactory extends Factory
{
    protected $model = EquipmentLoan::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $mulai = now()->addDays($this->faker->numberBetween(1, 200))->setTime(9, 0);

        return [
            'asset_id' => Asset::factory(),
            'user_id' => User::factory(),
            'keperluan' => 'Pengujian sampel',
            'mulai' => $mulai,
            'selesai' => $mulai->copy()->addHours(4),
            'status' => 'menunggu',
        ];
    }
}
