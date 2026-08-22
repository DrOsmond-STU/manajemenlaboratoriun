<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Room;
use App\Models\User;
use App\Models\UserGedung;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ketersediaan ruangan dihitung server.
 *
 * Antarmuka dapat menghitungnya sendiri dari daftar pemesanan yang sudah
 * dimuat, tetapi daftar itu berumur beberapa detik sampai menit. Yang terjadi
 * bukan sekadar layar usang: pengguna melihat "tersedia", mengisi seluruh
 * formulir, lalu ditolak pada langkah terakhir — dan ia tidak punya cara tahu
 * mengapa, karena layarnya baru saja mengatakan sebaliknya.
 */
class KetersediaanRuanganTest extends TestCase
{
    use RefreshDatabase;

    private function rentang(string $mulai, string $selesai): string
    {
        return '/api/bookings/ketersediaan?mulai='.urlencode($mulai).'&selesai='.urlencode($selesai);
    }

    public function test_ruangan_yang_terpesan_ditandai_tidak_tersedia(): void
    {
        $ruang = Room::factory()->create(['kode' => 'CR-01', 'nama' => 'Garuda']);
        $lain = Room::factory()->create(['kode' => 'CR-02', 'nama' => 'Rajawali']);

        Booking::create([
            'room_id' => $ruang->id,
            'user_id' => User::factory()->create()->id,
            'keperluan' => 'Rapat Koordinasi',
            'mulai' => '2026-09-01 09:00:00',
            'selesai' => '2026-09-01 11:00:00',
            'status' => 'disetujui',
        ]);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson($this->rentang('2026-09-01 10:00:00', '2026-09-01 12:00:00'))
            ->assertOk()->json('data');

        $garuda = collect($data)->firstWhere('kode', 'CR-01');
        $rajawali = collect($data)->firstWhere('kode', 'CR-02');

        $this->assertFalse($garuda['tersedia']);
        $this->assertSame('Bentrok dengan pemesanan lain', $garuda['alasan']);
        $this->assertSame('Rapat Koordinasi', $garuda['bentrok'][0]['keperluan']);

        $this->assertTrue($rajawali['tersedia']);
        $this->assertSame([], $rajawali['bentrok']);
    }

    public function test_pemakaian_berurutan_bukan_bentrok(): void
    {
        $ruang = Room::factory()->create(['kode' => 'CR-01']);

        Booking::create([
            'room_id' => $ruang->id,
            'user_id' => User::factory()->create()->id,
            'keperluan' => 'Rapat Pagi',
            'mulai' => '2026-09-01 08:00:00',
            'selesai' => '2026-09-01 12:00:00',
            'status' => 'disetujui',
        ]);

        // Rentang setengah terbuka [mulai, selesai) — aturannya harus sama
        // persis dengan batasan basis data. Berbeda sedikit saja, pemeriksaan
        // dan penyimpanan akan berselisih pendapat, dan yang kalah adalah
        // pengguna yang melihat "tersedia" lalu ditolak.
        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson($this->rentang('2026-09-01 12:00:00', '2026-09-01 14:00:00'))
            ->assertOk()->json('data');

        $this->assertTrue(collect($data)->firstWhere('kode', 'CR-01')['tersedia']);
    }

    public function test_pemesanan_yang_dibatalkan_membebaskan_slot(): void
    {
        $ruang = Room::factory()->create(['kode' => 'CR-01']);

        Booking::create([
            'room_id' => $ruang->id,
            'user_id' => User::factory()->create()->id,
            'keperluan' => 'Batal',
            'mulai' => '2026-09-01 09:00:00',
            'selesai' => '2026-09-01 11:00:00',
            'status' => 'dibatalkan',
        ]);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertOk()->json('data');

        $this->assertTrue(collect($data)->firstWhere('kode', 'CR-01')['tersedia']);
    }

    public function test_pemesanan_yang_masih_menunggu_tetap_menahan_slot(): void
    {
        $ruang = Room::factory()->create(['kode' => 'CR-01']);

        Booking::create([
            'room_id' => $ruang->id,
            'user_id' => User::factory()->create()->id,
            'keperluan' => 'Menunggu persetujuan',
            'mulai' => '2026-09-01 09:00:00',
            'selesai' => '2026-09-01 11:00:00',
            'status' => 'menunggu',
        ]);

        // Sama dengan perilaku pemicu: pengajuan yang belum disetujui pun
        // sudah memblokir. Menampilkannya sebagai tersedia akan mengundang
        // pengajuan kedua yang pasti ditolak.
        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertOk()->json('data');

        $this->assertFalse(collect($data)->firstWhere('kode', 'CR-01')['tersedia']);
    }

    public function test_ruangan_dalam_pemeliharaan_ditandai_tidak_tersedia_tetapi_tetap_tampil(): void
    {
        Room::factory()->create(['kode' => 'CR-01', 'status' => 'pemeliharaan']);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertOk()->json('data');

        $r = collect($data)->firstWhere('kode', 'CR-01');

        // Slotnya memang kosong, tetapi memesannya tetap keliru. Menyembunyikan
        // ruangannya sama sekali membuat pemesan bertanya-tanya ke mana
        // perginya.
        $this->assertNotNull($r, 'Ruangan tetap tampil.');
        $this->assertFalse($r['tersedia']);
        $this->assertSame('Pemeliharaan', $r['alasan']);
    }

    public function test_dapat_disaring_per_kapasitas_minimum(): void
    {
        Room::factory()->create(['kode' => 'KECIL', 'kapasitas' => 8]);
        Room::factory()->create(['kode' => 'BESAR', 'kapasitas' => 60]);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00').'&kapasitas_min=40')
            ->assertOk()->json('data');

        $this->assertSame(['BESAR'], collect($data)->pluck('kode')->all());
    }

    public function test_ketersediaan_menghormati_cakupan_data(): void
    {
        Room::factory()->create(['kode' => 'A-1', 'gedung' => 'Gedung A']);
        Room::factory()->create(['kode' => 'B-1', 'gedung' => 'Gedung B']);

        $penjaga = $this->penggunaBerperan('lab-technician');
        UserGedung::create(['user_id' => $penjaga->id, 'gedung' => 'Gedung A']);

        $data = $this->actingAs($penjaga)
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertOk()->json('data');

        $this->assertSame(['A-1'], collect($data)->pluck('kode')->all());
    }

    public function test_selesai_sebelum_mulai_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson($this->rentang('2026-09-01 11:00:00', '2026-09-01 09:00:00'))
            ->assertStatus(422)
            ->assertJsonValidationErrors('selesai');
    }

    public function test_ketersediaan_tidak_tertangkap_sebagai_id_pemesanan(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson($this->rentang('2026-09-01 09:00:00', '2026-09-01 11:00:00'))
            ->assertUnauthorized();
    }
}
