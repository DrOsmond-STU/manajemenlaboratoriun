<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\AssetMutation;
use App\Models\BmnKodeBarang;
use App\Models\Dashboard;
use App\Models\EquipmentLoan;
use App\Models\Laboratory;
use App\Models\Room;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pemeliharaan dan kalibrasi.
 *
 * Yang paling berharga di modul ini bukan pencatatannya, melainkan akibatnya
 * pada modul lain: alat ukur yang kalibrasinya kedaluwarsa tidak boleh dipakai
 * menguji. Hasilnya tidak dapat dipertanggungjawabkan, dan pada laboratorium
 * terakreditasi ISO/IEC 17025 hal itu temuan audit.
 */
class PemeliharaanKalibrasiTest extends TestCase
{
    use RefreshDatabase;

    private function alat(array $ganti = []): Asset
    {
        BmnKodeBarang::firstOrCreate(
            ['kode' => '3.08.01.03.001'],
            ['uraian' => 'Alat uji', 'masa_manfaat' => 8],
        );

        return Asset::factory()->kodeBarang('3.08.01.03.001')->create($ganti);
    }

    // --- Penjadwalan -----------------------------------------------------------

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/pemeliharaan')->assertUnauthorized();
    }

    public function test_dapat_menjadwalkan_pemeliharaan(): void
    {
        $alat = $this->alat();

        $this->actingAs($this->penggunaBerperan('lab-technician'))
            ->postJson('/api/pemeliharaan', [
                'asset_id' => $alat->id,
                'jenis' => 'preventif',
                'jadwal' => now()->addMonth()->toDateString(),
                'pelaksana' => 'Tim Teknik',
            ])
            ->assertCreated()
            ->assertJsonPath('data.jenis.nama', 'Pemeliharaan preventif')
            ->assertJsonPath('data.status.kode', 'dijadwalkan');
    }

    public function test_dapat_menjadwalkan_kalibrasi(): void
    {
        $alat = $this->alat(['wajib_kalibrasi' => true]);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/pemeliharaan', [
                'asset_id' => $alat->id,
                'jenis' => 'kalibrasi',
                'jadwal' => now()->addMonth()->toDateString(),
                'lembaga_kalibrasi' => 'BSN',
            ])
            ->assertCreated()
            ->assertJsonPath('data.jenis.kode', 'kalibrasi');
    }

    public function test_jenis_tidak_sah_ditolak(): void
    {
        $alat = $this->alat();

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/pemeliharaan', [
                'asset_id' => $alat->id, 'jenis' => 'entah',
                'jadwal' => now()->addMonth()->toDateString(),
            ])
            ->assertStatus(422)->assertJsonValidationErrors('jenis');
    }

    // --- Penyelesaian ------------------------------------------------------------

    public function test_pemeliharaan_dapat_diselesaikan(): void
    {
        $kerja = AssetMaintenance::factory()->create(['asset_id' => $this->alat()->id]);

        $this->actingAs($this->penggunaBerperan('lab-technician'))
            ->postJson("/api/pemeliharaan/{$kerja->id}/selesaikan", [
                'hasil' => 'Pembersihan dan penggantian filter',
                'biaya' => 250000,
            ])
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'selesai');

        $this->assertNotNull($kerja->fresh()->dikerjakan_pada);
    }

    public function test_kalibrasi_selesai_menuntut_sertifikat_dan_masa_berlaku(): void
    {
        $kerja = AssetMaintenance::factory()->kalibrasi()->create(['asset_id' => $this->alat()->id]);

        // Tanpa masa berlaku, alat akan dianggap sah selamanya dan tidak pernah
        // muncul sebagai kedaluwarsa.
        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/pemeliharaan/{$kerja->id}/selesaikan", ['hasil' => 'Lulus'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['no_sertifikat', 'berlaku_sampai']);

        $this->assertSame('dijadwalkan', $kerja->fresh()->status);
    }

    public function test_kalibrasi_lengkap_dapat_diselesaikan(): void
    {
        $kerja = AssetMaintenance::factory()->kalibrasi()->create(['asset_id' => $this->alat()->id]);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/pemeliharaan/{$kerja->id}/selesaikan", [
                'no_sertifikat' => 'KAL-2026-001',
                'lembaga_kalibrasi' => 'BSN',
                'berlaku_sampai' => now()->addYear()->toDateString(),
                'hasil' => 'Lulus, deviasi 0,2%',
            ])
            ->assertOk()
            ->assertJsonPath('data.kalibrasi.no_sertifikat', 'KAL-2026-001')
            ->assertJsonPath('data.kalibrasi.kedaluwarsa', false);
    }

    public function test_tidak_dapat_menyelesaikan_dua_kali(): void
    {
        $kerja = AssetMaintenance::factory()->create([
            'asset_id' => $this->alat()->id, 'status' => 'selesai',
            'dikerjakan_pada' => now()->subDay()->toDateString(),
        ]);

        $this->actingAs($this->penggunaBerperan('lab-technician'))
            ->postJson("/api/pemeliharaan/{$kerja->id}/selesaikan", [])
            ->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_kondisi_alat_ikut_diperbarui_beserta_riwayatnya(): void
    {
        $alat = $this->alat(['kondisi' => 'RR']);
        $kerja = AssetMaintenance::factory()->create(['asset_id' => $alat->id, 'jenis' => 'korektif']);

        $this->actingAs($this->penggunaBerperan('lab-technician'))
            ->postJson("/api/pemeliharaan/{$kerja->id}/selesaikan", [
                'hasil' => 'Perbaikan selesai',
                'kondisi_setelah' => 'B',
            ])
            ->assertOk();

        $this->assertSame('B', $alat->fresh()->kondisi);

        $riwayat = AssetMutation::where('asset_id', $alat->id)->where('jenis', 'kondisi')->firstOrFail();
        $this->assertSame('Rusak Ringan', $riwayat->nilai_lama);
        $this->assertSame('Baik', $riwayat->nilai_baru);
    }

    // --- Kedaluwarsa dan akibatnya pada peminjaman ---------------------------------

    public function test_alat_wajib_kalibrasi_tanpa_kalibrasi_dianggap_kedaluwarsa(): void
    {
        $alat = $this->alat(['wajib_kalibrasi' => true]);

        $this->assertTrue($alat->kalibrasiKedaluwarsa());
    }

    public function test_alat_tidak_wajib_kalibrasi_tidak_pernah_kedaluwarsa(): void
    {
        // Meja dan lemari asam tidak dikalibrasi.
        $alat = $this->alat(['wajib_kalibrasi' => false]);

        $this->assertFalse($alat->kalibrasiKedaluwarsa());
    }

    public function test_kalibrasi_masih_berlaku_tidak_kedaluwarsa(): void
    {
        $alat = $this->alat(['wajib_kalibrasi' => true]);
        AssetMaintenance::factory()->kalibrasi()
            ->selesai(now()->addMonths(6)->toDateString())
            ->create(['asset_id' => $alat->id]);

        $this->assertFalse($alat->fresh()->kalibrasiKedaluwarsa());
    }

    public function test_kalibrasi_lewat_masa_berlaku_kedaluwarsa(): void
    {
        $alat = $this->alat(['wajib_kalibrasi' => true]);
        AssetMaintenance::factory()->kalibrasi()
            ->selesai(now()->subMonth()->toDateString())
            ->create(['asset_id' => $alat->id]);

        $this->assertTrue($alat->fresh()->kalibrasiKedaluwarsa());
    }

    public function test_alat_kedaluwarsa_kalibrasi_tidak_dapat_dipinjam(): void
    {
        $alat = $this->alat(['wajib_kalibrasi' => true, 'nama' => 'Timbangan Analitik']);
        AssetMaintenance::factory()->kalibrasi()
            ->selesai(now()->subMonth()->toDateString())
            ->create(['asset_id' => $alat->id]);

        $this->actingAs($this->penggunaBerperan('employee'))
            ->postJson('/api/peminjaman', [
                'asset_id' => $alat->id,
                'keperluan' => 'Pengujian',
                'mulai' => now()->addDay()->toIso8601String(),
                'selesai' => now()->addDay()->addHours(3)->toIso8601String(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('asset_id');

        $this->assertDatabaseCount('equipment_loans', 0);
    }

    public function test_kalibrasi_yang_habis_setelah_pengajuan_menahan_serah_terima(): void
    {
        $alat = $this->alat(['wajib_kalibrasi' => true]);
        $kal = AssetMaintenance::factory()->kalibrasi()
            ->selesai(now()->addDays(3)->toDateString())
            ->create(['asset_id' => $alat->id]);

        $pinjaman = EquipmentLoan::factory()->create(['asset_id' => $alat->id]);

        // Masa berlaku habis di antara pengajuan dan pengambilan.
        $kal->update(['berlaku_sampai' => now()->subDay()->toDateString()]);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/peminjaman/{$pinjaman->id}/serahkan")
            ->assertStatus(422)
            ->assertJsonValidationErrors('asset_id');
    }

    public function test_daftar_alat_kedaluwarsa_kalibrasi(): void
    {
        $kedaluwarsa = $this->alat(['wajib_kalibrasi' => true, 'nama' => 'Sudah Lewat']);
        AssetMaintenance::factory()->kalibrasi()->selesai(now()->subMonth()->toDateString())
            ->create(['asset_id' => $kedaluwarsa->id]);

        $masihSah = $this->alat(['wajib_kalibrasi' => true, 'nama' => 'Masih Sah']);
        AssetMaintenance::factory()->kalibrasi()->selesai(now()->addMonths(6)->toDateString())
            ->create(['asset_id' => $masihSah->id]);

        $this->alat(['wajib_kalibrasi' => false, 'nama' => 'Tidak Perlu']);

        $nama = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson('/api/pemeliharaan/kalibrasi-kedaluwarsa')
            ->assertOk()->json('data.*.nama');

        $this->assertContains('Sudah Lewat', $nama);
        $this->assertNotContains('Masih Sah', $nama);
        $this->assertNotContains('Tidak Perlu', $nama);
    }

    // --- Jatuh tempo & keterlambatan -------------------------------------------------

    public function test_keterlambatan_dapat_ditapis(): void
    {
        $alat = $this->alat();
        AssetMaintenance::factory()->create([
            'asset_id' => $alat->id, 'jadwal' => now()->subWeek()->toDateString(),
        ]);
        AssetMaintenance::factory()->create([
            'asset_id' => $alat->id, 'jadwal' => now()->addMonth()->toDateString(),
        ]);

        $data = $this->actingAs($this->penggunaBerperan('lab-technician'))
            ->getJson('/api/pemeliharaan?terlambat=1')->assertOk()->json('data');

        $this->assertCount(1, $data);
        $this->assertTrue($data[0]['terlambat']);
    }

    // --- Otorisasi ---------------------------------------------------------------------

    public function test_izin_kalibrasi_dan_pemeliharaan_terpisah(): void
    {
        $alat = $this->alat();

        // Facility manager: pemeliharaan PENUH, kalibrasi hanya LIHAT.
        $fm = $this->penggunaBerperan('facility-manager');

        $this->actingAs($fm)->postJson('/api/pemeliharaan', [
            'asset_id' => $alat->id, 'jenis' => 'preventif',
            'jadwal' => now()->addMonth()->toDateString(),
        ])->assertCreated();

        $this->actingAs($fm)->postJson('/api/pemeliharaan', [
            'asset_id' => $alat->id, 'jenis' => 'kalibrasi',
            'jadwal' => now()->addMonth()->toDateString(),
        ])->assertForbidden();
    }

    public function test_employee_tidak_boleh_membaca(): void
    {
        // Matriks: employee pada pemeliharaan dan kalibrasi sama-sama '—'.
        $this->actingAs($this->penggunaBerperan('employee'))
            ->getJson('/api/pemeliharaan')->assertForbidden();
    }

    // --- Target: ruangan, laboratorium, atau alat ------------------------------------

    public function test_pemeliharaan_dapat_melekat_pada_ruangan(): void
    {
        $ruangan = Room::factory()->create();

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/pemeliharaan', [
                'room_id' => $ruangan->id, 'jenis' => 'korektif',
                'jadwal' => now()->addWeek()->toDateString(),
            ])
            ->assertCreated()->json('data');

        $this->assertSame('ruangan', $data['sumber_daya']['jenis']);
        $this->assertSame($ruangan->id, $data['sumber_daya']['id']);
    }

    public function test_pemeliharaan_dapat_melekat_pada_laboratorium(): void
    {
        $lab = Laboratory::factory()->create();

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/pemeliharaan', [
                'laboratory_id' => $lab->id, 'jenis' => 'darurat',
                'jadwal' => now()->toDateString(),
            ])
            ->assertCreated()->json('data');

        $this->assertSame('laboratorium', $data['sumber_daya']['jenis']);
        $this->assertSame('Penanganan darurat', $data['jenis']['nama']);
    }

    public function test_target_wajib_tepat_satu(): void
    {
        $alat = $this->alat();
        $ruangan = Room::factory()->create();

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/pemeliharaan', [
                'asset_id' => $alat->id, 'room_id' => $ruangan->id, 'jenis' => 'preventif',
                'jadwal' => now()->addWeek()->toDateString(),
            ])
            ->assertStatus(422);

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/pemeliharaan', [
                'jenis' => 'preventif', 'jadwal' => now()->addWeek()->toDateString(),
            ])
            ->assertStatus(422);

        $this->assertDatabaseCount('asset_maintenances', 0);
    }

    public function test_kalibrasi_ditolak_untuk_ruangan(): void
    {
        $ruangan = Room::factory()->create();

        // Kalibrasi hanya bermakna untuk alat — menegakkannya di lapisan
        // aplikasi dengan pesan yang terbaca; batasan CHECK menegakkannya
        // lagi di basis data walau lapisan ini dilewati.
        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/pemeliharaan', [
                'room_id' => $ruangan->id, 'jenis' => 'kalibrasi',
                'jadwal' => now()->addWeek()->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('asset_id');
    }

    public function test_basis_data_menolak_kalibrasi_pada_ruangan_walau_lapis_aplikasi_dilewati(): void
    {
        $ruangan = Room::factory()->create();

        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/asset_maintenances_kalibrasi_hanya_alat/');

        AssetMaintenance::create([
            'room_id' => $ruangan->id, 'jenis' => 'kalibrasi',
            'jadwal' => now()->addWeek()->toDateString(), 'status' => 'dijadwalkan',
        ]);
    }

    public function test_basis_data_menolak_target_ganda_walau_lapis_aplikasi_dilewati(): void
    {
        $ruangan = Room::factory()->create();
        $alat = $this->alat();

        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/asset_maintenances_target_tunggal/');

        AssetMaintenance::create([
            'room_id' => $ruangan->id, 'asset_id' => $alat->id, 'jenis' => 'preventif',
            'jadwal' => now()->addWeek()->toDateString(), 'status' => 'dijadwalkan',
        ]);
    }

    public function test_menyelesaikan_pemeliharaan_ruangan_tidak_menyentuh_kondisi_aset(): void
    {
        // Tidak ada asset_id sama sekali pada pekerjaan ini — pastikan
        // penyelesaiannya tidak mencoba membaca ->asset->kondisi dan gagal.
        $kerja = AssetMaintenance::factory()->room()->create(['jenis' => 'korektif']);

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson("/api/pemeliharaan/{$kerja->id}/selesaikan", [
                'hasil' => 'Plafon diperbaiki', 'kondisi_setelah' => 'B',
            ])
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'selesai');
    }

    public function test_widget_pemeliharaan_ikut_menghitung_target_ruangan_dan_laboratorium(): void
    {
        $gedungA = Room::factory()->create(['gedung' => 'Gedung A']);
        AssetMaintenance::factory()->room()->create(['room_id' => $gedungA->id, 'jenis' => 'korektif']);
        AssetMaintenance::factory()->laboratory()->create(['jenis' => 'preventif']);
        AssetMaintenance::factory()->create(['asset_id' => $this->alat()->id, 'jenis' => 'preventif']);

        $pengelola = $this->penggunaBerperan('facility-manager');
        $d = Dashboard::create(['nama' => 'x', 'user_id' => $pengelola->id, 'jenis' => 'operasional']);
        $d->widgets()->create(['widget' => 'pemeliharaan.aktif', 'kolom' => 0, 'baris' => 0, 'lebar' => 3, 'tinggi' => 2]);

        $data = $this->actingAs($pengelola)->getJson('/api/dashboard/'.$d->id)
            ->assertOk()->json('data.widgets.0.data');

        // Ketiganya terhitung — bukan hanya yang melekat pada alat.
        $this->assertSame(3, $data['nilai']);
    }
}
