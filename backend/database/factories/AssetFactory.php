<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Support\Satker;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Asset>
 *
 * Catatan: factory ini menulis `nup` langsung, melewati NupAllocator. Itu
 * disengaja agar uji dapat menyusun keadaan tertentu — termasuk keadaan yang
 * salah — tanpa harus lewat jalur pendaftaran. Untuk uji yang menguji
 * pemberian NUP itu sendiri, pakai AssetService, bukan factory ini.
 */
class AssetFactory extends Factory
{
    protected $model = Asset::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $tahun = $this->faker->numberBetween(2015, 2024);

        return [
            'kode_lokasi' => Satker::kodeLokasi(),
            'kode_barang' => BmnKodeBarang::factory(),
            'nup' => $this->faker->unique()->numberBetween(1, 99999),
            'kode_internal' => 'STU/LAB/'.strtoupper($this->faker->unique()->bothify('??##??##')),
            'nama' => $this->faker->randomElement(['HPLC', 'Spektrofotometer UV-Vis', 'Autoklaf', 'Mikroskop']),
            'merk' => $this->faker->randomElement(['Shimadzu', 'Thermo Fisher', 'Agilent', 'Olympus']),
            'tipe' => strtoupper($this->faker->bothify('??-####')),
            'serial_number' => strtoupper($this->faker->bothify('???-##-#####')),
            'cara_perolehan' => 'Pembelian',
            'tgl_perolehan' => $this->faker->dateTimeBetween("{$tahun}-01-01", "{$tahun}-12-31")->format('Y-m-d'),
            'sumber_dana' => 'APBN — Rupiah Murni',
            'kuantitas' => 1,
            'satuan' => 'Unit',
            'nilai_perolehan' => $this->faker->numberBetween(5_000_000, 2_000_000_000),
            'masa_manfaat' => 8,
            'kondisi' => 'B',
            'status_penggunaan' => 'Digunakan untuk Operasional Satker',
        ];
    }

    /** Aset dengan kode barang tertentu — agar NUP-nya berjalan pada deret yang sama. */
    public function kodeBarang(string $kode): static
    {
        return $this->state(fn () => ['kode_barang' => $kode]);
    }

    public function nup(int $nup): static
    {
        return $this->state(fn () => ['nup' => $nup]);
    }

    public function rusakBerat(): static
    {
        return $this->state(fn () => ['kondisi' => 'RB']);
    }
}
