<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\BmnKodeBarang;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string,mixed>
     */
    private function isian(array $ganti = []): array
    {
        return array_merge([
            'kode' => 'VN-101',
            'nama' => 'PT Sonic Nusantara',
            'kategori' => 'Audio Visual',
            'pic_nama' => 'Budi Santoso',
            'pic_telepon' => '0812-9911-002',
            'rating' => 4.8,
        ], $ganti);
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/vendors')->assertUnauthorized();
        $this->postJson('/api/vendors', $this->isian())->assertUnauthorized();
    }

    public function test_facility_manager_dapat_mendaftarkan_vendor(): void
    {
        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/vendors', $this->isian())
            ->assertCreated()
            ->json('data');

        $this->assertSame('PT Sonic Nusantara', $data['nama']);
        $this->assertSame('Budi Santoso', $data['pic']['nama']);
        $this->assertTrue($data['aktif']);
        $this->assertSame(0, $data['jumlah_pekerjaan']);
    }

    public function test_employee_tidak_boleh_melihat_apalagi_menulis(): void
    {
        $user = $this->penggunaBerperan('employee');

        $this->actingAs($user)->getJson('/api/vendors')->assertForbidden();
        $this->actingAs($user)->postJson('/api/vendors', $this->isian())->assertForbidden();
    }

    public function test_kode_kembar_ditolak(): void
    {
        Vendor::factory()->create(['kode' => 'VN-101']);

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/vendors', $this->isian())
            ->assertStatus(422)
            ->assertJsonValidationErrors('kode');
    }

    public function test_rating_di_luar_0_sampai_5_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/vendors', $this->isian(['rating' => 5.5]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('rating');
    }

    public function test_tanpa_kontrak_tetap_boleh_dikosongkan(): void
    {
        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/vendors', $this->isian())
            ->assertCreated()
            ->json('data');

        $this->assertNull($data['kontrak_berlaku_sampai']);
    }

    public function test_daftar_dapat_dicari_dan_ditapis_kategori(): void
    {
        $user = $this->penggunaBerperan('facility-manager');
        Vendor::factory()->create(['nama' => 'PT Sonic Nusantara', 'kategori' => 'Audio Visual']);
        Vendor::factory()->create(['nama' => 'PT Kalibrasi Presisi', 'kategori' => 'Kalibrasi']);

        $this->actingAs($user)->getJson('/api/vendors?cari=Sonic')
            ->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($user)->getJson('/api/vendors?kategori=Kalibrasi')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'PT Kalibrasi Presisi');
    }

    public function test_nonaktifkan_bukan_menghapus_baris(): void
    {
        $vendor = Vendor::factory()->create();

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->deleteJson('/api/vendors/'.$vendor->id)
            ->assertOk()
            ->assertJsonFragment(['pesan' => 'Vendor dinonaktifkan. Riwayat pekerjaan tetap tersimpan.']);

        $this->assertDatabaseHas('vendors', ['id' => $vendor->id, 'aktif' => false]);
    }

    public function test_jumlah_pekerjaan_dan_total_biaya_dihitung_dari_pemeliharaan(): void
    {
        $vendor = Vendor::factory()->create();
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $aset = Asset::factory()->kodeBarang('3.08.01.03.001')->create();

        AssetMaintenance::factory()->for($aset)->create(['vendor_id' => $vendor->id, 'biaya' => 5_000_000]);
        AssetMaintenance::factory()->for($aset)->create(['vendor_id' => $vendor->id, 'biaya' => 3_000_000]);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson('/api/vendors/'.$vendor->id)
            ->assertOk()
            ->json('data');

        $this->assertSame(2, $data['jumlah_pekerjaan']);
        $this->assertSame(8_000_000, $data['total_biaya']);
    }

    public function test_menghapus_pekerjaan_pemeliharaan_bukan_syarat__vendor_dapat_ditautkan_saat_penjadwalan(): void
    {
        $vendor = Vendor::factory()->create();
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $aset = Asset::factory()->kodeBarang('3.08.01.03.001')->create();

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/pemeliharaan', [
                'asset_id' => $aset->id,
                'jenis' => 'preventif',
                'jadwal' => now()->addWeek()->toDateString(),
                'vendor_id' => $vendor->id,
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame($vendor->id, $data['vendor']['id']);
        $this->assertSame($vendor->nama, $data['vendor']['nama']);
    }

    public function test_vendor_dihapus_tidak_menghalangi_riwayat_pekerjaan_lama(): void
    {
        $vendor = Vendor::factory()->create();
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $aset = Asset::factory()->kodeBarang('3.08.01.03.001')->create();
        $pekerjaan = AssetMaintenance::factory()->for($aset)->create(['vendor_id' => $vendor->id]);

        // destroy() menonaktifkan, bukan menghapus baris — tetapi seandainya
        // barisnya benar-benar hilang (mis. lewat migrasi rollback masa
        // depan), nullOnDelete harus tetap membiarkan riwayat pekerjaan
        // lama terbaca, bukan ikut terhapus.
        $vendor->delete();

        $this->assertDatabaseHas('asset_maintenances', ['id' => $pekerjaan->id]);
    }
}
