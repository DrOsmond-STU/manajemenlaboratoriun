<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetPhoto;
use App\Models\BmnKodeBarang;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FotoAsetTest extends TestCase
{
    use RefreshDatabase;

    private Asset $aset;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $this->aset = Asset::factory()->kodeBarang('3.08.01.03.001')->create(['nama' => 'HPLC Shimadzu']);
    }

    private function gambar(string $nama = 'alat.jpg', int $lebar = 400, int $tinggi = 300): UploadedFile
    {
        return UploadedFile::fake()->image($nama, $lebar, $tinggi);
    }

    // --- Unggah --------------------------------------------------------------

    public function test_foto_dapat_diunggah_dan_terbaca_kembali(): void
    {
        $data = $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->post("/api/assets/{$this->aset->id}/foto", ['foto' => $this->gambar()])
            ->assertCreated()
            ->json('data');

        $this->assertTrue($data['utama'], 'Foto pertama otomatis menjadi foto utama.');
        $this->assertSame('image/jpeg', $data['mime']);
        $this->assertGreaterThan(0, $data['ukuran']);

        $foto = AssetPhoto::sole();
        Storage::disk('local')->assertExists($foto->jalur);
    }

    public function test_nama_berkas_kiriman_tidak_pernah_dipakai(): void
    {
        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->post("/api/assets/{$this->aset->id}/foto", [
                'foto' => $this->gambar('../../../../etc/passwd.jpg'),
            ])
            ->assertCreated();

        $jalur = AssetPhoto::sole()->jalur;

        // Nama kiriman dapat memuat "../" untuk keluar dari direktori, dapat
        // memuat titik ganda yang membuat server salah menebak jenisnya, dan
        // dapat sengaja dibuat sama dengan berkas milik orang lain.
        $this->assertStringNotContainsString('..', $jalur);
        $this->assertStringNotContainsString('passwd', $jalur);
        $this->assertStringStartsWith('aset/'.$this->aset->id.'/', $jalur);
    }

    public function test_berkas_bukan_gambar_ditolak(): void
    {
        // Berkas PHP bernama .jpg dengan Content-Type image/jpeg akan lolos
        // pemeriksaan yang percaya ekstensi maupun header kiriman.
        $palsu = UploadedFile::fake()->createWithContent(
            'alat.jpg', "<?php system(\$_GET['c']); ?>"
        );

        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->post("/api/assets/{$this->aset->id}/foto", ['foto' => $palsu])
            ->assertStatus(422)
            ->assertJsonValidationErrors('foto');

        $this->assertSame(0, AssetPhoto::count());
    }

    public function test_jumlah_foto_per_aset_dibatasi(): void
    {
        $pengguna = $this->penggunaBerperan('asset-manager');

        for ($i = 0; $i < 8; $i++) {
            $this->actingAs($pengguna)
                ->post("/api/assets/{$this->aset->id}/foto", ['foto' => $this->gambar("f{$i}.jpg")])
                ->assertCreated();
        }

        $this->actingAs($pengguna)
            ->post("/api/assets/{$this->aset->id}/foto", ['foto' => $this->gambar('lebih.jpg')])
            ->assertStatus(422)
            ->assertJsonValidationErrors('foto');

        $this->assertSame(8, AssetPhoto::count());
    }

    // --- Foto utama ----------------------------------------------------------

    public function test_hanya_satu_foto_utama_per_aset(): void
    {
        $pengguna = $this->penggunaBerperan('asset-manager');

        $a = $this->actingAs($pengguna)->post("/api/assets/{$this->aset->id}/foto",
            ['foto' => $this->gambar('a.jpg')])->json('data.id');
        $b = $this->actingAs($pengguna)->post("/api/assets/{$this->aset->id}/foto",
            ['foto' => $this->gambar('b.jpg')])->json('data.id');

        $this->actingAs($pengguna)
            ->postJson("/api/assets/{$this->aset->id}/foto/{$b}/utama")
            ->assertOk();

        $this->assertFalse(AssetPhoto::find($a)->utama);
        $this->assertTrue(AssetPhoto::find($b)->utama);
        $this->assertSame(1, AssetPhoto::where('utama', true)->count());
    }

    public function test_basis_data_menolak_dua_foto_utama(): void
    {
        AssetPhoto::create([
            'asset_id' => $this->aset->id, 'jalur' => 'aset/x/1.jpg',
            'mime' => 'image/jpeg', 'ukuran' => 100, 'utama' => true,
        ]);

        $this->expectException(QueryException::class);

        AssetPhoto::create([
            'asset_id' => $this->aset->id, 'jalur' => 'aset/x/2.jpg',
            'mime' => 'image/jpeg', 'ukuran' => 100, 'utama' => true,
        ]);
    }

    public function test_menghapus_foto_utama_menetapkan_penggantinya(): void
    {
        $pengguna = $this->penggunaBerperan('asset-manager');

        $a = $this->actingAs($pengguna)->post("/api/assets/{$this->aset->id}/foto",
            ['foto' => $this->gambar('a.jpg')])->json('data.id');
        $b = $this->actingAs($pengguna)->post("/api/assets/{$this->aset->id}/foto",
            ['foto' => $this->gambar('b.jpg')])->json('data.id');

        $this->actingAs($pengguna)
            ->deleteJson("/api/assets/{$this->aset->id}/foto/{$a}")
            ->assertOk();

        // Aset yang punya foto tetapi tanpa foto utama akan tampil tanpa
        // gambar, tanpa sebab yang terlihat siapa pun.
        $this->assertTrue(AssetPhoto::find($b)->utama);
    }

    public function test_berkas_ikut_terhapus(): void
    {
        $pengguna = $this->penggunaBerperan('asset-manager');

        $id = $this->actingAs($pengguna)->post("/api/assets/{$this->aset->id}/foto",
            ['foto' => $this->gambar()])->json('data.id');

        $jalur = AssetPhoto::find($id)->jalur;
        Storage::disk('local')->assertExists($jalur);

        $this->actingAs($pengguna)->deleteJson("/api/assets/{$this->aset->id}/foto/{$id}")->assertOk();

        Storage::disk('local')->assertMissing($jalur);
    }

    // --- Akses ---------------------------------------------------------------

    public function test_foto_tidak_dapat_diambil_lewat_aset_lain(): void
    {
        $pengguna = $this->penggunaBerperan('asset-manager');
        $lain = Asset::factory()->kodeBarang('3.08.01.03.001')->create();

        $id = $this->actingAs($pengguna)->post("/api/assets/{$this->aset->id}/foto",
            ['foto' => $this->gambar()])->json('data.id');

        // Tanpa pemeriksaan ini, siapa pun yang boleh melihat satu aset dapat
        // mengambil foto aset mana pun hanya dengan mengganti angka pada URL.
        $this->actingAs($pengguna)
            ->get("/api/assets/{$lain->id}/foto/{$id}")
            ->assertNotFound();
    }

    public function test_tamu_tidak_dapat_melihat_foto(): void
    {
        // Fotonya dibuat LANGSUNG, tanpa actingAs sama sekali. Versi pertama
        // uji ini mengunggah lewat actingAs lalu memanggil tanpa actingAs —
        // dan lulus-palsu, karena actingAs bertahan sepanjang satu uji
        // sehingga permintaan "tamu"-nya sebenarnya masih terautentikasi.
        Storage::disk('local')->put('aset/'.$this->aset->id.'/uji.jpg', 'isi-gambar');

        $foto = AssetPhoto::create([
            'asset_id' => $this->aset->id,
            'jalur' => 'aset/'.$this->aset->id.'/uji.jpg',
            'mime' => 'image/jpeg', 'ukuran' => 11, 'utama' => true,
        ]);

        $this->getJson("/api/assets/{$this->aset->id}/foto/{$foto->id}")->assertUnauthorized();

        // Dan tanpa header Accept: application/json pun tetap ditolak — rute
        // gambar justru paling mungkin dipanggil langsung dari atribut src.
        $this->call('GET', "/api/assets/{$this->aset->id}/foto/{$foto->id}")
            ->assertUnauthorized();
    }

    public function test_peran_tanpa_izin_ubah_tidak_dapat_mengunggah(): void
    {
        $this->actingAs($this->penggunaBerperan('lab-technician'))
            ->post("/api/assets/{$this->aset->id}/foto", ['foto' => $this->gambar()])
            ->assertForbidden();
    }

    public function test_foto_dilayani_dengan_tajuk_yang_aman(): void
    {
        $pengguna = $this->penggunaBerperan('asset-manager');

        $id = $this->actingAs($pengguna)->post("/api/assets/{$this->aset->id}/foto",
            ['foto' => $this->gambar()])->json('data.id');

        $jawaban = $this->actingAs($pengguna)
            ->get("/api/assets/{$this->aset->id}/foto/{$id}")
            ->assertOk();

        $this->assertSame('image/jpeg', $jawaban->headers->get('Content-Type'));
        // nosniff mencegah peramban menebak-nebak jenisnya lalu menjalankan
        // isinya sebagai sesuatu yang lain.
        $this->assertSame('nosniff', $jawaban->headers->get('X-Content-Type-Options'));
        $this->assertStringContainsString('inline', $jawaban->headers->get('Content-Disposition'));
    }

    public function test_menghapus_aset_ikut_menghapus_baris_fotonya(): void
    {
        $this->actingAs($this->penggunaBerperan('asset-manager'))
            ->post("/api/assets/{$this->aset->id}/foto", ['foto' => $this->gambar()])
            ->assertCreated();

        // forceDelete: hapus lunak sengaja TIDAK menghapus fotonya, karena
        // asetnya sendiri masih dapat dipulihkan.
        $this->aset->forceDelete();

        $this->assertSame(0, DB::table('asset_photos')->count());
    }
}
