<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Room;
use App\Models\User;
use App\Services\BookingService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class BookingConflictTest extends TestCase
{
    use RefreshDatabase;

    private function data(Room $room, User $user, string $mulai, string $selesai): array
    {
        return [
            'room_id' => $room->id,
            'user_id' => $user->id,
            'keperluan' => 'Rapat koordinasi',
            'jumlah_peserta' => 10,
            'mulai' => $mulai,
            'selesai' => $selesai,
            'status' => 'menunggu',
        ];
    }

    public function test_pemesanan_pertama_diterima(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();

        $booking = app(BookingService::class)->buat(
            $this->data($room, $user, '2026-09-01 08:00:00', '2026-09-01 12:00:00')
        );

        $this->assertDatabaseCount('bookings', 1);
        $this->assertSame($room->id, $booking->room_id);
    }

    public function test_tumpang_tindih_sebagian_ditolak_dengan_pesan_yang_menjelaskan(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();
        $service = app(BookingService::class);

        $service->buat($this->data($room, $user, '2026-09-01 08:00:00', '2026-09-01 12:00:00'));

        try {
            $service->buat($this->data($room, $user, '2026-09-01 11:00:00', '2026-09-01 13:00:00'));
            $this->fail('Pemesanan yang tumpang tindih seharusnya ditolak.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('mulai', $e->errors());
            $this->assertStringContainsString('Rapat koordinasi', $e->errors()['mulai'][0]);
        }

        $this->assertDatabaseCount('bookings', 1);
    }

    public function test_pemakaian_berurutan_diizinkan(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();
        $service = app(BookingService::class);

        $service->buat($this->data($room, $user, '2026-09-01 08:00:00', '2026-09-01 12:00:00'));
        $service->buat($this->data($room, $user, '2026-09-01 12:00:00', '2026-09-01 14:00:00'));

        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_ruangan_berbeda_pada_waktu_sama_diizinkan(): void
    {
        [$a, $b] = Room::factory()->count(2)->create();
        $user = User::factory()->create();
        $service = app(BookingService::class);

        $service->buat($this->data($a, $user, '2026-09-01 08:00:00', '2026-09-01 12:00:00'));
        $service->buat($this->data($b, $user, '2026-09-01 08:00:00', '2026-09-01 12:00:00'));

        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_pemesanan_yang_dibatalkan_tidak_memblokir_slot(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();

        Booking::factory()->for($room)->for($user)
            ->pada('2026-09-01 08:00:00', '2026-09-01 12:00:00')
            ->dibatalkan()
            ->create();

        app(BookingService::class)->buat(
            $this->data($room, $user, '2026-09-01 09:00:00', '2026-09-01 11:00:00')
        );

        $this->assertDatabaseCount('bookings', 2);
    }

    public function test_selesai_sebelum_mulai_ditolak_basis_data(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();

        $this->expectException(QueryException::class);

        DB::table('bookings')->insert([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'keperluan' => 'Terbalik',
            'mulai' => '2026-09-01 12:00:00+00',
            'selesai' => '2026-09-01 08:00:00+00',
            'status' => 'menunggu',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Kolom `periode` wajib dihitung basis data. Bila suatu saat ada yang
     * mengubahnya menjadi kolom biasa, batasan eksklusi masih ada tetapi bisa
     * diisi nilai yang tidak sesuai `mulai`/`selesai` — uji ini menjaga itu.
     */
    public function test_periode_dihitung_basis_data_dari_mulai_dan_selesai(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();

        $booking = app(BookingService::class)->buat(
            $this->data($room, $user, '2026-09-01 08:00:00', '2026-09-01 12:00:00')
        );

        $periode = DB::table('bookings')->where('id', $booking->id)->value('periode');

        $this->assertStringContainsString('2026-09-01 08:00:00', $periode);
        $this->assertStringContainsString('2026-09-01 12:00:00', $periode);
        $this->assertStringStartsWith('[', $periode, 'Batas bawah harus inklusif.');
        $this->assertStringEndsWith(')', $periode, 'Batas atas harus eksklusif agar pemakaian berurutan tidak dianggap bentrok.');

        $generated = DB::selectOne("
            SELECT is_generated FROM information_schema.columns
            WHERE table_name = 'bookings' AND column_name = 'periode'
        ");
        $this->assertSame('ALWAYS', $generated->is_generated);
    }
}
