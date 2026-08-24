<?php

namespace Database\Factories;

use App\Models\Event;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Event> */
class EventFactory extends Factory
{
    protected $model = Event::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama' => $this->faker->catchPhrase(),
            'jenis' => $this->faker->randomElement(['Konferensi', 'Pelatihan', 'Gathering', 'Seremonial', 'Sosialisasi']),
            'organizer' => $this->faker->company(),
            'tanggal' => now()->addDays($this->faker->numberBetween(1, 60))->toDateString(),
            'jumlah_peserta' => $this->faker->numberBetween(20, 400),
            'anggaran' => $this->faker->numberBetween(5_000_000, 300_000_000),
            'status' => 'direncanakan',
        ];
    }

    public function terkonfirmasi(): static
    {
        return $this->state(fn () => ['status' => 'terkonfirmasi']);
    }

    public function selesai(): static
    {
        return $this->state(fn () => ['status' => 'selesai', 'tanggal' => now()->subDays(3)->toDateString()]);
    }

    public function dibatalkan(): static
    {
        return $this->state(fn () => ['status' => 'dibatalkan']);
    }
}
