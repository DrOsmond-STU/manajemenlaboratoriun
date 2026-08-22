<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\Room;
use App\Models\UserGedung;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ringkasan Register BMN dihitung server atas SELURUH aset dalam cakupan.
 *
 * Daftarnya berhalaman 25 baris. Ringkasan yang dihitung antarmuka dari
 * halaman pertama akan melaporkan nilai perolehan seperempat miliar untuk
 * satuan kerja yang asetnya puluhan miliar — dan angka itu tidak tampak
 * salah, ia hanya kecil.
 */
class RingkasanAsetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->masaManfaat(8)->create();
    }

    public function test_ringkasan_menghitung_seluruh_aset_bukan_satu_halaman(): void
    {
        // Lebih banyak dari satu halaman daftar (25).
        Asset::factory()->kodeBarang('3.08.01.03.001')->count(30)
            ->create(['nilai_perolehan' => 100_000_000, 'masa_manfaat' => 8]);

        $pengguna = $this->penggunaBerperan('asset-manager');

        $halaman = $this->actingAs($pengguna)->getJson('/api/assets')->assertOk()->json('data');
        $this->assertCount(25, $halaman, 'Daftarnya memang berhalaman.');

        $ringkas = $this->actingAs($pengguna)->getJson('/api/assets/ringkasan')
            ->assertOk()->json('data');

        $this->assertSame(30, $ringkas['jumlah']);
        $this->assertSame(3_000_000_000, $ringkas['nilai_perolehan'],
            'Total harus atas 30 aset, bukan 25 yang tampil.');
    }

    public function test_nilai_buku_adalah_perolehan_dikurangi_akumulasi(): void
    {
        Asset::factory()->kodeBarang('3.08.01.03.001')->count(3)
            ->create(['nilai_perolehan' => 80_000_000, 'masa_manfaat' => 8]);

        $r = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/assets/ringkasan')->assertOk()->json('data');

        $this->assertSame(
            $r['nilai_perolehan'] - $r['akumulasi_penyusutan'],
            $r['nilai_buku'],
            'Ketiganya harus konsisten; kalau tidak, neracanya tidak seimbang.'
        );
    }

    public function test_ringkasan_menghormati_cakupan_data(): void
    {
        $gedungA = Room::factory()->create(['gedung' => 'Gedung A']);
        $gedungB = Room::factory()->create(['gedung' => 'Gedung B']);

        Asset::factory()->kodeBarang('3.08.01.03.001')->count(2)
            ->create(['room_id' => $gedungA->id, 'nilai_perolehan' => 10_000_000]);
        Asset::factory()->kodeBarang('3.08.01.03.001')->count(5)
            ->create(['room_id' => $gedungB->id, 'nilai_perolehan' => 10_000_000]);

        $penjaga = $this->penggunaBerperan('lab-technician');
        UserGedung::create(['user_id' => $penjaga->id, 'gedung' => 'Gedung A']);

        $r = $this->actingAs($penjaga)->getJson('/api/assets/ringkasan')->assertOk()->json('data');

        // Angka ringkasan membocorkan keberadaan data sama seperti daftarnya.
        $this->assertSame(2, $r['jumlah']);
        $this->assertSame(20_000_000, $r['nilai_perolehan']);
    }

    public function test_ringkasan_mengikuti_penapisan_yang_sama_dengan_daftar(): void
    {
        BmnKodeBarang::factory()->kode('3.05.02.01.003')->create();

        Asset::factory()->kodeBarang('3.08.01.03.001')->count(2)->create(['nilai_perolehan' => 5_000_000]);
        Asset::factory()->kodeBarang('3.05.02.01.003')->count(3)->create(['nilai_perolehan' => 1_000_000]);

        $r = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/assets/ringkasan?kode_barang=3.08')->assertOk()->json('data');

        // Ringkasan yang tidak ikut menyaring akan berselisih dengan daftar di
        // bawahnya, dan pembacanya tidak punya cara tahu mana yang benar.
        $this->assertSame(2, $r['jumlah']);
        $this->assertSame(10_000_000, $r['nilai_perolehan']);
    }

    public function test_sebaran_kondisi_menyertakan_yang_bernilai_nol(): void
    {
        Asset::factory()->kodeBarang('3.08.01.03.001')->count(2)->create(['kondisi' => 'B']);

        $r = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/assets/ringkasan')->assertOk()->json('data');

        $this->assertCount(3, $r['kondisi']);
        $this->assertSame(['B', 'RR', 'RB'], array_column($r['kondisi'], 'kode'));
        $this->assertSame([2, 0, 0], array_column($r['kondisi'], 'jumlah'));
    }

    public function test_basis_data_kosong_mengembalikan_nol_bukan_null(): void
    {
        $r = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/assets/ringkasan')->assertOk()->json('data');

        $this->assertSame(0, $r['jumlah']);
        $this->assertSame(0, $r['nilai_perolehan']);
        $this->assertSame(0, $r['nilai_buku']);
    }

    public function test_ringkasan_tidak_tertangkap_sebagai_id_aset(): void
    {
        // Rute assets/{asset} akan menangkap "ringkasan" sebagai id bila
        // urutan pendaftarannya terbalik, dan hasilnya 404 yang membingungkan.
        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->getJson('/api/assets/ringkasan')
            ->assertOk()
            ->assertJsonStructure(['data' => ['jumlah', 'nilai_perolehan', 'nilai_buku', 'kondisi']]);
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/assets/ringkasan')->assertUnauthorized();
    }
}
