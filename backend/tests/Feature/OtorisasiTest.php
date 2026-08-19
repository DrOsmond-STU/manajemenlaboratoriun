<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\Room;
use App\Models\User;
use App\Support\MatriksAkses;
use Database\Seeders\PeranIzinSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Otorisasi per peran.
 *
 * Kesalahan otorisasi tidak pernah menampakkan diri: tidak ada galat, tidak
 * ada keluhan pengguna. Yang terjadi hanyalah seseorang diam-diam boleh
 * melakukan hal yang seharusnya tidak boleh — dan itu baru ketahuan saat
 * sudah terjadi.
 *
 * Karena itu uji di sini memeriksa DUA arah: yang berhak dapat masuk, dan
 * yang tidak berhak ditolak. Menguji arah pertama saja akan sama-sama lulus
 * pada sistem yang mengizinkan semua orang.
 */
class OtorisasiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->siapkanPeran();
    }

    private function aset(): Asset
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();

        return Asset::factory()->kodeBarang('3.08.01.03.001')->create();
    }

    // --- Matriks terwujud sebagai izin -------------------------------------

    public function test_setiap_peran_pada_matriks_terbentuk(): void
    {
        foreach (array_keys(MatriksAkses::NAMA_PERAN) as $peran) {
            $this->assertDatabaseHas('roles', ['name' => $peran]);
        }
    }

    public function test_izin_peran_sesuai_matriks(): void
    {
        foreach (array_keys(MatriksAkses::MATRIKS) as $peran) {
            $pengguna = $this->penggunaBerperan($peran);
            $dimiliki = $pengguna->getAllPermissions()->pluck('name')->sort()->values()->all();
            $diharapkan = collect(MatriksAkses::izinPeran($peran))->sort()->values()->all();

            $this->assertSame($diharapkan, $dimiliki, "Izin peran {$peran} menyimpang dari matriks.");
        }
    }

    public function test_seeder_mencabut_izin_yang_tidak_lagi_di_matriks(): void
    {
        $peran = Role::findByName('employee');
        $peran->givePermissionTo('aset.hapus');

        $this->assertTrue($peran->fresh()->hasPermissionTo('aset.hapus'));

        $this->seed(PeranIzinSeeder::class);

        // Tanpa syncPermissions, izin keliru semacam ini menempel selamanya.
        $this->assertFalse($peran->fresh()->hasPermissionTo('aset.hapus'));
    }

    // --- Penerapan pada rute aset ------------------------------------------

    /**
     * @return list<array{string, bool}>
     */
    public static function peranBacaAset(): array
    {
        return [
            'super admin boleh' => ['super-admin', true],
            'asset manager boleh' => ['asset-manager', true],
            'lab manager boleh' => ['lab-manager', true],
            'finance boleh' => ['finance', true],
            'employee TIDAK boleh' => ['employee', false],
            'external user TIDAK boleh' => ['external-user', false],
        ];
    }

    #[DataProvider('peranBacaAset')]
    public function test_membaca_daftar_aset(string $peran, bool $boleh): void
    {
        $respons = $this->actingAs($this->penggunaBerperan($peran))->getJson('/api/assets');

        $respons->assertStatus($boleh ? 200 : 403);
    }

    /**
     * @return list<array{string, bool}>
     */
    public static function peranHapusAset(): array
    {
        return [
            'super admin boleh' => ['super-admin', true],
            'asset manager boleh' => ['asset-manager', true],
            // facility manager hanya UBAH pada matriks — bukan PENUH.
            'facility manager TIDAK boleh' => ['facility-manager', false],
            'lab manager TIDAK boleh' => ['lab-manager', false],
            'employee TIDAK boleh' => ['employee', false],
        ];
    }

    #[DataProvider('peranHapusAset')]
    public function test_menghapus_aset(string $peran, bool $boleh): void
    {
        $aset = $this->aset();

        $respons = $this->actingAs($this->penggunaBerperan($peran))
            ->deleteJson("/api/assets/{$aset->id}");

        $respons->assertStatus($boleh ? 200 : 403);

        if (! $boleh) {
            $this->assertDatabaseHas('assets', ['id' => $aset->id, 'deleted_at' => null]);
        }
    }

    public function test_facility_manager_boleh_mengubah_tetapi_tidak_menghapus(): void
    {
        $aset = $this->aset();
        $pengguna = $this->penggunaBerperan('facility-manager');

        // UBAH pada matriks berarti boleh mengubah…
        $this->actingAs($pengguna)
            ->patchJson("/api/assets/{$aset->id}", ['nama' => 'Nama Baru'])
            ->assertOk();

        // …tetapi tidak menghapus.
        $this->actingAs($pengguna)
            ->deleteJson("/api/assets/{$aset->id}")
            ->assertForbidden();
    }

    // --- Penerapan pada rute booking ---------------------------------------

    public function test_employee_boleh_mengajukan_booking(): void
    {
        $room = Room::factory()->create();

        $this->actingAs($this->penggunaBerperan('employee'))
            ->postJson('/api/bookings', [
                'room_id' => $room->id,
                'keperluan' => 'Rapat tim',
                'mulai' => now()->addDay()->toIso8601String(),
                'selesai' => now()->addDay()->addHours(2)->toIso8601String(),
            ])
            ->assertCreated();
    }

    public function test_finance_tidak_boleh_mengajukan_booking(): void
    {
        $room = Room::factory()->create();

        // Finance hanya LIHAT pada booking ruangan.
        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson('/api/bookings', [
                'room_id' => $room->id,
                'keperluan' => 'Rapat tim',
                'mulai' => now()->addDay()->toIso8601String(),
                'selesai' => now()->addDay()->addHours(2)->toIso8601String(),
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('bookings', 0);
    }

    // --- Super admin --------------------------------------------------------

    public function test_super_admin_melewati_pemeriksaan_izin(): void
    {
        $aset = $this->aset();
        $pengguna = $this->penggunaBerperan('super-admin');

        $this->actingAs($pengguna)->getJson('/api/assets')->assertOk();
        $this->actingAs($pengguna)->deleteJson("/api/assets/{$aset->id}")->assertOk();
    }

    public function test_pengguna_tanpa_peran_ditolak_di_mana_pun(): void
    {
        $pengguna = User::factory()->create();

        $this->actingAs($pengguna)->getJson('/api/assets')->assertForbidden();
        $this->actingAs($pengguna)->getJson('/api/bookings')->assertForbidden();
        $this->actingAs($pengguna)->getJson('/api/bmn/kode-barang')->assertForbidden();

        // Identitas diri tetap boleh dibaca — tanpa itu antarmuka tidak dapat
        // memberi tahu pengguna bahwa ia belum diberi peran.
        $this->actingAs($pengguna)->getJson('/api/saya')->assertOk();
    }
}
