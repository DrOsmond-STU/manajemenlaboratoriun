<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\BmnKodeBarang;
use App\Models\EquipmentLoan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KetersediaanAlatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
    }

    private function rentang(string $mulai, string $selesai): string
    {
        return '/api/peminjaman/ketersediaan?mulai='.urlencode($mulai).'&selesai='.urlencode($selesai);
    }

    public function test_alat_yang_sedang_dipinjam_ditandai_tidak_tersedia(): void
    {
        $alat = Asset::factory()->kodeBarang('3.08.01.03.001')->create(['nama' => 'Neraca Analitik']);
        $bebas = Asset::factory()->kodeBarang('3.08.01.03.001')->create(['nama' => 'Oven Pengering']);

        EquipmentLoan::create([
            'asset_id' => $alat->id,
            'user_id' => User::factory()->create(['name' => 'Andi'])->id,
            'keperluan' => 'Uji kadar air',
            'mulai' => '2026-09-01 09:00:00',
            'selesai' => '2026-09-01 15:00:00',
            'status' => 'dipinjam',
        ]);

        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson($this->rentang('2026-09-01 10:00:00', '2026-09-01 12:00:00'))
            ->assertOk()->json('data');

        $neraca = collect($data)->firstWhere('nama', 'Neraca Analitik');
        $oven = collect($data)->firstWhere('nama', 'Oven Pengering');

        $this->assertFalse($neraca['tersedia']);
        $this->assertSame('Sedang dipinjam pada rentang waktu ini', $neraca['alasan']);
        $this->assertSame('Andi', $neraca['bentrok'][0]['peminjam']);

        $this->assertTrue($oven['tersedia']);
    }

    public function test_pemakaian_berurutan_bukan_bentrok(): void
    {
        $alat = Asset::factory()->kodeBarang('3.08.01.03.001')->create(['nama' => 'Neraca']);

        EquipmentLoan::create([
            'asset_id' => $alat->id,
            'user_id' => User::factory()->create()->id,
            'keperluan' => 'Sesi pagi',
            'mulai' => '2026-09-01 08:00:00',
            'selesai' => '2026-09-01 12:00:00',
            'status' => 'dipinjam',
        ]);

        // Setengah terbuka, sama persis dengan pemicu.
        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson($this->rentang('2026-09-01 12:00:00', '2026-09-01 14:00:00'))
            ->assertOk()->json('data');

        $this->assertTrue(collect($data)->firstWhere('nama', 'Neraca')['tersedia']);
    }

    public function test_alat_yang_sudah_dikembalikan_bebas_lagi(): void
    {
        $alat = Asset::factory()->kodeBarang('3.08.01.03.001')->create(['nama' => 'Neraca']);

        EquipmentLoan::create([
            'asset_id' => $alat->id,
            'user_id' => User::factory()->create()->id,
            'keperluan' => 'Sudah selesai',
            'mulai' => '2026-09-01 09:00:00',
            'selesai' => '2026-09-01 15:00:00',
            'status' => 'dikembalikan',
        ]);

        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson($this->rentang('2026-09-01 10:00:00', '2026-09-01 12:00:00'))
            ->assertOk()->json('data');

        $this->assertTrue(collect($data)->firstWhere('nama', 'Neraca')['tersedia']);
    }

    // --- Syarat kelayakan yang tidak dimiliki ruangan ------------------------

    public function test_alat_berkalibrasi_kedaluwarsa_ditandai_tidak_tersedia(): void
    {
        Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'Neraca Analitik', 'wajib_kalibrasi' => true,
        ]);

        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertOk()->json('data');

        $r = collect($data)->firstWhere('nama', 'Neraca Analitik');

        // Alatnya bebas, tetapi hasil pengujian yang memakainya tidak sah.
        // Membiarkannya tampak tersedia berarti membiarkan orang menghasilkan
        // data uji yang harus dibuang.
        $this->assertFalse($r['tersedia']);
        $this->assertSame('Kalibrasi kedaluwarsa', $r['alasan']);
        $this->assertTrue($r['kalibrasi_kedaluwarsa']);
    }

    public function test_alat_dengan_kalibrasi_masih_berlaku_tetap_tersedia(): void
    {
        $alat = Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'Neraca Analitik', 'wajib_kalibrasi' => true,
        ]);

        AssetMaintenance::create([
            'asset_id' => $alat->id,
            'jenis' => 'kalibrasi',
            'jadwal' => now()->subMonth(),
            'dikerjakan_pada' => now()->subMonth(),
            'status' => 'selesai',
            'berlaku_sampai' => now()->addYear(),
        ]);

        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertOk()->json('data');

        $this->assertTrue(collect($data)->firstWhere('nama', 'Neraca Analitik')['tersedia']);
    }

    public function test_alat_yang_tidak_wajib_kalibrasi_tidak_pernah_terganjal_kalibrasi(): void
    {
        Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'Meja Preparasi', 'wajib_kalibrasi' => false,
        ]);

        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertOk()->json('data');

        $this->assertTrue(collect($data)->firstWhere('nama', 'Meja Preparasi')['tersedia']);
    }

    public function test_alat_rusak_berat_ditandai_tidak_tersedia(): void
    {
        Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'Oven Rusak', 'kondisi' => 'RB',
        ]);

        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertOk()->json('data');

        $r = collect($data)->firstWhere('nama', 'Oven Rusak');

        // Tetap tampil, bukan disembunyikan: peminjam yang tidak menemukan
        // alatnya akan mengira daftarnya rusak.
        $this->assertNotNull($r);
        $this->assertFalse($r['tersedia']);
        $this->assertSame('Kondisi rusak berat', $r['alasan']);
    }

    public function test_bentrok_jadwal_disebut_lebih_dahulu_daripada_kalibrasi(): void
    {
        $alat = Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'Neraca', 'wajib_kalibrasi' => true,
        ]);

        EquipmentLoan::create([
            'asset_id' => $alat->id,
            'user_id' => User::factory()->create()->id,
            'keperluan' => 'Dipakai',
            'mulai' => '2026-09-01 09:00:00',
            'selesai' => '2026-09-01 15:00:00',
            'status' => 'dipinjam',
        ]);

        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson($this->rentang('2026-09-01 10:00:00', '2026-09-01 12:00:00'))
            ->assertOk()->json('data');

        // Keduanya benar, tetapi yang dapat ditindaklanjuti pengguna adalah
        // jadwalnya: ia dapat menggeser jam. Kalibrasi bukan urusannya.
        $this->assertSame(
            'Sedang dipinjam pada rentang waktu ini',
            collect($data)->firstWhere('nama', 'Neraca')['alasan']
        );
    }

    public function test_selesai_sebelum_mulai_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson($this->rentang('2026-09-01 11:00:00', '2026-09-01 09:00:00'))
            ->assertStatus(422)
            ->assertJsonValidationErrors('selesai');
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertUnauthorized();
    }
}
