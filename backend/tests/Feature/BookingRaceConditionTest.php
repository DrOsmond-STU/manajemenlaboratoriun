<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Uji ini menjaga alasan utama pemilihan PostgreSQL.
 *
 * Dua permintaan bersamaan dapat sama-sama lolos pemeriksaan "apakah slot
 * kosong?" karena pemeriksaan dan penulisan adalah dua langkah terpisah. Yang
 * diuji di sini adalah bahwa basis data tetap menolak salah satunya, sehingga
 * jadwal ganda tidak mungkin terbentuk walau validasi aplikasi tertembus.
 */
class BookingRaceConditionTest extends TestCase
{
    use RefreshDatabase;

    public function test_dua_penulisan_bersamaan_tidak_menghasilkan_jadwal_ganda(): void
    {
        $room = Room::factory()->create();
        $user = User::factory()->create();

        // RefreshDatabase membungkus uji dalam satu transaksi, sehingga koneksi
        // kedua tidak akan melihat data di atas. Uji ini butuh dua transaksi
        // sungguhan, jadi datanya di-commit lebih dulu.
        DB::commit();
        DB::beginTransaction();

        $baris = fn (string $mulai, string $selesai) => [
            'room_id' => $room->id,
            'user_id' => $user->id,
            'keperluan' => 'Rapat bersamaan',
            'jumlah_peserta' => 5,
            'mulai' => $mulai,
            'selesai' => $selesai,
            'status' => 'menunggu',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        // Dua koneksi terpisah dibuat dengan mendaftarkan dua nama koneksi ke
        // basis data yang sama; memakai nama yang sama akan mengembalikan
        // instance koneksi yang sama sehingga tidak ada balapan yang teruji.
        config([
            'database.connections.uji_a' => config('database.connections.pgsql'),
            'database.connections.uji_b' => config('database.connections.pgsql'),
        ]);

        // Sesi A: menulis, belum commit.
        $a = DB::connection('uji_a');
        $a->beginTransaction();
        $a->table('bookings')->insert($baris('2026-10-01 09:00:00+00', '2026-10-01 11:00:00+00'));

        // Sesi B: koneksi terpisah. Keduanya sama-sama "melihat slot kosong"
        // sebelum menulis. lock_timeout dipasang agar uji tidak menggantung —
        // tanpa itu B akan menunggu A tanpa batas.
        $b = DB::connection('uji_b');
        $b->statement("SET lock_timeout = '2s'");
        $b->beginTransaction();

        $bGagal = false;
        try {
            $b->table('bookings')->insert($baris('2026-10-01 10:00:00+00', '2026-10-01 12:00:00+00'));
            $b->commit();
        } catch (\Throwable $e) {
            $bGagal = true;
            $b->rollBack();
        }

        $a->commit();

        $this->assertTrue($bGagal, 'Sesi kedua seharusnya gagal, bukan ikut tersimpan.');

        $jumlah = $a->table('bookings')->where('room_id', $room->id)->count();
        $this->assertSame(1, $jumlah, "Hanya satu pemesanan boleh bertahan, ditemukan {$jumlah}.");

        // Bersihkan: baris ini sudah ter-commit sehingga di luar jangkauan rollback uji.
        $a->table('bookings')->where('room_id', $room->id)->delete();
        $a->table('rooms')->where('id', $room->id)->delete();
        $a->table('users')->where('id', $user->id)->delete();
    }
}
