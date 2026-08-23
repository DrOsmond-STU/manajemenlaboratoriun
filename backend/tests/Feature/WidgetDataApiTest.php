<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\BmnKodeBarang;
use App\Models\Booking;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GET /api/dashboard/widget — angka satu widget lepas dari tata letak
 * dashboard mana pun.
 *
 * Dipakai layar Laporan yang butuh angka YANG SAMA PERSIS dengan yang
 * ditampilkan dashboard (dihitung DataWidget, bukan diulang di tempat
 * lain), tanpa memaksa layar itu ikut memasang widget ke dashboard
 * pengguna.
 */
class WidgetDataApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/dashboard/widget?kunci=ruangan.utilisasi')->assertUnauthorized();
    }

    public function test_kunci_tidak_dikenal_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson('/api/dashboard/widget?kunci=tidak.ada')
            ->assertNotFound();
    }

    public function test_mengembalikan_angka_yang_sama_dengan_dashboard(): void
    {
        $user = $this->penggunaBerperan('facility-manager');
        Room::factory()->count(2)->create();

        $langsung = $this->actingAs($user)
            ->getJson('/api/dashboard/widget?kunci=ruangan.utilisasi')
            ->assertOk()
            ->json('data');

        $this->assertArrayHasKey('nilai', $langsung);
    }

    public function test_sebaran_status_booking_dihitung_benar(): void
    {
        $user = $this->penggunaBerperan('facility-manager');
        $room = Room::factory()->create();

        Booking::factory()->for($room)->for($user)->create(['status' => 'disetujui']);
        Booking::factory()->for($room)->for($user)->create(['status' => 'dibatalkan']);
        Booking::factory()->for($room)->for($user)->create(['status' => 'dibatalkan']);

        $data = $this->actingAs($user)
            ->getJson('/api/dashboard/widget?kunci=booking.status')
            ->assertOk()
            ->json('data');

        $this->assertSame(3, $data['nilai']);
        $dibatalkan = collect($data['bagian'])->firstWhere('kode', 'dibatalkan');
        $this->assertSame(2, $dibatalkan['jumlah']);
    }

    public function test_widget_tanpa_izin_mengembalikan_penanda_bukan_angka(): void
    {
        // employee tidak punya izin penyewaan.lihat pada matriks akses.
        $data = $this->actingAs($this->penggunaBerperan('employee'))
            ->getJson('/api/dashboard/widget?kunci=penyewaan.pendapatan-ytd')
            ->assertOk()
            ->json('data');

        $this->assertNull($data['nilai']);
        $this->assertArrayHasKey('pesan', $data);
    }

    public function test_kepatuhan_kalibrasi_dihitung_dari_sisi_aset(): void
    {
        $user = $this->penggunaBerperan('asset-manager');
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();

        // Kalibrasi masih berlaku — patuh.
        $patuh = Asset::factory()->kodeBarang('3.08.01.03.001')->create(['wajib_kalibrasi' => true]);
        AssetMaintenance::factory()->for($patuh)->kalibrasi()
            ->selesai(now()->addMonths(3)->toDateString())->create();

        // Belum pernah dikalibrasi sama sekali — kedaluwarsa, bukan patuh.
        Asset::factory()->kodeBarang('3.08.01.03.001')->create(['wajib_kalibrasi' => true]);

        // Tidak wajib kalibrasi — tidak ikut dihitung sama sekali.
        Asset::factory()->kodeBarang('3.08.01.03.001')->create(['wajib_kalibrasi' => false]);

        $data = $this->actingAs($user)
            ->getJson('/api/dashboard/widget?kunci=aset.kepatuhan-kalibrasi')
            ->assertOk()
            ->json('data');

        // 1 dari 2 aset wajib kalibrasi patuh = 50%.
        $this->assertEquals(50.0, $data['nilai']);
    }
}
