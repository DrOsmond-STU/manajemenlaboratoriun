<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\Room;
use App\Support\Satker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssetApiTest extends TestCase
{
    use RefreshDatabase;

    private function kodeBarang(string $kode = '3.08.01.03.001', int $masaManfaat = 8): BmnKodeBarang
    {
        return BmnKodeBarang::factory()->kode($kode)->masaManfaat($masaManfaat)->create();
    }

    /**
     * @return array<string,mixed>
     */
    private function isian(array $ganti = []): array
    {
        return array_merge([
            'kode_barang' => '3.08.01.03.001',
            'nama' => 'HPLC Shimadzu LC-2050',
            'merk' => 'Shimadzu',
            'tipe' => 'LC-2050C 3D',
            'serial_number' => 'SHZ-LC-88421',
            'tgl_perolehan' => '2022-07-14',
            'nilai_perolehan' => 850_000_000,
            'kondisi' => 'B',
        ], $ganti);
    }

    public function test_tamu_tidak_boleh_mendaftarkan_aset(): void
    {
        $this->kodeBarang();

        $this->postJson('/api/assets', $this->isian())->assertUnauthorized();
    }

    public function test_pengguna_terautentikasi_dapat_mendaftarkan_aset(): void
    {
        $this->kodeBarang();

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian())
            ->assertCreated()
            ->assertJsonPath('data.nama', 'HPLC Shimadzu LC-2050')
            ->assertJsonPath('data.bmn.kode_barang', '3.08.01.03.001')
            // Kondisi harus terbaca sebagai namanya, bukan kodenya. Sempat
            // gagal karena kolomnya CHAR sehingga 'B' terbaca 'B '.
            ->assertJsonPath('data.kondisi.kode', 'B')
            ->assertJsonPath('data.kondisi.nama', 'Baik');

        $this->assertDatabaseCount('assets', 1);
    }

    public function test_identitas_bmn_dirangkai_dari_lokasi_kode_barang_dan_nup(): void
    {
        $this->kodeBarang();

        $data = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian())
            ->assertCreated()
            ->json('data');

        $this->assertSame(Satker::kodeLokasi().'.3.08.01.03.001.00001', $data['bmn']['id']);
        $this->assertSame('00001', $data['bmn']['nup_fmt']);
    }

    public function test_nup_berjalan_per_kode_barang_bukan_global(): void
    {
        $this->kodeBarang('3.08.01.03.001');
        $this->kodeBarang('3.08.01.08.003');

        $user = $this->penggunaBerperan('asset-manager');

        $a1 = $this->actingAs($user)->postJson('/api/assets', $this->isian())->json('data.bmn.nup');
        $a2 = $this->actingAs($user)->postJson('/api/assets', $this->isian())->json('data.bmn.nup');

        // Kode barang berbeda memulai deret NUP-nya sendiri dari 1.
        $b1 = $this->actingAs($user)
            ->postJson('/api/assets', $this->isian(['kode_barang' => '3.08.01.08.003', 'nama' => 'Autoklaf']))
            ->json('data.bmn.nup');

        $this->assertSame(1, $a1);
        $this->assertSame(2, $a2);
        $this->assertSame(1, $b1, 'NUP harus berjalan per sub-sub kelompok, bukan menerus lintas kode barang.');
    }

    public function test_kode_internal_dibentuk_otomatis_bila_dikosongkan(): void
    {
        $this->kodeBarang();
        $room = Room::factory()->create(['kode' => 'KIM-01']);

        $kode = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian(['room_id' => $room->id]))
            ->assertCreated()
            ->json('data.kode_internal');

        $this->assertNotEmpty($kode);
        $this->assertStringContainsString('KIM-01', $kode);
        $this->assertStringContainsString('2022', $kode, 'Tahun perolehan harus masuk ke kode internal.');
    }

    public function test_kode_internal_pilihan_pengguna_dipakai_apa_adanya(): void
    {
        $this->kodeBarang();

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian(['kode_internal' => 'STU/KIM-01/KROM/2022/0012']))
            ->assertCreated()
            ->assertJsonPath('data.kode_internal', 'STU/KIM-01/KROM/2022/0012');
    }

    public function test_kode_internal_kembar_ditolak(): void
    {
        $this->kodeBarang();
        Asset::factory()->kodeBarang('3.08.01.03.001')->create(['kode_internal' => 'STU/DUP/0001']);

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian(['kode_internal' => 'STU/DUP/0001']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('kode_internal');
    }

    public function test_kode_barang_harus_ada_di_master(): void
    {
        $this->kodeBarang('3.08.01.03.001');

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian(['kode_barang' => '3.08.99.99.999']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('kode_barang');
    }

    public function test_kode_barang_berpola_salah_ditolak(): void
    {
        $this->kodeBarang();

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian(['kode_barang' => '30801031']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('kode_barang');
    }

    public function test_tanggal_perolehan_masa_depan_ditolak(): void
    {
        $this->kodeBarang();

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian(['tgl_perolehan' => now()->addYear()->toDateString()]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('tgl_perolehan');
    }

    public function test_nup_tidak_dapat_dikarang_dari_permintaan(): void
    {
        $this->kodeBarang();

        $data = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian(['nup' => 9999, 'kode_lokasi' => '999.99.9999.999999.999']))
            ->assertCreated()
            ->json('data');

        $this->assertSame(1, $data['bmn']['nup'], 'NUP dari permintaan harus diabaikan.');
        $this->assertSame(Satker::kodeLokasi(), $data['bmn']['kode_lokasi']);
    }

    public function test_masa_manfaat_mengikuti_master_bila_tidak_diisi(): void
    {
        $this->kodeBarang('3.08.01.03.001', masaManfaat: 8);

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian())
            ->assertCreated()
            ->assertJsonPath('data.penyusutan.masa_manfaat', 8);
    }

    public function test_daftar_aset_dapat_dicari_dan_ditapis(): void
    {
        $this->kodeBarang('3.08.01.03.001');
        $this->kodeBarang('3.05.02.01.003');

        Asset::factory()->kodeBarang('3.08.01.03.001')->create(['nama' => 'HPLC Shimadzu', 'nup' => 1]);
        Asset::factory()->kodeBarang('3.05.02.01.003')->rusakBerat()->create(['nama' => 'AC Daikin', 'nup' => 1]);

        $user = $this->penggunaBerperan('asset-manager');

        $this->actingAs($user)->getJson('/api/assets?cari=HPLC')
            ->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($user)->getJson('/api/assets?kondisi=RB')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'AC Daikin');

        // Tapis berjenjang: '3.08' harus menjaring seluruh alat laboratorium.
        $this->actingAs($user)->getJson('/api/assets?kode_barang=3.08')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'HPLC Shimadzu');
    }

    public function test_kapasitas_ukur_dan_kelengkapan_tersimpan(): void
    {
        $this->kodeBarang();

        $data = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian([
                // Rentang bersatuan, bukan bilangan. Memaksanya menjadi angka
                // membuang satuan dan batas bawahnya — justru bagian yang
                // menentukan apakah alat itu cocok untuk sebuah pengujian.
                'kapasitas_ukur' => '0,1–500 mg/L',
                'kelengkapan' => ['Kolom C18', 'Detektor UV-Vis', 'Software LabSolutions', 'Manual'],
            ]))
            ->assertCreated()
            ->json('data');

        $this->assertSame('0,1–500 mg/L', $data['kapasitas_ukur']);
        $this->assertCount(4, $data['kelengkapan']);
        $this->assertContains('Kolom C18', $data['kelengkapan']);
    }

    public function test_aset_tanpa_foto_melaporkan_nol_bukan_null(): void
    {
        $this->kodeBarang();

        $data = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian())
            ->assertCreated()
            ->json('data');

        // Antarmuka memakai angka ini untuk memutuskan menampilkan galeri
        // atau ajakan mengunggah; null memaksanya menebak.
        $this->assertSame(0, $data['foto']['jumlah']);
        $this->assertNull($data['foto']['utama']);
        $this->assertSame([], $data['kelengkapan']);
    }

    public function test_master_kode_barang_dapat_ditelusuri(): void
    {
        $this->kodeBarang('3.08.01.03.001');
        $this->kodeBarang('3.05.02.01.003');

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/bmn/kode-barang?awalan=3.08')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_pemasok_dan_garansi_tersimpan(): void
    {
        $this->kodeBarang();

        $data = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian([
                'pemasok' => 'PT Sumber Alat Laboratorium',
                'garansi_berakhir' => '2027-07-14',
            ]))
            ->assertCreated()
            ->json('data');

        $this->assertSame('PT Sumber Alat Laboratorium', $data['pemasok']);
        $this->assertSame('2027-07-14', $data['garansi_berakhir']);
    }

    public function test_pemasok_dan_garansi_boleh_dikosongkan(): void
    {
        $this->kodeBarang();

        $data = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->postJson('/api/assets', $this->isian())
            ->assertCreated()
            ->json('data');

        $this->assertNull($data['pemasok']);
        $this->assertNull($data['garansi_berakhir']);
    }

    public function test_daftar_aset_dapat_ditapis_status_penggunaan(): void
    {
        $this->kodeBarang();

        Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'Sudah Dihapuskan', 'status_penggunaan' => 'Dihapuskan',
        ]);
        Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'Masih Dipakai', 'status_penggunaan' => 'Digunakan untuk Operasional Satker',
        ]);

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/assets?status_penggunaan=Dihapuskan')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'Sudah Dihapuskan');
    }

    public function test_ringkasan_menghitung_garansi_akan_berakhir(): void
    {
        $this->kodeBarang();

        // Akan berakhir dalam 30 hari — dihitung.
        Asset::factory()->kodeBarang('3.08.01.03.001')->garansiAkanBerakhir(30)->create();
        // Sudah lewat — TIDAK dihitung sebagai "akan berakhir".
        Asset::factory()->kodeBarang('3.08.01.03.001')->create(['garansi_berakhir' => now()->subDays(5)->toDateString()]);
        // 200 hari lagi — di luar jendela 90 hari, tidak dihitung.
        Asset::factory()->kodeBarang('3.08.01.03.001')->garansiAkanBerakhir(200)->create();
        // Tanpa garansi sama sekali.
        Asset::factory()->kodeBarang('3.08.01.03.001')->create(['garansi_berakhir' => null]);

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/assets/ringkasan')
            ->assertOk()
            ->assertJsonPath('data.garansi_akan_berakhir', 1);
    }

    public function test_ringkasan_menghitung_disposal(): void
    {
        $this->kodeBarang();

        Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'status_penggunaan' => 'Dihapuskan', 'nilai_perolehan' => 10_000_000, 'masa_manfaat' => 0,
        ]);
        Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'status_penggunaan' => 'Digunakan untuk Operasional Satker',
        ]);

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/assets/ringkasan')
            ->assertOk()
            ->assertJsonPath('data.disposal.jumlah', 1);
    }

    public function test_daftar_aset_per_halaman_dapat_diperbesar_dan_dibatasi(): void
    {
        $this->kodeBarang();
        Asset::factory()->kodeBarang('3.08.01.03.001')->count(30)->create();

        $user = $this->penggunaBerperan('asset-manager');

        // Bawaan tetap 25 tanpa parameter — dipakai layar lain yang tidak
        // ingin membebani permintaannya.
        $this->actingAs($user)->getJson('/api/assets')
            ->assertOk()->assertJsonCount(25, 'data');

        $this->actingAs($user)->getJson('/api/assets?per_halaman=30')
            ->assertOk()->assertJsonCount(30, 'data');

        // Diminta 500, dibatasi 200 — bukan ditolak, bukan diam-diam
        // dituruti mentah-mentah.
        $this->actingAs($user)->getJson('/api/assets?per_halaman=500')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 200);
    }

    public function test_ringkasan_menyusun_komposisi_per_kode_barang(): void
    {
        $this->kodeBarang('3.08.01.03.001');
        $this->kodeBarang('3.05.02.01.003');

        Asset::factory()->kodeBarang('3.08.01.03.001')->count(3)->create();
        Asset::factory()->kodeBarang('3.05.02.01.003')->count(1)->create();

        $komposisi = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/assets/ringkasan')
            ->assertOk()
            ->json('data.per_kode_barang');

        // Diurutkan terbanyak dahulu.
        $this->assertSame('3.08.01.03.001', $komposisi[0]['kode_barang']);
        $this->assertSame(3, $komposisi[0]['jumlah']);
        $this->assertSame(1, $komposisi[1]['jumlah']);
    }
}
