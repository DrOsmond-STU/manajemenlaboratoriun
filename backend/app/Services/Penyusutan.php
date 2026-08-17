<?php

namespace App\Services;

use Carbon\CarbonInterface;

/**
 * Penyusutan aset tetap — metode garis lurus, tanpa nilai residu
 * (PMK 65/PMK.06/2017).
 *
 *     penyusutan per tahun = nilai perolehan ÷ masa manfaat
 *
 * Nilai buku tidak pernah menembus nol: setelah masa manfaat habis, akumulasi
 * berhenti di nilai perolehan.
 *
 * CATATAN YANG PERLU DIPASTIKAN KE SATUAN KERJA
 * ---------------------------------------------
 * PMK 65/2017 melaporkan penyusutan per SEMESTER, sementara kelas ini
 * menghitung per TAHUN penuh sejak tanggal perolehan — mengikuti cara yang
 * dipakai purwarupa. Untuk pelaporan SIMAK-BMN resmi, hitungannya perlu
 * disesuaikan menjadi per semester, termasuk aturan pembulatan semester
 * pertama. Seluruh perhitungan sengaja dikurung di kelas ini agar
 * penyesuaian itu cukup dilakukan di satu tempat.
 *
 * Nilai rupiah diperlakukan sebagai bilangan bulat (rupiah penuh) supaya tidak
 * ada galat pembulatan pecahan biner pada angka uang.
 */
final readonly class Penyusutan
{
    private function __construct(
        public int $nilaiPerolehan,
        public int $masaManfaat,
        public int $umurTahun,
        public int $susutPerTahun,
        public int $akumulasi,
        public int $nilaiBuku,
        public bool $habisMasaManfaat,
    ) {}

    public static function hitung(
        int $nilaiPerolehan,
        int $masaManfaat,
        ?CarbonInterface $tglPerolehan,
        ?CarbonInterface $per = null,
    ): self {
        $per ??= now();

        // Masa manfaat nol berarti tidak disusutkan — misalnya tanah, atau
        // barang persediaan. Membaginya akan melempar DivisionByZeroError.
        if ($masaManfaat <= 0 || $nilaiPerolehan <= 0 || $tglPerolehan === null) {
            return new self(
                nilaiPerolehan: max(0, $nilaiPerolehan),
                masaManfaat: max(0, $masaManfaat),
                umurTahun: 0,
                susutPerTahun: 0,
                akumulasi: 0,
                nilaiBuku: max(0, $nilaiPerolehan),
                habisMasaManfaat: false,
            );
        }

        // Barang yang tanggal perolehannya di masa depan belum boleh disusutkan.
        $umur = max(0, (int) $tglPerolehan->diffInYears($per));

        $susutPerTahun = intdiv($nilaiPerolehan, $masaManfaat);

        // Dibatasi masa manfaat agar akumulasi tidak melampaui nilai perolehan.
        $tahunDisusutkan = min($umur, $masaManfaat);
        $akumulasi = min($nilaiPerolehan, $susutPerTahun * $tahunDisusutkan);

        // Pada tahun terakhir, sisa pembagian dibebankan sekaligus supaya nilai
        // buku benar-benar nol dan tidak menyisakan rupiah menggantung akibat
        // pembulatan ke bawah.
        if ($tahunDisusutkan >= $masaManfaat) {
            $akumulasi = $nilaiPerolehan;
        }

        return new self(
            nilaiPerolehan: $nilaiPerolehan,
            masaManfaat: $masaManfaat,
            umurTahun: $umur,
            susutPerTahun: $susutPerTahun,
            akumulasi: $akumulasi,
            nilaiBuku: $nilaiPerolehan - $akumulasi,
            habisMasaManfaat: $umur >= $masaManfaat,
        );
    }

    /** @return array<string,int|bool> */
    public function toArray(): array
    {
        return [
            'nilai_perolehan' => $this->nilaiPerolehan,
            'masa_manfaat' => $this->masaManfaat,
            'umur_tahun' => $this->umurTahun,
            'susut_per_tahun' => $this->susutPerTahun,
            'akumulasi_penyusutan' => $this->akumulasi,
            'nilai_buku' => $this->nilaiBuku,
            'habis_masa_manfaat' => $this->habisMasaManfaat,
        ];
    }
}
