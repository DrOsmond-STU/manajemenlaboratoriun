<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\Booking;
use App\Models\EquipmentLoan;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Persetujuan pemesanan ruangan dan peminjaman alat.
 *
 * Aturan yang paling penting di sini disebut SECURITY.md §4.3 sebagai hal
 * yang tidak boleh dilanggar: tidak seorang pun boleh menyetujui pengajuannya
 * sendiri, "meskipun peran mengizinkan". Aturan sepenting itu dijaga batasan
 * basis data, bukan hanya lapisan aplikasi — dan ada uji yang menembus
 * aplikasi untuk membuktikannya.
 */
class PersetujuanTest extends TestCase
{
    use RefreshDatabase;

    private function booking(User $pemohon, array $ganti = []): Booking
    {
        return Booking::create(array_merge([
            'room_id' => Room::factory()->create()->id,
            'user_id' => $pemohon->id,
            'keperluan' => 'Rapat tim',
            'jumlah_peserta' => 5,
            'mulai' => now()->addDays(3)->setTime(9, 0),
            'selesai' => now()->addDays(3)->setTime(11, 0),
            'status' => 'menunggu',
        ], $ganti));
    }

    private function peminjaman(User $pemohon, array $ganti = []): EquipmentLoan
    {
        BmnKodeBarang::firstOrCreate(
            ['kode' => '3.08.01.03.001'],
            ['uraian' => 'Alat uji', 'masa_manfaat' => 8],
        );

        return EquipmentLoan::factory()->create(array_merge([
            'asset_id' => Asset::factory()->kodeBarang('3.08.01.03.001')->create()->id,
            'user_id' => $pemohon->id,
            'status' => 'menunggu',
        ], $ganti));
    }

    // --- Aturan inti: tidak menyetujui pengajuan sendiri ----------------------

    public function test_tidak_dapat_menyetujui_pengajuan_sendiri(): void
    {
        // Facility manager punya izin PENUH pada booking ruangan — perannya
        // mengizinkan, tetapi aturannya tetap melarang.
        $fm = $this->penggunaBerperan('facility-manager');
        $booking = $this->booking($fm);

        $this->actingAs($fm)
            ->postJson("/api/persetujuan/booking/{$booking->id}/setujui")
            ->assertStatus(422)
            ->assertJsonValidationErrors('disetujui_oleh');

        $this->assertSame('menunggu', $booking->fresh()->status);
    }

    public function test_tidak_dapat_menolak_pengajuan_sendiri(): void
    {
        $fm = $this->penggunaBerperan('facility-manager');
        $booking = $this->booking($fm);

        $this->actingAs($fm)
            ->postJson("/api/persetujuan/booking/{$booking->id}/tolak", ['alasan' => 'apa saja'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('disetujui_oleh');
    }

    public function test_larangan_menyetujui_sendiri_dijaga_basis_data(): void
    {
        $pemohon = $this->penggunaBerperan('facility-manager');
        $booking = $this->booking($pemohon);

        // Menembus lapisan aplikasi sepenuhnya — seperti perbaikan manual
        // lewat psql atau skrip yang keliru.
        $this->expectException(QueryException::class);

        DB::table('bookings')->where('id', $booking->id)->update([
            'status' => 'disetujui',
            'disetujui_oleh' => $pemohon->id,
        ]);
    }

    public function test_pengajuan_sendiri_tidak_muncul_di_antrean(): void
    {
        $fm = $this->penggunaBerperan('facility-manager');
        $oranglain = User::factory()->create();

        $this->booking($fm, ['keperluan' => 'Punya saya']);
        $this->booking($oranglain, [
            'keperluan' => 'Punya orang lain',
            'mulai' => now()->addDays(9)->setTime(9, 0),
            'selesai' => now()->addDays(9)->setTime(11, 0),
        ]);

        // Menampilkan pengajuan sendiri hanya untuk ditolak saat diklik adalah
        // cara paling pasti membuat orang mengira sistemnya rusak.
        $this->actingAs($fm)->getJson('/api/persetujuan/antrean')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.keperluan', 'Punya orang lain');
    }

    // --- Alur normal ------------------------------------------------------------

    public function test_pemutus_lain_dapat_menyetujui(): void
    {
        $pemohon = User::factory()->create();
        $booking = $this->booking($pemohon);
        $fm = $this->penggunaBerperan('facility-manager');

        $this->actingAs($fm)
            ->postJson("/api/persetujuan/booking/{$booking->id}/setujui", ['catatan' => 'Silakan'])
            ->assertOk()
            ->assertJsonPath('data.status', 'disetujui');

        $segar = $booking->fresh();
        $this->assertSame($fm->id, $segar->disetujui_oleh);
        $this->assertNotNull($segar->disetujui_pada);
    }

    public function test_penolakan_wajib_beralasan(): void
    {
        $booking = $this->booking(User::factory()->create());
        $fm = $this->penggunaBerperan('facility-manager');

        $this->actingAs($fm)
            ->postJson("/api/persetujuan/booking/{$booking->id}/tolak", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('alasan');

        $this->assertSame('menunggu', $booking->fresh()->status);
    }

    public function test_penolakan_menyimpan_alasannya(): void
    {
        $booking = $this->booking(User::factory()->create());
        $fm = $this->penggunaBerperan('facility-manager');

        $this->actingAs($fm)
            ->postJson("/api/persetujuan/booking/{$booking->id}/tolak", [
                'alasan' => 'Ruangan sedang direnovasi pada tanggal tersebut',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'ditolak')
            ->assertJsonPath('data.persetujuan.alasan_penolakan', 'Ruangan sedang direnovasi pada tanggal tersebut');
    }

    public function test_penolakan_tanpa_alasan_ditolak_basis_data(): void
    {
        $booking = $this->booking(User::factory()->create());

        // Pemohon yang tidak tahu apa yang harus diperbaiki akan mengajukan
        // ulang hal yang sama persis.
        $this->expectException(QueryException::class);

        DB::table('bookings')->where('id', $booking->id)->update([
            'status' => 'ditolak',
            'alasan_penolakan' => null,
        ]);
    }

    public function test_pengajuan_yang_sudah_diputus_tidak_dapat_diputus_lagi(): void
    {
        $booking = $this->booking(User::factory()->create());
        $fm = $this->penggunaBerperan('facility-manager');

        $this->actingAs($fm)->postJson("/api/persetujuan/booking/{$booking->id}/setujui")->assertOk();

        $this->actingAs($fm)
            ->postJson("/api/persetujuan/booking/{$booking->id}/tolak", ['alasan' => 'berubah pikiran'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    // --- Pengajuan menunggu sudah menahan slot -------------------------------------

    public function test_pengajuan_menunggu_sudah_menahan_slot(): void
    {
        $room = Room::factory()->create();
        $a = User::factory()->create();
        $b = User::factory()->create();

        $pertama = $this->booking($a, ['room_id' => $room->id]);

        // Inilah sebabnya bentrok tidak mungkin muncul saat MENYETUJUI:
        // pengajuan yang masih menunggu pun sudah memblokir slotnya, sehingga
        // pengajuan tumpang tindih tidak pernah lahir sejak awal.
        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/bookings_no_overlap/');

        Booking::create([
            'room_id' => $room->id,
            'user_id' => $b->id,
            'keperluan' => 'Menyusul',
            'jumlah_peserta' => 3,
            'mulai' => $pertama->mulai,
            'selesai' => $pertama->selesai,
            'status' => 'menunggu',
        ]);
    }

    public function test_pengajuan_ditolak_membebaskan_slot_untuk_orang_lain(): void
    {
        $room = Room::factory()->create();
        $pemohon = User::factory()->create();
        $booking = $this->booking($pemohon, ['room_id' => $room->id]);
        $fm = $this->penggunaBerperan('facility-manager');

        $this->actingAs($fm)
            ->postJson("/api/persetujuan/booking/{$booking->id}/tolak", ['alasan' => 'Bentrok agenda pimpinan'])
            ->assertOk();

        // Setelah ditolak, slotnya kembali tersedia.
        $pengganti = Booking::create([
            'room_id' => $room->id,
            'user_id' => User::factory()->create()->id,
            'keperluan' => 'Pemakaian pengganti',
            'jumlah_peserta' => 3,
            'mulai' => $booking->mulai,
            'selesai' => $booking->selesai,
            'status' => 'menunggu',
        ]);

        $this->assertNotNull($pengganti->id);
    }

    // --- Peminjaman alat -------------------------------------------------------------

    public function test_peminjaman_dapat_disetujui(): void
    {
        $pinjaman = $this->peminjaman(User::factory()->create());
        $lm = $this->penggunaBerperan('lab-manager');

        $this->actingAs($lm)
            ->postJson("/api/persetujuan/peminjaman/{$pinjaman->id}/setujui")
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'disetujui');
    }

    public function test_peminjaman_sendiri_tidak_dapat_disetujui(): void
    {
        $lm = $this->penggunaBerperan('lab-manager');
        $pinjaman = $this->peminjaman($lm);

        $this->actingAs($lm)
            ->postJson("/api/persetujuan/peminjaman/{$pinjaman->id}/setujui")
            ->assertStatus(422)
            ->assertJsonValidationErrors('disetujui_oleh');
    }

    public function test_antrean_peminjaman_terpisah(): void
    {
        $this->peminjaman(User::factory()->create());
        $lm = $this->penggunaBerperan('lab-manager');

        $this->actingAs($lm)->getJson('/api/persetujuan/antrean?jenis=peminjaman')
            ->assertOk()->assertJsonCount(1, 'data');
    }

    // --- Otorisasi ----------------------------------------------------------------------

    public function test_employee_tidak_boleh_memutus(): void
    {
        $booking = $this->booking(User::factory()->create());
        $employee = $this->penggunaBerperan('employee');

        // Matriks: employee pada booking ruangan hanya BUAT.
        $this->actingAs($employee)
            ->postJson("/api/persetujuan/booking/{$booking->id}/setujui")
            ->assertForbidden();

        $this->actingAs($employee)->getJson('/api/persetujuan/antrean')->assertForbidden();
    }

    public function test_tamu_ditolak(): void
    {
        $booking = $this->booking(User::factory()->create());

        $this->postJson("/api/persetujuan/booking/{$booking->id}/setujui")->assertUnauthorized();
    }
}
