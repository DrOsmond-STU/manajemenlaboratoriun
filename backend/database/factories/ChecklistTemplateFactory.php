<?php

namespace Database\Factories;

use App\Models\ChecklistTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ChecklistTemplate> */
class ChecklistTemplateFactory extends Factory
{
    protected $model = ChecklistTemplate::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nama' => 'Checklist '.$this->faker->unique()->word(),
            'jenis' => 'pengecekan',
            'aktif' => true,
        ];
    }

    /** Templat lengkap dengan sejumlah butir ya/tidak. */
    public function denganButir(int $jumlah = 3): static
    {
        return $this->afterCreating(function (ChecklistTemplate $t) use ($jumlah) {
            for ($i = 1; $i <= $jumlah; $i++) {
                $t->items()->create([
                    'urutan' => $i,
                    'teks' => "Butir pemeriksaan {$i}",
                    'tipe' => 'ya_tidak',
                    'wajib' => true,
                ]);
            }
        });
    }
}
