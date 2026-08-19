<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Master data ruangan.
 *
 * Ruangan adalah prasyarat modul booking: tanpa endpoint ini, `room_id` pada
 * pemesanan tidak pernah bisa diisi dari antarmuka.
 */
class RoomApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string,mixed>
     */
    private function isian(array $ganti = []): array
    {
        return array_merge([
            'kode' => 'KIM-01',
            'nama' => 'Laboratorium Kimia 1',
            'gedung' => 'Gedung A',
            'lantai' => '2',
            'kapasitas' => 30,
            'status' => 'tersedia',
            'perlu_persetujuan' => false,
        ], $ganti);
    }

    // --- Dasar --------------------------------------------------------------

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/rooms')->assertUnauthorized();
        $this->postJson('/api/rooms', $this->isian())->assertUnauthorized();
    }

    public function test_dapat_membuat_ruangan(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/rooms', $this->isian())
            ->assertCreated()
            ->assertJsonPath('data.kode', 'KIM-01')
            ->assertJsonPath('data.kapasitas', 30);

        $this->assertDatabaseHas('rooms', ['kode' => 'KIM-01']);
    }

    public function test_kode_kembar_ditolak(): void
    {
        Room::factory()->create(['kode' => 'KIM-01']);

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/rooms', $this->isian())
            ->assertStatus(422)
            ->assertJsonValidationErrors('kode');
    }

    public function test_kode_ruangan_terhapus_boleh_dipakai_lagi(): void
    {
        // Berbeda dari NUP BMN: kode ruangan adalah penomoran internal biasa,
        // tidak beredar sebagai identitas negara, sehingga boleh dipakai ulang
        // setelah ruangannya dihapus.
        Room::factory()->create(['kode' => 'KIM-01'])->delete();

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/rooms', $this->isian())
            ->assertCreated();
    }

    public function test_status_tidak_sah_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/rooms', $this->isian(['status' => 'entah']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_dapat_mengubah_ruangan(): void
    {
        $room = Room::factory()->create(['nama' => 'Nama Lama']);

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->patchJson("/api/rooms/{$room->id}", ['nama' => 'Nama Baru', 'status' => 'pemeliharaan'])
            ->assertOk()
            ->assertJsonPath('data.nama', 'Nama Baru')
            ->assertJsonPath('data.status', 'pemeliharaan');
    }

    public function test_mengirim_kode_sendiri_saat_mengubah_diizinkan(): void
    {
        $room = Room::factory()->create(['kode' => 'KIM-01']);

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->patchJson("/api/rooms/{$room->id}", ['kode' => 'KIM-01', 'nama' => 'Berubah'])
            ->assertOk();
    }

    // --- Pencarian & tapis ---------------------------------------------------

    public function test_daftar_dapat_dicari_dan_ditapis(): void
    {
        Room::factory()->create(['kode' => 'KIM-01', 'nama' => 'Lab Kimia', 'gedung' => 'Gedung A', 'kapasitas' => 20]);
        Room::factory()->create(['kode' => 'AUD-01', 'nama' => 'Auditorium', 'gedung' => 'Gedung B', 'kapasitas' => 300, 'status' => 'pemeliharaan']);

        $pengguna = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengguna)->getJson('/api/rooms?cari=Kimia')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.kode', 'KIM-01');

        $this->actingAs($pengguna)->getJson('/api/rooms?status=pemeliharaan')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.kode', 'AUD-01');

        $this->actingAs($pengguna)->getJson('/api/rooms?gedung=Gedung+B')
            ->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($pengguna)->getJson('/api/rooms?kapasitas_min=100')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.kode', 'AUD-01');
    }

    // --- Penghapusan ---------------------------------------------------------

    public function test_ruangan_tanpa_jadwal_dapat_dihapus(): void
    {
        $room = Room::factory()->create();

        $this->actingAs($this->penggunaBerperan('super-admin'))
            ->deleteJson("/api/rooms/{$room->id}")
            ->assertOk();

        $this->assertSoftDeleted('rooms', ['id' => $room->id]);
    }

    public function test_ruangan_dengan_jadwal_mendatang_tidak_dapat_dihapus(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();

        Booking::create([
            'room_id' => $room->id, 'user_id' => $user->id,
            'keperluan' => 'Rapat', 'jumlah_peserta' => 5,
            'mulai' => now()->addDays(3), 'selesai' => now()->addDays(3)->addHours(2),
            'status' => 'menunggu',
        ]);

        $this->actingAs($this->penggunaBerperan('super-admin'))
            ->deleteJson("/api/rooms/{$room->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('room');

        // Hapus lunak tidak memicu kunci asing `restrict`, jadi tanpa penjaga
        // aplikasi ruangan ini akan hilang dan jadwalnya jadi yatim.
        $this->assertDatabaseHas('rooms', ['id' => $room->id, 'deleted_at' => null]);
    }

    public function test_jadwal_yang_sudah_lewat_tidak_menahan_penghapusan(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();

        Booking::create([
            'room_id' => $room->id, 'user_id' => $user->id,
            'keperluan' => 'Rapat lampau', 'jumlah_peserta' => 5,
            'mulai' => now()->subDays(10), 'selesai' => now()->subDays(10)->addHours(2),
            'status' => 'selesai',
        ]);

        $this->actingAs($this->penggunaBerperan('super-admin'))
            ->deleteJson("/api/rooms/{$room->id}")
            ->assertOk();
    }

    public function test_jadwal_yang_dibatalkan_tidak_menahan_penghapusan(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();

        Booking::create([
            'room_id' => $room->id, 'user_id' => $user->id,
            'keperluan' => 'Batal', 'jumlah_peserta' => 5,
            'mulai' => now()->addDays(3), 'selesai' => now()->addDays(3)->addHours(2),
            'status' => 'dibatalkan',
        ]);

        $this->actingAs($this->penggunaBerperan('super-admin'))
            ->deleteJson("/api/rooms/{$room->id}")
            ->assertOk();
    }

    // --- Otorisasi ------------------------------------------------------------

    /**
     * @return list<array{string, bool}>
     */
    public static function peranBacaRuangan(): array
    {
        return [
            'facility manager boleh' => ['facility-manager', true],
            'asset manager boleh' => ['asset-manager', true],
            // Employee tidak punya izin master-data sama sekali, tetapi harus
            // tetap dapat melihat ruangan untuk memesannya.
            'employee boleh (lewat izin booking)' => ['employee', true],
            'external user boleh (mengajukan sewa)' => ['external-user', true],
        ];
    }

    #[DataProvider('peranBacaRuangan')]
    public function test_membaca_daftar_ruangan(string $peran, bool $boleh): void
    {
        $this->actingAs($this->penggunaBerperan($peran))
            ->getJson('/api/rooms')
            ->assertStatus($boleh ? 200 : 403);
    }

    public function test_employee_tidak_boleh_membuat_atau_menghapus_ruangan(): void
    {
        $room = Room::factory()->create();
        $pengguna = $this->penggunaBerperan('employee');

        $this->actingAs($pengguna)->postJson('/api/rooms', $this->isian())->assertForbidden();
        $this->actingAs($pengguna)->patchJson("/api/rooms/{$room->id}", ['nama' => 'X'])->assertForbidden();
        $this->actingAs($pengguna)->deleteJson("/api/rooms/{$room->id}")->assertForbidden();
    }

    public function test_facility_manager_boleh_mengubah_tetapi_tidak_menghapus(): void
    {
        $room = Room::factory()->create();
        $pengguna = $this->penggunaBerperan('facility-manager');

        // master-data UBAH → boleh mengubah…
        $this->actingAs($pengguna)->patchJson("/api/rooms/{$room->id}", ['nama' => 'Baru'])->assertOk();

        // …tetapi menghapus menuntut master-data.kelola (tingkat PENUH).
        $this->actingAs($pengguna)->deleteJson("/api/rooms/{$room->id}")->assertForbidden();
    }
}
