<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetAuditScan;
use App\Models\AssetAuditSession;
use App\Models\BmnKodeBarang;
use App\Models\Room;
use App\Models\UserGedung;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Audit Aset — stock opname. Yang dijaga paling keras: "tidak ditemukan"
 * tidak pernah disimpan sebagai baris tersendiri, hanya dihitung dari
 * selisih populasi vs yang sudah dipindai (lihat AssetAuditService).
 */
class AssetAuditApiTest extends TestCase
{
    use RefreshDatabase;

    private function aset(array $ganti = []): Asset
    {
        if (! BmnKodeBarang::where('kode', '3.08.01.03.001')->exists()) {
            BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        }

        return Asset::factory()->kodeBarang('3.08.01.03.001')->create($ganti);
    }

    private function sesi(array $ganti = []): AssetAuditSession
    {
        return AssetAuditSession::factory()->create($ganti);
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/audit-aset')->assertUnauthorized();
        $this->postJson('/api/audit-aset', [])->assertUnauthorized();
    }

    public function test_asset_manager_dapat_memulai_sesi(): void
    {
        $user = $this->penggunaBerperan('asset-manager');

        $data = $this->actingAs($user)
            ->postJson('/api/audit-aset', ['nama' => 'Audit Semester I 2026', 'mulai' => now()->toDateString()])
            ->assertCreated()
            ->json('data');

        $this->assertSame('Audit Semester I 2026', $data['nama']);
        $this->assertSame('berjalan', $data['status']['kode']);
        $this->assertSame($user->id, $data['pembuat']['id']);
    }

    public function test_lab_manager_hanya_boleh_lihat_tidak_boleh_menulis(): void
    {
        $user = $this->penggunaBerperan('lab-manager');
        $sesi = $this->sesi();

        $this->actingAs($user)->getJson('/api/audit-aset')->assertOk();
        $this->actingAs($user)->postJson('/api/audit-aset', ['nama' => 'x', 'mulai' => now()->toDateString()])->assertForbidden();
        $this->actingAs($user)->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'x'])->assertForbidden();
    }

    public function test_employee_ditolak_sepenuhnya(): void
    {
        $user = $this->penggunaBerperan('employee');

        $this->actingAs($user)->getJson('/api/audit-aset')->assertForbidden();
    }

    public function test_scan_ditemukan_sesuai_catatan(): void
    {
        $room = Room::factory()->create(['gedung' => 'Gedung A', 'nama' => 'LAB-001']);
        $aset = $this->aset(['room_id' => $room->id, 'kondisi' => 'B', 'kode_internal' => 'STU/LAB/AA001']);
        $sesi = $this->sesi();

        $data = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'STU/LAB/AA001'])
            ->assertCreated()
            ->json('data');

        $this->assertSame($aset->id, $data['aset']['id']);
        $this->assertSame('sesuai', $data['temuan']['kode']);
        $this->assertSame('Gedung A / LAB-001', $data['lokasi']['tercatat']);
        $this->assertSame('Gedung A / LAB-001', $data['lokasi']['ditemukan']);
    }

    public function test_scan_dapat_dicari_lewat_bmn_id_atau_serial_number(): void
    {
        $aset = $this->aset(['serial_number' => 'SN-UNIK-001']);
        $sesi = $this->sesi();

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'SN-UNIK-001'])
            ->assertCreated()
            ->assertJsonPath('data.aset.id', $aset->id);
    }

    public function test_kode_tidak_dikenali_ditolak(): void
    {
        $sesi = $this->sesi();

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'TIDAK-ADA'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('kode');
    }

    public function test_lokasi_berbeda_terdeteksi(): void
    {
        $room = Room::factory()->create(['gedung' => 'Gedung A', 'nama' => 'LAB-001']);
        $this->aset(['room_id' => $room->id, 'kode_internal' => 'STU/LAB/BB001']);
        $sesi = $this->sesi();

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson("/api/audit-aset/{$sesi->id}/scan", [
                'kode' => 'STU/LAB/BB001', 'lokasi_ditemukan' => 'Gudang Pusat',
            ])
            ->assertCreated()
            ->assertJsonPath('data.temuan.kode', 'lokasi_berbeda');
    }

    public function test_kondisi_berbeda_terdeteksi(): void
    {
        $this->aset(['kondisi' => 'B', 'kode_internal' => 'STU/LAB/CC001']);
        $sesi = $this->sesi();

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson("/api/audit-aset/{$sesi->id}/scan", [
                'kode' => 'STU/LAB/CC001', 'kondisi_ditemukan' => 'RR',
            ])
            ->assertCreated()
            ->assertJsonPath('data.temuan.kode', 'kondisi_berbeda');
    }

    public function test_memindai_ulang_memperbarui_baris_bukan_menggandakan(): void
    {
        $this->aset(['kode_internal' => 'STU/LAB/DD001']);
        $sesi = $this->sesi();
        $user = $this->penggunaBerperan('asset-manager');

        $this->actingAs($user)->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'STU/LAB/DD001'])->assertCreated();
        $this->actingAs($user)->postJson("/api/audit-aset/{$sesi->id}/scan", [
            'kode' => 'STU/LAB/DD001', 'lokasi_ditemukan' => 'Gudang Pusat',
        ])->assertCreated();

        $this->assertSame(1, AssetAuditScan::where('asset_audit_session_id', $sesi->id)->count());
    }

    public function test_scan_pada_sesi_tertutup_ditolak(): void
    {
        $this->aset(['kode_internal' => 'STU/LAB/EE001']);
        $sesi = $this->sesi(['status' => 'selesai', 'selesai_pada' => now()]);

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'STU/LAB/EE001'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('sesi');
    }

    public function test_tutup_sesi_ganda_ditolak(): void
    {
        $sesi = $this->sesi(['status' => 'selesai', 'selesai_pada' => now()]);

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson("/api/audit-aset/{$sesi->id}/tutup")
            ->assertStatus(422)
            ->assertJsonValidationErrors('sesi');
    }

    public function test_ringkasan_belum_diaudit_berubah_jadi_tidak_ditemukan_setelah_ditutup(): void
    {
        $this->aset(['kode_internal' => 'STU/LAB/FF001']);
        $this->aset(['kode_internal' => 'STU/LAB/FF002']);
        $sesi = $this->sesi();
        $user = $this->penggunaBerperan('asset-manager');

        // Hanya satu dari dua aset yang dipindai.
        $this->actingAs($user)->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'STU/LAB/FF001'])->assertCreated();

        $berjalan = $this->actingAs($user)->getJson("/api/audit-aset/{$sesi->id}")->assertOk()->json('data.ringkasan');
        $this->assertSame(2, $berjalan['total_aset']);
        $this->assertSame(1, $berjalan['sudah_diverifikasi']);
        $this->assertSame(1, $berjalan['belum_diaudit']);
        $this->assertSame(0, $berjalan['tidak_ditemukan']);

        $this->actingAs($user)->postJson("/api/audit-aset/{$sesi->id}/tutup")->assertOk();

        $selesai = $this->actingAs($user)->getJson("/api/audit-aset/{$sesi->id}")->assertOk()->json('data.ringkasan');
        $this->assertSame(0, $selesai['belum_diaudit']);
        $this->assertSame(1, $selesai['tidak_ditemukan']);
    }

    public function test_temuan_hanya_memuat_baris_yang_menyimpang(): void
    {
        $this->aset(['kode_internal' => 'STU/LAB/GG001', 'kondisi' => 'B']);
        $this->aset(['kode_internal' => 'STU/LAB/GG002', 'kondisi' => 'B']);
        $sesi = $this->sesi();
        $user = $this->penggunaBerperan('asset-manager');

        $this->actingAs($user)->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'STU/LAB/GG001'])->assertCreated();
        $this->actingAs($user)->postJson("/api/audit-aset/{$sesi->id}/scan", [
            'kode' => 'STU/LAB/GG002', 'kondisi_ditemukan' => 'RB',
        ])->assertCreated();

        $temuan = $this->actingAs($user)->getJson("/api/audit-aset/{$sesi->id}")->assertOk()->json('data.temuan');
        $this->assertCount(1, $temuan);
        $this->assertSame('kondisi_berbeda', $temuan[0]['temuan']['kode']);
    }

    public function test_populasi_dan_pemindaian_dibatasi_cakupan_gedung(): void
    {
        $room = Room::factory()->create(['gedung' => 'Gedung A', 'nama' => 'LAB-001']);
        $roomLain = Room::factory()->create(['gedung' => 'Gedung B', 'nama' => 'LAB-002']);
        $this->aset(['room_id' => $room->id, 'kode_internal' => 'STU/LAB/HH001']);
        $this->aset(['room_id' => $roomLain->id, 'kode_internal' => 'STU/LAB/HH002']);
        $sesi = $this->sesi();

        $fm = $this->penggunaBerperan('facility-manager');
        UserGedung::create(['user_id' => $fm->id, 'gedung' => 'Gedung A']);

        // Populasi hanya menghitung aset gedung yang diampu.
        $ringkasan = $this->actingAs($fm)->getJson("/api/audit-aset/{$sesi->id}")->assertOk()->json('data.ringkasan');
        $this->assertSame(1, $ringkasan['total_aset']);

        // Memindai aset di luar cakupan ditolak — kode itu "tidak dikenali"
        // baginya, persis seperti aset itu tidak ada.
        $this->actingAs($fm)->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'STU/LAB/HH002'])
            ->assertStatus(422)->assertJsonValidationErrors('kode');
    }

    public function test_daftar_sesi_memuat_jumlah_pindaian(): void
    {
        $this->aset(['kode_internal' => 'STU/LAB/II001']);
        $sesi = $this->sesi();
        $user = $this->penggunaBerperan('asset-manager');
        $this->actingAs($user)->postJson("/api/audit-aset/{$sesi->id}/scan", ['kode' => 'STU/LAB/II001'])->assertCreated();

        $this->actingAs($user)->getJson('/api/audit-aset')->assertOk()->assertJsonCount(1, 'data');
    }
}
