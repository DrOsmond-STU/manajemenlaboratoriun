<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/** @extends Factory<\App\Models\Booking> */
class BookingFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $mulai = Carbon::tomorrow()->setHour(8);

        return [
            'room_id' => Room::factory(),
            'user_id' => User::factory(),
            'keperluan' => $this->faker->sentence(3),
            'jumlah_peserta' => $this->faker->numberBetween(1, 50),
            'mulai' => $mulai,
            'selesai' => $mulai->copy()->addHours(2),
            'status' => 'menunggu',
        ];
    }

    public function pada(string $mulai, string $selesai): static
    {
        return $this->state(fn () => ['mulai' => $mulai, 'selesai' => $selesai]);
    }

    public function dibatalkan(): static
    {
        return $this->state(fn () => ['status' => 'dibatalkan']);
    }
}
