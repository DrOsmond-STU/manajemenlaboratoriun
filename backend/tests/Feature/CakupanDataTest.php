<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\Booking;
use App\Models\Room;
use App\Models\User;
use App\Models\UserGedung;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Cakupan data — sumbu kedua otorisasi (SECURITY.md §4.2).
 *
 * Sumbu pertama menentukan TINDAKAN, sumbu ini menentukan OBJEK. Tanpa sumbu
 * kedua, seorang PIC gedung A yang berhak "melihat aset" berarti melihat aset
 * seluruh satuan kerja. Itu tidak memunculkan galat apa pun — hanya kebocoran
 * yang tak disadari, dan hanya uji seperti ini yang menangkapnya.
 */
class CakupanDataTest extends TestCase
{
    use RefreshDatabase;

    private function pengguna(string $peran, ?string $unit = null, array $gedung = []): User
    {
        $pengguna = $this->penggunaBerperan($peran, ['unit_kerja' => $unit]);

        foreach ($gedung as $g) {
            UserGedung::create(['user_id' => $pengguna->id, 'gedung' => $g]);
        }

        return $pengguna;
    }

    private function ruangan(string $gedung, string $kode): Room
    {
        return Room::factory()->create(['gedung' => $gedung, 'kode' => $kode]);
    }

    // --- Ruangan ------------------------------------------------------------

    public function test_pengguna_hanya_melihat_ruangan_gedung_yang_diampu(): void
    {
        $this->ruangan('Gedung A', 'A-01');
        $this->ruangan('Gedung B', 'B-01');

        $pic = $this->pengguna('pic', gedung: ['Gedung A']);

        $this->actingAs($pic)->getJson('/api/rooms')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.kode', 'A-01');
    }

    public function test_dapat_mengampu_lebih_dari_satu_gedung(): void
    {
        $this->ruangan('Gedung A', 'A-01');
        $this->ruangan('Gedung B', 'B-01');
        $this->ruangan('Gedung C', 'C-01');

        $pic = $this->pengguna('pic', gedung: ['Gedung A', 'Gedung B']);

        $this->actingAs($pic)->getJson('/api/rooms')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_tanpa_penugasan_gedung_tidak_dibatasi(): void
    {
        // Keputusan yang sengaja diambil dan didokumentasikan: gagal ke arah
        // longgar, supaya pengguna baru tidak buntu sebelum ditugaskan.
        $this->ruangan('Gedung A', 'A-01');
        $this->ruangan('Gedung B', 'B-01');

        $this->actingAs($this->pengguna('pic'))
            ->getJson('/api/rooms')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_peran_lintas_gedung_melihat_semua_walau_ditugaskan(): void
    {
        $this->ruangan('Gedung A', 'A-01');
        $this->ruangan('Gedung B', 'B-01');

        // Asset Manager bertanggung jawab saat audit BMN seluruh satker;
        // membatasinya per gedung membuat pekerjaan intinya mustahil.
        $am = $this->pengguna('asset-manager', gedung: ['Gedung A']);

        $this->actingAs($am)->getJson('/api/rooms')->assertOk()->assertJsonCount(2, 'data');
    }

    // --- Aset ----------------------------------------------------------------

    private function aset(array $ganti = []): Asset
    {
        BmnKodeBarang::firstOrCreate(
            ['kode' => '3.08.01.03.001'],
            ['uraian' => 'Alat uji', 'masa_manfaat' => 8],
        );

        return Asset::factory()->kodeBarang('3.08.01.03.001')->create($ganti);
    }

    public function test_aset_dibatasi_lewat_gedung_ruangannya(): void
    {
        $a = $this->ruangan('Gedung A', 'A-01');
        $b = $this->ruangan('Gedung B', 'B-01');

        $this->aset(['room_id' => $a->id, 'nama' => 'Alat A']);
        $this->aset(['room_id' => $b->id, 'nama' => 'Alat B']);

        $pic = $this->pengguna('pic', gedung: ['Gedung A']);

        // PIC tidak punya izin aset.lihat pada matriks, jadi dipinjamkan
        // peran lab-manager yang punya LIHAT tetapi bukan lintas gedung.
        $lm = $this->pengguna('lab-manager', gedung: ['Gedung A']);

        $this->actingAs($lm)->getJson('/api/assets')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'Alat A');
    }

    public function test_aset_belum_ditempatkan_tetap_terlihat(): void
    {
        $a = $this->ruangan('Gedung A', 'A-01');
        $b = $this->ruangan('Gedung B', 'B-01');

        $this->aset(['room_id' => $a->id, 'nama' => 'Alat A']);
        $this->aset(['room_id' => $b->id, 'nama' => 'Alat B']);
        $this->aset(['room_id' => null, 'nama' => 'Alat Baru']);

        $lm = $this->pengguna('lab-manager', gedung: ['Gedung A']);

        // Barang yang baru didaftarkan atau sedang di bengkel tidak boleh
        // hilang dari daftar hanya karena penempatannya kosong.
        $nama = $this->actingAs($lm)->getJson('/api/assets')->assertOk()->json('data.*.nama');

        $this->assertContains('Alat Baru', $nama);
        $this->assertContains('Alat A', $nama);
        $this->assertNotContains('Alat B', $nama);
    }

    public function test_aset_dibatasi_unit_kerja(): void
    {
        $this->aset(['unit_kerja' => 'Lab Kimia', 'nama' => 'Alat Kimia']);
        $this->aset(['unit_kerja' => 'Lab Fisika', 'nama' => 'Alat Fisika']);
        $this->aset(['unit_kerja' => null, 'nama' => 'Alat Umum']);

        $lm = $this->pengguna('lab-manager', unit: 'Lab Kimia');

        $nama = $this->actingAs($lm)->getJson('/api/assets')->assertOk()->json('data.*.nama');

        $this->assertContains('Alat Kimia', $nama);
        $this->assertContains('Alat Umum', $nama, 'Aset tanpa unit kerja adalah milik bersama.');
        $this->assertNotContains('Alat Fisika', $nama);
    }

    // --- Pemesanan ------------------------------------------------------------

    private function booking(Room $room, User $pemohon, string $keperluan, ?string $unit = null): Booking
    {
        return Booking::create([
            'room_id' => $room->id,
            'user_id' => $pemohon->id,
            'keperluan' => $keperluan,
            'unit_kerja' => $unit,
            'jumlah_peserta' => 5,
            'mulai' => now()->addDays(random_int(1, 300))->setTime(9, 0),
            'selesai' => now()->addDays(random_int(301, 600))->setTime(11, 0),
            'status' => 'menunggu',
        ]);
    }

    public function test_pemesanan_dibatasi_gedung(): void
    {
        $a = $this->ruangan('Gedung A', 'A-01');
        $b = $this->ruangan('Gedung B', 'B-01');
        $orangLain = User::factory()->create();

        $this->booking($a, $orangLain, 'Rapat di A');
        $this->booking($b, $orangLain, 'Rapat di B');

        $pic = $this->pengguna('pic', gedung: ['Gedung A']);

        $this->actingAs($pic)->getJson('/api/bookings')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.keperluan', 'Rapat di A');
    }

    public function test_pengajuan_sendiri_selalu_terlihat_walau_di_luar_cakupan(): void
    {
        $b = $this->ruangan('Gedung B', 'B-01');
        $pic = $this->pengguna('pic', gedung: ['Gedung A']);

        // Pemohon yang tidak dapat melihat pengajuannya sendiri tidak punya
        // cara mengetahui apakah pengajuannya disetujui.
        $this->booking($b, $pic, 'Pengajuan saya di gedung lain');

        $this->actingAs($pic)->getJson('/api/bookings')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.keperluan', 'Pengajuan saya di gedung lain');
    }

    public function test_unit_kerja_pemesanan_diambil_dari_pemohon(): void
    {
        $room = Room::factory()->create();
        $pemohon = $this->pengguna('employee', unit: 'Lab Kimia');

        $this->actingAs($pemohon)->postJson('/api/bookings', [
            'room_id' => $room->id,
            'keperluan' => 'Rapat',
            // Sengaja mengaku dari unit lain — harus diabaikan.
            'unit_kerja' => 'Direksi',
            'mulai' => now()->addDay()->toIso8601String(),
            'selesai' => now()->addDay()->addHours(2)->toIso8601String(),
        ])->assertCreated();

        $this->assertSame('Lab Kimia', Booking::first()->unit_kerja);
    }

    // --- Aturan tetap berlaku bersama sumbu peran -----------------------------

    public function test_cakupan_tidak_menggantikan_izin(): void
    {
        $a = $this->ruangan('Gedung A', 'A-01');
        $this->aset(['room_id' => $a->id]);

        // Employee ditugaskan gedung A, tetapi tetap tidak punya izin aset.
        $employee = $this->pengguna('employee', gedung: ['Gedung A']);

        $this->actingAs($employee)->getJson('/api/assets')->assertForbidden();
    }
}
