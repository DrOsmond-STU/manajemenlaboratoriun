<?php

namespace Database\Factories;

use App\Models\Event;
use App\Models\EventParticipant;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<EventParticipant> */
class EventParticipantFactory extends Factory
{
    protected $model = EventParticipant::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'nama' => $this->faker->name(),
            'instansi' => $this->faker->company(),
            'email' => $this->faker->safeEmail(),
            'telepon' => $this->faker->phoneNumber(),
            'status' => 'terdaftar',
        ];
    }

    public function hadir(): static
    {
        return $this->state(fn () => ['status' => 'hadir', 'hadir_pada' => now()]);
    }

    public function tidakHadir(): static
    {
        return $this->state(fn () => ['status' => 'tidak_hadir']);
    }
}
