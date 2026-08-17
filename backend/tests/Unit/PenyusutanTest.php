<?php

namespace Tests\Unit;

use App\Services\Penyusutan;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

/**
 * Penyusutan garis lurus (PMK 65/PMK.06/2017).
 *
 * Uji ini memakai tanggal acuan tetap, bukan `now()`, supaya hasilnya tidak
 * berubah seiring berjalannya waktu — cacat yang membuat uji lulus hari ini
 * dan gagal tahun depan tanpa ada kode yang berubah.
 */
class PenyusutanTest extends TestCase
{
    private const PER = '2026-08-17';

    private function hitung(int $nilai, int $masaManfaat, string $tglPerolehan): Penyusutan
    {
        return Penyusutan::hitung(
            nilaiPerolehan: $nilai,
            masaManfaat: $masaManfaat,
            tglPerolehan: CarbonImmutable::parse($tglPerolehan),
            per: CarbonImmutable::parse(self::PER),
        );
    }

    public function test_susut_per_tahun_adalah_nilai_dibagi_masa_manfaat(): void
    {
        $p = $this->hitung(800_000_000, 8, '2022-07-14');

        $this->assertSame(100_000_000, $p->susutPerTahun);
    }

    public function test_akumulasi_sebanding_dengan_umur(): void
    {
        // 14/07/2022 → 17/08/2026 = 4 tahun penuh.
        $p = $this->hitung(800_000_000, 8, '2022-07-14');

        $this->assertSame(4, $p->umurTahun);
        $this->assertSame(400_000_000, $p->akumulasi);
        $this->assertSame(400_000_000, $p->nilaiBuku);
    }

    public function test_barang_baru_belum_menyusut(): void
    {
        $p = $this->hitung(500_000_000, 5, '2026-08-01');

        $this->assertSame(0, $p->umurTahun);
        $this->assertSame(0, $p->akumulasi);
        $this->assertSame(500_000_000, $p->nilaiBuku);
    }

    public function test_nilai_buku_berhenti_di_nol_setelah_masa_manfaat_habis(): void
    {
        // Umur 16 tahun, masa manfaat 8 — akumulasi tidak boleh melampaui nilai.
        $p = $this->hitung(800_000_000, 8, '2010-01-01');

        $this->assertSame(800_000_000, $p->akumulasi);
        $this->assertSame(0, $p->nilaiBuku);
        $this->assertTrue($p->habisMasaManfaat);
    }

    public function test_sisa_pembagian_dibebankan_di_akhir_masa_manfaat(): void
    {
        // 1.000.000 ÷ 3 = 333.333 per tahun; 3 × 333.333 = 999.999.
        // Satu rupiah tersisa harus ikut terbebani agar nilai buku benar-benar nol.
        $p = $this->hitung(1_000_000, 3, '2020-01-01');

        $this->assertSame(333_333, $p->susutPerTahun);
        $this->assertSame(1_000_000, $p->akumulasi);
        $this->assertSame(0, $p->nilaiBuku);
    }

    public function test_masa_manfaat_nol_tidak_disusutkan(): void
    {
        // Misalnya tanah — tidak boleh melempar DivisionByZeroError.
        $p = $this->hitung(2_000_000_000, 0, '2010-01-01');

        $this->assertSame(0, $p->susutPerTahun);
        $this->assertSame(0, $p->akumulasi);
        $this->assertSame(2_000_000_000, $p->nilaiBuku);
    }

    public function test_tanggal_perolehan_di_masa_depan_belum_menyusut(): void
    {
        $p = $this->hitung(100_000_000, 5, '2030-01-01');

        $this->assertSame(0, $p->umurTahun);
        $this->assertSame(100_000_000, $p->nilaiBuku);
    }

    public function test_nilai_perolehan_nol_aman(): void
    {
        $p = $this->hitung(0, 8, '2020-01-01');

        $this->assertSame(0, $p->nilaiBuku);
        $this->assertSame(0, $p->akumulasi);
    }
}
