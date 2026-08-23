<?php

namespace Database\Factories;

use App\Models\Vendor;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Vendor> */
class VendorFactory extends Factory
{
    protected $model = Vendor::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'kode' => 'VN-'.$this->faker->unique()->numberBetween(100, 999),
            'nama' => $this->faker->company(),
            'kategori' => $this->faker->randomElement(['Audio Visual', 'Katering', 'HVAC', 'Kalibrasi', 'Security']),
            'pic_nama' => $this->faker->name(),
            'pic_telepon' => $this->faker->phoneNumber(),
            'pic_email' => $this->faker->companyEmail(),
            'rating' => $this->faker->randomFloat(1, 3, 5),
            'kontrak_berlaku_sampai' => now()->addMonths($this->faker->numberBetween(1, 24))->toDateString(),
            'aktif' => true,
        ];
    }

    public function nonaktif(): static
    {
        return $this->state(fn () => ['aktif' => false]);
    }

    public function tanpaKontrakTetap(): static
    {
        return $this->state(fn () => ['kontrak_berlaku_sampai' => null]);
    }
}
