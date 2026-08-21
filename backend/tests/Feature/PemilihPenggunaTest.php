<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PemilihPenggunaTest extends TestCase
{
    use RefreshDatabase;

    public function test_surel_tidak_pernah_ikut_dikirim(): void
    {
        User::factory()->create(['name' => 'Andi', 'email' => 'andi@instansi.go.id']);

        $jawaban = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson('/api/pengguna')
            ->assertOk();

        // Daftar surel seluruh pegawai adalah bahan baku paling berguna bagi
        // siapa pun yang menyiapkan serangan phishing, dan endpoint ini
        // terbuka bagi hampir semua peran yang menyunting master data.
        $jawaban->assertJsonMissing(['email' => 'andi@instansi.go.id']);
        $this->assertStringNotContainsString('andi@instansi.go.id', $jawaban->getContent());

        $data = $jawaban->json('data');
        $this->assertSame(['id', 'nama', 'unit_kerja'], array_keys($data[0]));
    }

    public function test_dapat_dicari_per_nama(): void
    {
        User::factory()->create(['name' => 'Andi Teknisi']);
        User::factory()->create(['name' => 'Rina Analis']);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson('/api/pengguna?cari=rina')
            ->assertOk()->json('data');

        $this->assertCount(1, $data);
        $this->assertSame('Rina Analis', $data[0]['nama']);
    }

    public function test_dapat_disaring_per_peran(): void
    {
        $this->penggunaBerperan('lab-technician', ['name' => 'Andi Teknisi']);
        $this->penggunaBerperan('finance', ['name' => 'Rina Keuangan']);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson('/api/pengguna?peran=lab-technician')
            ->assertOk()->json('data');

        // Pemilih teknisi tidak boleh menawarkan seluruh pegawai.
        $this->assertSame(['Andi Teknisi'], collect($data)->pluck('nama')->all());
    }

    public function test_daftar_dibatasi_dan_pemotongannya_diberitahukan(): void
    {
        User::factory()->count(60)->create();

        $jawaban = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson('/api/pengguna')
            ->assertOk();

        // Batas keras membuat endpoint ini tidak dapat dipakai menyedot
        // seluruh direktori pegawai sedikit demi sedikit.
        $this->assertCount(50, $jawaban->json('data'));

        // Dan pemanggil harus TAHU daftarnya terpotong, supaya antarmuka
        // meminta pengguna mempersempit pencarian alih-alih diam-diam
        // menyembunyikan orang yang dicari.
        $this->assertTrue($jawaban->json('terpotong'));
    }

    public function test_peran_tanpa_izin_master_data_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('external-user'))
            ->getJson('/api/pengguna')
            ->assertForbidden();
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/pengguna')->assertUnauthorized();
    }
}
