<?php

namespace Tests\Unit;

use App\Services\EkstraksiKodeBarangPdf;
use PHPUnit\Framework\TestCase;
use Smalot\PdfParser\Parser;
use Tests\Support\PdfContoh;

/**
 * Penguraian teks lampiran kodefikasi BMN.
 *
 * Teks contoh di sini menirukan keadaan sesungguhnya setelah PDF diubah jadi
 * teks: judul kolom terulang di tiap halaman, nomor halaman menyempil, titik-
 * titik penuntun, kode ditulis dengan pemisah yang berbeda-beda, dan kalimat
 * batang tubuh peraturan ikut terbawa.
 */
class EkstraksiKodeBarangPdfTest extends TestCase
{
    private function ekstraktor(): EkstraksiKodeBarangPdf
    {
        return new EkstraksiKodeBarangPdf(new Parser);
    }

    public function test_kode_dan_uraian_terambil_dari_baris_tabel(): void
    {
        $hasil = $this->ekstraktor()->dariTeks(<<<'TXT'
        3.08.01.03.001    Chromatography Set
        3.08.01.08.003    Autoclave
        TXT);

        $this->assertCount(2, $hasil['kode']);
        $this->assertSame('Chromatography Set', $hasil['kode']['3.08.01.03.001']['uraian']);
        $this->assertSame('Autoclave', $hasil['kode']['3.08.01.08.003']['uraian']);
    }

    public function test_judul_kolom_dan_kop_diabaikan(): void
    {
        $hasil = $this->ekstraktor()->dariTeks(<<<'TXT'
        MENTERI KEUANGAN
        REPUBLIK INDONESIA
        KODE BARANG    URAIAN
        3.08.01.03.001    Chromatography Set
        - 157 -
        TXT);

        $this->assertCount(1, $hasil['kode']);
        $this->assertArrayHasKey('3.08.01.03.001', $hasil['kode']);
    }

    public function test_kode_dengan_pemisah_beragam_dikenali_sama(): void
    {
        $hasil = $this->ekstraktor()->dariTeks(<<<'TXT'
        3 08 01 03 001    Alat Dengan Spasi
        3.08.01.08.003    Alat Dengan Titik
        3080109005        Alat Tanpa Pemisah
        TXT);

        $this->assertCount(3, $hasil['kode']);
        $this->assertSame('Alat Dengan Spasi', $hasil['kode']['3.08.01.03.001']['uraian']);
        $this->assertSame('Alat Tanpa Pemisah', $hasil['kode']['3.08.01.09.005']['uraian']);
    }

    public function test_titik_penuntun_dibersihkan_dari_uraian(): void
    {
        $hasil = $this->ekstraktor()->dariTeks('3.08.01.03.001 Chromatography Set..........  8');

        $this->assertSame('Chromatography Set 8', $hasil['kode']['3.08.01.03.001']['uraian']);
    }

    public function test_baris_tanpa_kode_diabaikan(): void
    {
        $hasil = $this->ekstraktor()->dariTeks(<<<'TXT'
        Menimbang bahwa dalam rangka tertib administrasi pengelolaan Barang Milik
        Negara perlu menetapkan penggolongan dan kodefikasi.
        Pasal 1
        3.08.01.03.001    Chromatography Set
        TXT);

        $this->assertCount(1, $hasil['kode']);
    }

    public function test_kode_kurang_digit_tidak_ditambal(): void
    {
        $hasil = $this->ekstraktor()->dariTeks(<<<'TXT'
        3.08.01    Kelompok Alat Laboratorium
        3.08.01.03.001    Chromatography Set
        TXT);

        $this->assertCount(1, $hasil['kode'], 'Kode tingkat kelompok bukan kode barang.');
        $this->assertArrayHasKey('3.08.01.03.001', $hasil['kode']);
    }

    public function test_kode_berulang_tidak_menimpa_entri_pertama(): void
    {
        $hasil = $this->ekstraktor()->dariTeks(<<<'TXT'
        3.08.01.03.001    Chromatography Set
        3.08.01.03.001    (lanjutan halaman berikutnya)
        TXT);

        $this->assertCount(1, $hasil['kode']);
        $this->assertSame('Chromatography Set', $hasil['kode']['3.08.01.03.001']['uraian']);
    }

    public function test_uraian_kosong_atau_satu_huruf_dilewati(): void
    {
        $hasil = $this->ekstraktor()->dariTeks(<<<'TXT'
        3.08.01.03.001    B
        3.08.01.08.003    Autoclave
        TXT);

        $this->assertCount(1, $hasil['kode']);
        $this->assertArrayHasKey('3.08.01.08.003', $hasil['kode']);
    }

    public function test_masa_manfaat_diisi_nol_karena_tidak_ada_di_lampiran(): void
    {
        $hasil = $this->ekstraktor()->dariTeks('3.08.01.03.001 Chromatography Set');

        // Lampiran kodefikasi memuat kode dan uraian, bukan masa manfaat.
        // Mengarang angkanya akan merusak seluruh perhitungan penyusutan.
        $this->assertSame(0, $hasil['kode']['3.08.01.03.001']['masa_manfaat']);
    }

    public function test_membaca_pdf_sungguhan(): void
    {
        $berkas = PdfContoh::buat([
            '3.08.01.03.001    Chromatography Set',
            '3.08.01.08.003    Autoclave',
            'KODE BARANG    URAIAN',
            '3.08.01.14.002    Analytical Balance',
        ]);

        try {
            $hasil = $this->ekstraktor()->dariBerkas($berkas);

            $this->assertSame(1, $hasil['halaman']);
            $this->assertCount(3, $hasil['kode']);
            $this->assertSame('Autoclave', $hasil['kode']['3.08.01.08.003']['uraian']);
        } finally {
            @unlink($berkas);
        }
    }
}
