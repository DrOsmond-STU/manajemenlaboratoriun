<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tamu_tidak_boleh_membuat_pemesanan(): void
    {
        $room = Room::factory()->create();

        $this->postJson('/api/bookings', [
            'room_id' => $room->id,
            'keperluan' => 'Rapat',
            'mulai' => '2026-09-01 08:00:00',
            'selesai' => '2026-09-01 10:00:00',
        ])->assertUnauthorized();

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_pengguna_terautentikasi_dapat_membuat_pemesanan(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $room = Room::factory()->create();

        $this->postJson('/api/bookings', [
            'room_id' => $room->id,
            'keperluan' => 'Rapat koordinasi bulanan',
            'jumlah_peserta' => 20,
            'mulai' => '2026-09-01 08:00:00',
            'selesai' => '2026-09-01 10:00:00',
        ])
            ->assertCreated()
            ->assertJsonPath('data.keperluan', 'Rapat koordinasi bulanan')
            ->assertJsonPath('data.status', 'menunggu')
            ->assertJsonPath('data.ruangan.id', $room->id);
    }

    public function test_bentrok_dikembalikan_sebagai_422_berbahasa_indonesia(): void
    {
        Sanctum::actingAs($user = User::factory()->create());
        $room = Room::factory()->create();

        Booking::factory()->for($room)->for($user)
            ->pada('2026-09-01 08:00:00', '2026-09-01 12:00:00')
            ->create();

        $this->postJson('/api/bookings', [
            'room_id' => $room->id,
            'keperluan' => 'Rapat lain',
            'mulai' => '2026-09-01 11:00:00',
            'selesai' => '2026-09-01 13:00:00',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('mulai');

        $this->assertDatabaseCount('bookings', 1);
    }

    public function test_selesai_harus_setelah_mulai(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $room = Room::factory()->create();

        $this->postJson('/api/bookings', [
            'room_id' => $room->id,
            'keperluan' => 'Terbalik',
            'mulai' => '2026-09-01 12:00:00',
            'selesai' => '2026-09-01 08:00:00',
        ])->assertStatus(422)->assertJsonValidationErrors('selesai');
    }

    public function test_ruangan_harus_ada(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/bookings', [
            'room_id' => 999999,
            'keperluan' => 'Ruangan hantu',
            'mulai' => '2026-09-01 08:00:00',
            'selesai' => '2026-09-01 10:00:00',
        ])->assertStatus(422)->assertJsonValidationErrors('room_id');
    }

    public function test_daftar_pemesanan_dapat_disaring_per_ruangan(): void
    {
        Sanctum::actingAs($user = User::factory()->create());
        [$a, $b] = Room::factory()->count(2)->create();

        Booking::factory()->for($a)->for($user)->pada('2026-09-01 08:00:00', '2026-09-01 10:00:00')->create();
        Booking::factory()->for($b)->for($user)->pada('2026-09-01 08:00:00', '2026-09-01 10:00:00')->create();

        $this->getJson("/api/bookings?room_id={$a->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.ruangan.id', $a->id);
    }
}
