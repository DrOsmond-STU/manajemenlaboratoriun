<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\Laboratory;
use App\Models\Room;
use App\Models\UserGedung;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Master data laboratorium.
 *
 * Laboratorium sengaja terpisah dari ruangan: ruangan adalah tempat fisik
 * yang dapat dipesan per jam, laboratorium adalah unit kerja teknis yang
 * menempatinya. Satu laboratorium dapat pindah ruangan tanpa berganti
 * identitas — dan uji di bawah menjaga sifat itu.
 */
class LaboratoryApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string,mixed>
     */
    private function isian(array $ganti = []): array
    {
        return array_merge([
            'kode' => 'LAB-KIM-01',
            'nama' => 'Laboratorium Kimia Analitik',
            'jenis' => 'Pengujian',
            'luas_m2' => 145,
            'kapasitas' => 24,
            'jam_layanan' => '07:30 – 17:00',
            'akreditasi' => 'ISO/IEC 17025:2017',
            'status' => 'aktif',
        ], $ganti);
    }

    private function aset(Laboratory $lab): Asset
    {
        BmnKodeBarang::firstOrCreate(
            ['kode' => '3.08.01.03.001'],
            ['uraian' => 'Alat uji', 'masa_manfaat' => 8],
        );

        return Asset::factory()->kodeBarang('3.08.01.03.001')->create(['laboratory_id' => $lab->id]);
    }

    // --- Dasar --------------------------------------------------------------

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/laboratories')->assertUnauthorized();
    }

    public function test_dapat_membuat_laboratorium(): void
    {
        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/laboratories', $this->isian())
            ->assertCreated()
            ->assertJsonPath('data.kode', 'LAB-KIM-01')
            ->assertJsonPath('data.status.nama', 'Aktif');

        $this->assertDatabaseHas('laboratories', ['kode' => 'LAB-KIM-01']);
    }

    public function test_kode_kembar_ditolak(): void
    {
        Laboratory::factory()->create(['kode' => 'LAB-KIM-01']);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/laboratories', $this->isian())
            ->assertStatus(422)
            ->assertJsonValidationErrors('kode');
    }

    public function test_status_tidak_sah_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/laboratories', $this->isian(['status' => 'entah']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    // --- Hubungan dengan ruangan ---------------------------------------------

    public function test_laboratorium_menempati_ruangan(): void
    {
        $room = Room::factory()->create(['kode' => 'R-201', 'gedung' => 'Gedung A']);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/laboratories', $this->isian(['room_id' => $room->id]))
            ->assertCreated()
            ->assertJsonPath('data.ruangan.kode', 'R-201')
            ->assertJsonPath('data.ruangan.gedung', 'Gedung A');
    }

    public function test_laboratorium_bertahan_saat_ruangannya_dihapus(): void
    {
        $room = Room::factory()->create();
        $lab = Laboratory::factory()->create(['room_id' => $room->id]);

        $room->forceDelete();

        // Identitas laboratorium berdiri sendiri; ia hanya kehilangan tempat,
        // bukan ikut terhapus.
        $lab->refresh();
        $this->assertNotNull($lab->id);
        $this->assertNull($lab->room_id);
    }

    public function test_laboratorium_dapat_pindah_ruangan(): void
    {
        $lama = Room::factory()->create(['kode' => 'R-201']);
        $baru = Room::factory()->create(['kode' => 'R-305']);
        $lab = Laboratory::factory()->create(['room_id' => $lama->id]);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->patchJson("/api/laboratories/{$lab->id}", ['room_id' => $baru->id])
            ->assertOk()
            ->assertJsonPath('data.ruangan.kode', 'R-305');

        // Kodenya tidak berubah — identitasnya tetap.
        $this->assertSame($lab->kode, $lab->fresh()->kode);
    }

    // --- Penghapusan ----------------------------------------------------------

    public function test_laboratorium_tanpa_aset_dapat_dihapus(): void
    {
        $lab = Laboratory::factory()->create();

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->deleteJson("/api/laboratories/{$lab->id}")
            ->assertOk();

        $this->assertSoftDeleted('laboratories', ['id' => $lab->id]);
    }

    public function test_laboratorium_beraset_tidak_dapat_dihapus(): void
    {
        $lab = Laboratory::factory()->create();
        $this->aset($lab);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->deleteJson("/api/laboratories/{$lab->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('laboratory');

        // nullOnDelete hanya bekerja pada penghapusan permanen; tanpa penjaga
        // aplikasi, asetnya akan menunjuk laboratorium hantu.
        $this->assertDatabaseHas('laboratories', ['id' => $lab->id, 'deleted_at' => null]);
    }

    // --- Daftar & tapis --------------------------------------------------------

    public function test_daftar_menghitung_aset_dan_dapat_ditapis(): void
    {
        $a = Laboratory::factory()->create(['kode' => 'LAB-A', 'jenis' => 'Pengujian']);
        Laboratory::factory()->create(['kode' => 'LAB-B', 'jenis' => 'Riset', 'status' => 'tidak_aktif']);
        $this->aset($a);
        $this->aset($a);

        $pengguna = $this->penggunaBerperan('lab-manager');

        $this->actingAs($pengguna)->getJson('/api/laboratories')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.jumlah_aset', 2);

        $this->actingAs($pengguna)->getJson('/api/laboratories?jenis=Riset')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.kode', 'LAB-B');

        $this->actingAs($pengguna)->getJson('/api/laboratories?status=tidak_aktif')
            ->assertOk()->assertJsonCount(1, 'data');
    }

    // --- Cakupan data -----------------------------------------------------------

    public function test_dibatasi_gedung_ruangan_yang_ditempati(): void
    {
        $a = Room::factory()->create(['gedung' => 'Gedung A']);
        $b = Room::factory()->create(['gedung' => 'Gedung B']);

        Laboratory::factory()->create(['kode' => 'LAB-A', 'room_id' => $a->id]);
        Laboratory::factory()->create(['kode' => 'LAB-B', 'room_id' => $b->id]);
        Laboratory::factory()->create(['kode' => 'LAB-BARU', 'room_id' => null]);

        $lm = $this->penggunaBerperan('lab-manager');
        UserGedung::create(['user_id' => $lm->id, 'gedung' => 'Gedung A']);

        $kode = $this->actingAs($lm)->getJson('/api/laboratories')->assertOk()->json('data.*.kode');

        $this->assertContains('LAB-A', $kode);
        $this->assertContains('LAB-BARU', $kode, 'Lab yang belum punya ruangan tidak boleh hilang.');
        $this->assertNotContains('LAB-B', $kode);
    }

    // --- Otorisasi ---------------------------------------------------------------

    /**
     * @return list<array{string, bool}>
     */
    public static function peranBaca(): array
    {
        return [
            'lab manager boleh' => ['lab-manager', true],
            'facility manager boleh' => ['facility-manager', true],
            'lab technician boleh' => ['lab-technician', true],
            'employee boleh' => ['employee', true],
            'finance TIDAK boleh' => ['finance', false],
            'external user TIDAK boleh' => ['external-user', false],
        ];
    }

    #[DataProvider('peranBaca')]
    public function test_membaca_daftar(string $peran, bool $boleh): void
    {
        $this->actingAs($this->penggunaBerperan($peran))
            ->getJson('/api/laboratories')
            ->assertStatus($boleh ? 200 : 403);
    }

    public function test_employee_tidak_boleh_menulis(): void
    {
        $lab = Laboratory::factory()->create();
        $pengguna = $this->penggunaBerperan('employee');

        $this->actingAs($pengguna)->postJson('/api/laboratories', $this->isian())->assertForbidden();
        $this->actingAs($pengguna)->patchJson("/api/laboratories/{$lab->id}", ['nama' => 'X'])->assertForbidden();
        $this->actingAs($pengguna)->deleteJson("/api/laboratories/{$lab->id}")->assertForbidden();
    }

    public function test_asset_manager_boleh_lihat_tetapi_tidak_ubah(): void
    {
        $lab = Laboratory::factory()->create();
        $pengguna = $this->penggunaBerperan('asset-manager');

        // Matriks: asset-manager pada modul laboratorium hanya LIHAT.
        $this->actingAs($pengguna)->getJson('/api/laboratories')->assertOk();
        $this->actingAs($pengguna)->patchJson("/api/laboratories/{$lab->id}", ['nama' => 'X'])->assertForbidden();
    }
}
