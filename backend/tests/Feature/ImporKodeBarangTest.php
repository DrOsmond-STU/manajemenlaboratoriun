<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Support\Satker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\PdfContoh;
use Tests\TestCase;

/**
 * Impor master kode barang.
 *
 * Berkas referensi datang dalam bentuk yang beragam dan sering kotor. Uji di
 * sini menirukan bentuk-bentuk yang benar-benar ditemui — BOM dari Excel,
 * pemisah titik koma, kode tanpa titik, judul kolom berbahasa Indonesia — dan
 * memastikan yang meragukan DILEWATI dengan laporan, bukan ditambal diam-diam.
 */
class ImporKodeBarangTest extends TestCase
{
    use RefreshDatabase;

    private string $berkas;

    protected function setUp(): void
    {
        parent::setUp();
        $this->berkas = tempnam(sys_get_temp_dir(), 'kodebarang').'.csv';
    }

    protected function tearDown(): void
    {
        @unlink($this->berkas);
        parent::tearDown();
    }

    private function tulis(string $isi): string
    {
        file_put_contents($this->berkas, $isi);

        return $this->berkas;
    }

    public function test_impor_csv_biasa(): void
    {
        $this->tulis(<<<'CSV'
        kode,uraian,masa_manfaat
        3.08.01.03.001,Chromatography Set,8
        3.08.01.08.003,Autoclave,8
        CSV);

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])
            ->assertSuccessful();

        $this->assertDatabaseCount('bmn_kode_barang', 2);
        $this->assertSame('Chromatography Set', BmnKodeBarang::where('kode', '3.08.01.03.001')->value('uraian'));
    }

    public function test_judul_kolom_berbahasa_indonesia_dikenali(): void
    {
        $this->tulis(<<<'CSV'
        Kode Barang;Uraian Barang;Masa Manfaat
        3.08.01.03.001;Chromatography Set;8
        CSV);

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])
            ->assertSuccessful();

        $this->assertDatabaseHas('bmn_kode_barang', ['kode' => '3.08.01.03.001']);
    }

    public function test_pemisah_titik_koma_terdeteksi_sendiri(): void
    {
        // Ekspor Excel berbahasa Indonesia lazim memakai titik koma.
        $this->tulis("kode;uraian;masa_manfaat\n3.08.01.03.001;Alat Uji;5");

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])
            ->expectsOutputToContain('Pemisah kolom')
            ->assertSuccessful();

        $this->assertDatabaseCount('bmn_kode_barang', 1);
    }

    public function test_bom_dari_excel_tidak_merusak_judul_kolom(): void
    {
        $this->tulis("\u{FEFF}kode,uraian,masa_manfaat\n3.08.01.03.001,Alat Uji,5");

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])
            ->assertSuccessful();

        $this->assertDatabaseCount('bmn_kode_barang', 1);
    }

    public function test_kode_tanpa_titik_dirapikan(): void
    {
        // Sumber resmi kadang menuliskan 10 digit tanpa pemisah.
        $this->tulis("kode,uraian\n3080103001,Chromatography Set");

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])
            ->assertSuccessful();

        $this->assertDatabaseHas('bmn_kode_barang', ['kode' => '3.08.01.03.001']);
    }

    public function test_kode_kurang_digit_dilewati_bukan_ditambal(): void
    {
        // Menebak digit yang hilang sama saja mengarang kode barang.
        $this->tulis("kode,uraian\n30801,Alat Setengah Jadi\n3.08.01.03.001,Alat Sah");

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])
            ->expectsOutputToContain('Baris yang dilewati')
            ->assertSuccessful();

        $this->assertDatabaseCount('bmn_kode_barang', 1);
        $this->assertDatabaseHas('bmn_kode_barang', ['kode' => '3.08.01.03.001']);
    }

    public function test_uraian_kosong_dilewati(): void
    {
        $this->tulis("kode,uraian\n3.08.01.03.001,\n3.08.01.08.003,Autoclave");

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])
            ->assertSuccessful();

        $this->assertDatabaseCount('bmn_kode_barang', 1);
        $this->assertDatabaseHas('bmn_kode_barang', ['kode' => '3.08.01.08.003']);
    }

    public function test_jenjang_terisi_dari_kodenya_sendiri(): void
    {
        $this->tulis("kode,uraian\n3.08.01.03.001,Chromatography Set");

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])->assertSuccessful();

        $kb = BmnKodeBarang::where('kode', '3.08.01.03.001')->firstOrFail();

        $this->assertSame('3', $kb->golongan);
        $this->assertSame('3.08', $kb->bidang);
        $this->assertSame('3.08.01', $kb->kelompok);
        $this->assertSame('3.08.01.03', $kb->sub_kelompok);
        $this->assertSame('B', $kb->kib, 'Golongan 3 harus otomatis ber-KIB B.');
    }

    public function test_uji_coba_tidak_menulis_apa_pun(): void
    {
        $this->tulis("kode,uraian\n3.08.01.03.001,Chromatography Set");

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas, '--uji-coba' => true])
            ->expectsOutputToContain('Uji coba')
            ->assertSuccessful();

        $this->assertDatabaseCount('bmn_kode_barang', 0);
    }

    public function test_impor_ulang_memperbarui_bukan_menggandakan(): void
    {
        $this->tulis("kode,uraian,masa_manfaat\n3.08.01.03.001,Nama Lama,8");
        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])->assertSuccessful();

        $this->tulis("kode,uraian,masa_manfaat\n3.08.01.03.001,Nama Baru,10");
        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])->assertSuccessful();

        $this->assertDatabaseCount('bmn_kode_barang', 1);
        $this->assertDatabaseHas('bmn_kode_barang', ['kode' => '3.08.01.03.001', 'uraian' => 'Nama Baru', 'masa_manfaat' => 10]);
    }

    public function test_kolom_dapat_ditentukan_lewat_nomor(): void
    {
        // Berkas tanpa judul kolom yang dapat dikenali.
        $this->tulis("A;B;C\nabaikan;3.08.01.03.001;Chromatography Set");

        $this->artisan('bmn:impor-kode-barang', [
            'berkas' => $this->berkas,
            '--kolom-kode' => 2,
            '--kolom-uraian' => 3,
        ])->assertSuccessful();

        $this->assertDatabaseHas('bmn_kode_barang', ['kode' => '3.08.01.03.001']);
    }

    public function test_kolom_tak_dikenali_memberi_petunjuk_bukan_diam(): void
    {
        $this->tulis("aa,bb\n3.08.01.03.001,Alat");

        $this->artisan('bmn:impor-kode-barang', ['berkas' => $this->berkas])
            ->expectsOutputToContain('Kolom kode dan/atau uraian tidak dikenali')
            ->expectsOutputToContain('--kolom-kode')
            ->assertFailed();
    }

    public function test_berkas_tidak_ada_ditolak_dengan_jelas(): void
    {
        $this->artisan('bmn:impor-kode-barang', ['berkas' => '/tidak/ada/berkas.csv'])
            ->expectsOutputToContain('tidak dapat dibaca')
            ->assertFailed();
    }

    public function test_impor_dari_pdf_lampiran(): void
    {
        $pdf = PdfContoh::buat([
            'MENTERI KEUANGAN',
            'KODE BARANG    URAIAN',
            '3.08.01.03.001    Chromatography Set',
            '3.08.01.08.003    Autoclave',
            '- 157 -',
        ]);

        try {
            $this->artisan('bmn:impor-kode-barang', ['berkas' => $pdf])
                ->expectsOutputToContain('dikenali sebagai')
                ->assertSuccessful();

            $this->assertDatabaseCount('bmn_kode_barang', 2);
            $this->assertDatabaseHas('bmn_kode_barang', [
                'kode' => '3.08.01.08.003',
                'uraian' => 'Autoclave',
            ]);
        } finally {
            @unlink($pdf);
        }
    }

    public function test_pdf_dikenali_dari_isinya_bukan_akhiran_nama(): void
    {
        $pdf = PdfContoh::buat(['3.08.01.03.001    Chromatography Set']);
        $tanpaAkhiran = $pdf.'.berkas';
        rename($pdf, $tanpaAkhiran);

        try {
            $this->artisan('bmn:impor-kode-barang', ['berkas' => $tanpaAkhiran])
                ->expectsOutputToContain('dikenali sebagai')
                ->assertSuccessful();

            $this->assertDatabaseCount('bmn_kode_barang', 1);
        } finally {
            @unlink($tanpaAkhiran);
        }
    }

    public function test_pdf_tanpa_kode_barang_ditolak_dengan_penjelasan(): void
    {
        $pdf = PdfContoh::buat([
            'Menimbang bahwa dalam rangka tertib administrasi',
            'Pasal 1',
        ]);

        try {
            $this->artisan('bmn:impor-kode-barang', ['berkas' => $pdf])
                ->expectsOutputToContain('Tidak ada kode barang yang dikenali')
                ->assertFailed();

            $this->assertDatabaseCount('bmn_kode_barang', 0);
        } finally {
            @unlink($pdf);
        }
    }

    public function test_pdf_uji_coba_tidak_menulis(): void
    {
        $pdf = PdfContoh::buat(['3.08.01.03.001    Chromatography Set']);

        try {
            $this->artisan('bmn:impor-kode-barang', ['berkas' => $pdf, '--uji-coba' => true])
                ->expectsOutputToContain('Uji coba')
                ->assertSuccessful();

            $this->assertDatabaseCount('bmn_kode_barang', 0);
        } finally {
            @unlink($pdf);
        }
    }

    public function test_selaraskan_nup_menyusul_data_impor(): void
    {
        $kode = '3.08.01.03.001';
        BmnKodeBarang::factory()->kode($kode)->create();
        Asset::factory()->kodeBarang($kode)->nup(41)->create();

        $this->artisan('bmn:selaraskan-nup')
            ->expectsOutputToContain('diselaraskan')
            ->assertSuccessful();

        $this->assertSame(41, (int) DB::table('bmn_nup_counters')
            ->where('kode_lokasi', Satker::kodeLokasi())
            ->where('kode_barang', $kode)
            ->value('nup_terakhir'));
    }

    public function test_selaraskan_nup_uji_coba_tidak_menulis(): void
    {
        $kode = '3.08.01.03.001';
        BmnKodeBarang::factory()->kode($kode)->create();
        Asset::factory()->kodeBarang($kode)->nup(41)->create();

        $this->artisan('bmn:selaraskan-nup', ['--uji-coba' => true])
            ->expectsOutputToContain('Uji coba')
            ->assertSuccessful();

        $this->assertDatabaseCount('bmn_nup_counters', 0);
    }

    public function test_selaraskan_nup_aman_dijalankan_dua_kali(): void
    {
        $kode = '3.08.01.03.001';
        BmnKodeBarang::factory()->kode($kode)->create();
        Asset::factory()->kodeBarang($kode)->nup(41)->create();

        $this->artisan('bmn:selaraskan-nup')->assertSuccessful();

        $this->artisan('bmn:selaraskan-nup')
            ->expectsOutputToContain('sudah selaras')
            ->assertSuccessful();
    }
}
