<?php

namespace Tests\Feature;

use App\Mail\PengingatJadwal;
use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\BmnKodeBarang;
use App\Models\Booking;
use App\Models\ChecklistAssignment;
use App\Models\ChecklistTemplate;
use App\Models\EquipmentLoan;
use App\Models\NotificationLog;
use App\Models\NotificationPreference;
use App\Models\Room;
use App\Models\User;
use App\Services\NotifikasiJadwalService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Pengingat jadwal ke surel penanggung jawab.
 *
 * Sifat yang paling menentukan bukan "surelnya terkirim", melainkan
 * "surelnya terkirim SEKALI". Penjadwal berjalan berkala; tanpa penjagaan,
 * orang menerima belasan surel identik sehari dan berhenti membacanya sama
 * sekali — termasuk yang penting.
 */
class NotifikasiJadwalTest extends TestCase
{
    use RefreshDatabase;

    private function pj(string $email = 'pj@contoh.test'): User
    {
        return User::factory()->create(['email' => $email, 'name' => 'Penanggung Jawab']);
    }

    private function alat(array $ganti = []): Asset
    {
        BmnKodeBarang::firstOrCreate(
            ['kode' => '3.08.01.03.001'],
            ['uraian' => 'Alat uji', 'masa_manfaat' => 8],
        );

        return Asset::factory()->kodeBarang('3.08.01.03.001')->create($ganti);
    }

    private function jalankan(): array
    {
        return app(NotifikasiJadwalService::class)->jalankan();
    }

    // --- Sumber jadwal ------------------------------------------------------

    public function test_pemesanan_ruangan_besok_diingatkan(): void
    {
        Mail::fake();
        $pemohon = $this->pj();

        Booking::create([
            'room_id' => Room::factory()->create(['nama' => 'Lab Kimia'])->id,
            'user_id' => $pemohon->id,
            'keperluan' => 'Rapat tim',
            'mulai' => now()->addDay()->setTime(9, 0),
            'selesai' => now()->addDay()->setTime(11, 0),
            'status' => 'menunggu',
        ]);

        $hasil = $this->jalankan();

        $this->assertSame(1, $hasil['terkirim']);
        Mail::assertSent(PengingatJadwal::class, fn ($m) => $m->hasTo('pj@contoh.test'));
    }

    public function test_peminjaman_terlambat_diingatkan_dengan_penanda(): void
    {
        Mail::fake();
        $peminjam = $this->pj();

        EquipmentLoan::factory()->create([
            'asset_id' => $this->alat(['nama' => 'Spektrofotometer'])->id,
            'user_id' => $peminjam->id,
            'mulai' => now()->subDays(5),
            'selesai' => now()->subDays(2),
            'status' => 'dipinjam',
        ]);

        $this->assertSame(1, $this->jalankan()['terkirim']);

        Mail::assertSent(PengingatJadwal::class, function ($m) {
            return $m->sisaWaktu === 'terlambat'
                && str_contains($m->envelope()->subject, '[TERLAMBAT]');
        });
    }

    public function test_kalibrasi_diingatkan_ke_petugasnya(): void
    {
        Mail::fake();
        $petugas = $this->pj('teknisi@contoh.test');

        AssetMaintenance::factory()->kalibrasi()->create([
            'asset_id' => $this->alat()->id,
            'petugas_id' => $petugas->id,
            'jadwal' => now()->addDay()->toDateString(),
        ]);

        $this->assertSame(1, $this->jalankan()['terkirim']);
        Mail::assertSent(PengingatJadwal::class, fn ($m) => $m->hasTo('teknisi@contoh.test'));

        $this->assertDatabaseHas('notification_logs', ['kategori' => 'kalibrasi']);
    }

    public function test_pemeliharaan_jatuh_ke_penanggung_jawab_alat_bila_petugas_kosong(): void
    {
        Mail::fake();
        $pjAlat = $this->pj('pjalat@contoh.test');

        AssetMaintenance::factory()->create([
            'asset_id' => $this->alat(['penanggung_jawab_id' => $pjAlat->id])->id,
            'petugas_id' => null,
            'jadwal' => now()->toDateString(),
        ]);

        $this->assertSame(1, $this->jalankan()['terkirim']);
        Mail::assertSent(PengingatJadwal::class, fn ($m) => $m->hasTo('pjalat@contoh.test'));
    }

    public function test_pekerjaan_tanpa_penanggung_jawab_tidak_mengirim_apa_pun(): void
    {
        Mail::fake();

        AssetMaintenance::factory()->create([
            'asset_id' => $this->alat(['penanggung_jawab_id' => null])->id,
            'petugas_id' => null,
            'jadwal' => now()->toDateString(),
        ]);

        $this->assertSame(0, $this->jalankan()['diperiksa']);
        Mail::assertNothingSent();
    }

    public function test_checklist_harian_diingatkan_ke_penugasnya(): void
    {
        Mail::fake();
        $pelaksana = $this->pj('pelaksana@contoh.test');
        $templat = ChecklistTemplate::factory()->denganButir()->create();

        ChecklistAssignment::create([
            'checklist_template_id' => $templat->id,
            'room_id' => Room::factory()->create()->id,
            'user_id' => $pelaksana->id,
            'periode' => 'harian',
            'aktif' => true,
        ]);

        $this->assertSame(1, $this->jalankan()['terkirim']);
        Mail::assertSent(PengingatJadwal::class, fn ($m) => $m->hasTo('pelaksana@contoh.test'));
    }

    // --- Tidak mengirim dua kali ------------------------------------------------

    public function test_menjalankan_dua_kali_tidak_mengirim_dua_surel(): void
    {
        Mail::fake();
        $pemohon = $this->pj();

        Booking::create([
            'room_id' => Room::factory()->create()->id,
            'user_id' => $pemohon->id,
            'keperluan' => 'Rapat',
            'mulai' => now()->addDay()->setTime(9, 0),
            'selesai' => now()->addDay()->setTime(11, 0),
            'status' => 'menunggu',
        ]);

        $pertama = $this->jalankan();
        $kedua = $this->jalankan();

        $this->assertSame(1, $pertama['terkirim']);
        $this->assertSame(0, $kedua['terkirim'], 'Pengingat kedua seharusnya dilewati.');
        $this->assertSame(1, $kedua['dilewati']);

        Mail::assertSentCount(1);
        $this->assertDatabaseCount('notification_logs', 1);
    }

    public function test_keunikan_dijaga_basis_data(): void
    {
        $pengguna = $this->pj();

        $baris = [
            'user_id' => $pengguna->id, 'email' => $pengguna->email,
            'kategori' => 'booking', 'sumber_tipe' => 'booking', 'sumber_id' => 1,
            'tanggal_acuan' => now()->toDateString(), 'perihal' => 'x',
            'status' => 'terkirim', 'created_at' => now(), 'updated_at' => now(),
        ];

        DB::table('notification_logs')->insert($baris);

        // Menembus lapisan aplikasi sepenuhnya.
        $this->expectException(QueryException::class);
        DB::table('notification_logs')->insert($baris);
    }

    public function test_jadwal_yang_diundur_menghasilkan_pengingat_baru(): void
    {
        Mail::fake();
        $pemohon = $this->pj();

        $booking = Booking::create([
            'room_id' => Room::factory()->create()->id,
            'user_id' => $pemohon->id,
            'keperluan' => 'Rapat',
            'mulai' => now()->addDay()->setTime(9, 0),
            'selesai' => now()->addDay()->setTime(11, 0),
            'status' => 'menunggu',
        ]);

        $this->jalankan();

        // Tanggal acuan ikut menjadi kunci keunikan, sehingga jadwal yang
        // berpindah hari memang layak diingatkan lagi.
        $booking->update([
            'mulai' => now()->addDays(2)->setTime(9, 0),
            'selesai' => now()->addDays(2)->setTime(11, 0),
        ]);

        // H-2 masih di luar jangkauan bawaan H-1, jadi belum dikirim…
        $this->assertSame(0, $this->jalankan()['terkirim']);

        // …tetapi bila preferensinya H-3, pengingat barunya keluar.
        NotificationPreference::create([
            'user_id' => $pemohon->id, 'kategori' => 'booking',
            'email_aktif' => true, 'ingatkan_h_min' => 3,
        ]);

        $this->assertSame(1, $this->jalankan()['terkirim']);
        Mail::assertSentCount(2);
    }

    // --- Preferensi ------------------------------------------------------------------

    public function test_preferensi_mematikan_kategori(): void
    {
        Mail::fake();
        $pemohon = $this->pj();

        NotificationPreference::create([
            'user_id' => $pemohon->id, 'kategori' => 'booking', 'email_aktif' => false,
        ]);

        Booking::create([
            'room_id' => Room::factory()->create()->id,
            'user_id' => $pemohon->id, 'keperluan' => 'Rapat',
            'mulai' => now()->addDay()->setTime(9, 0),
            'selesai' => now()->addDay()->setTime(11, 0),
            'status' => 'menunggu',
        ]);

        $this->assertSame(0, $this->jalankan()['terkirim']);
        Mail::assertNothingSent();
    }

    public function test_tanpa_preferensi_memakai_bawaan_aktif(): void
    {
        Mail::fake();
        $pemohon = $this->pj();

        // Mewajibkan setiap orang menyetel preferensi lebih dulu berarti tak
        // seorang pun menerima pengingat sampai mereka mengurusnya.
        $this->assertDatabaseCount('notification_preferences', 0);

        Booking::create([
            'room_id' => Room::factory()->create()->id,
            'user_id' => $pemohon->id, 'keperluan' => 'Rapat',
            'mulai' => now()->addDay()->setTime(9, 0),
            'selesai' => now()->addDay()->setTime(11, 0),
            'status' => 'menunggu',
        ]);

        $this->assertSame(1, $this->jalankan()['terkirim']);
    }

    public function test_jadwal_jauh_belum_diingatkan(): void
    {
        Mail::fake();
        $pemohon = $this->pj();

        Booking::create([
            'room_id' => Room::factory()->create()->id,
            'user_id' => $pemohon->id, 'keperluan' => 'Rapat',
            'mulai' => now()->addDays(5)->setTime(9, 0),
            'selesai' => now()->addDays(5)->setTime(11, 0),
            'status' => 'menunggu',
        ]);

        $hasil = $this->jalankan();

        $this->assertSame(1, $hasil['diperiksa']);
        $this->assertSame(0, $hasil['terkirim']);
        $this->assertSame(1, $hasil['dilewati']);
    }

    // --- Kegagalan ---------------------------------------------------------------------

    public function test_kegagalan_kirim_tercatat_dan_tidak_dicoba_ulang_membabi_buta(): void
    {
        // Sengaja TIDAK memakai Mail::fake() di sini — fake dan mock tidak
        // dapat dipasang bersamaan pada facade yang sama.
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP tidak terjangkau'));

        $pemohon = $this->pj();
        Booking::create([
            'room_id' => Room::factory()->create()->id,
            'user_id' => $pemohon->id, 'keperluan' => 'Rapat',
            'mulai' => now()->addDay()->setTime(9, 0),
            'selesai' => now()->addDay()->setTime(11, 0),
            'status' => 'menunggu',
        ]);

        $this->assertSame(1, $this->jalankan()['gagal']);

        $catatan = NotificationLog::firstOrFail();
        $this->assertSame('gagal', $catatan->status);
        $this->assertStringContainsString('SMTP', $catatan->galat);

        // Catatannya sengaja tidak dihapus: menghapusnya berarti mencoba ulang
        // ke alamat bermasalah berkali-kali.
        $this->assertSame(0, $this->jalankan()['terkirim']);
    }

    // --- Perintah -------------------------------------------------------------------------

    public function test_perintah_melaporkan_hitungannya(): void
    {
        Mail::fake();
        $pemohon = $this->pj();

        Booking::create([
            'room_id' => Room::factory()->create()->id,
            'user_id' => $pemohon->id, 'keperluan' => 'Rapat',
            'mulai' => now()->addDay()->setTime(9, 0),
            'selesai' => now()->addDay()->setTime(11, 0),
            'status' => 'menunggu',
        ]);

        $this->artisan('flms:kirim-pengingat')
            ->expectsOutputToContain('Terkirim')
            ->assertSuccessful();
    }
}
