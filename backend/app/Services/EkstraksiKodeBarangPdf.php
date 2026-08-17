<?php

namespace App\Services;

use Smalot\PdfParser\Parser;

/**
 * Mengambil daftar kode barang dari lampiran PMK berbentuk PDF.
 *
 * Lampiran kodefikasi BMN adalah tabel panjang berisi kode 10 digit dan uraian
 * barangnya. Ketika PDF diubah menjadi teks, tabel itu runtuh menjadi baris-
 * baris biasa dengan jarak yang tidak menentu — dan di antaranya bercampur
 * nomor halaman, judul kolom yang berulang di tiap halaman, serta potongan
 * kalimat batang tubuh peraturan.
 *
 * Pendekatannya: JANGAN mencoba memahami tata letak tabelnya. Cari saja pola
 * kode 10 digit di awal baris, lalu ambil sisa barisnya sebagai uraian. Yang
 * tidak berpola diabaikan — bukan ditebak.
 *
 * Kelas ini memakai PHP murni (smalot/pdfparser), bukan pdftotext, supaya
 * perintah impor tetap dapat dijalankan di hosting cPanel yang tidak
 * mengizinkan pemasangan program sistem.
 */
class EkstraksiKodeBarangPdf
{
    /**
     * Kode 10 digit di awal baris, dengan pemisah titik, spasi, atau tanpa
     * pemisah sama sekali. Diikuti uraian sampai akhir baris.
     */
    private const POLA_BARIS = '/^\s*(\d[\s.]*\d{2}[\s.]*\d{2}[\s.]*\d{2}[\s.]*\d{3})\s+(.+?)\s*$/u';

    /**
     * Baris yang jelas bukan data, agar tidak ikut terbaca sebagai uraian.
     * Judul kolom berulang di setiap halaman lampiran.
     */
    private const BARIS_DIABAIKAN = [
        'kode barang', 'uraian', 'nama barang', 'golongan', 'bidang', 'kelompok',
        'sub kelompok', 'sub-sub kelompok', 'lampiran', 'menteri keuangan',
        'republik indonesia', 'salinan', 'peraturan menteri keuangan',
    ];

    public function __construct(private readonly Parser $parser) {}

    /**
     * @return array{
     *     kode: array<string, array{kode:string, uraian:string, masa_manfaat:int}>,
     *     halaman: int,
     *     baris_terbaca: int
     * }
     */
    public function dariBerkas(string $berkas): array
    {
        $pdf = $this->parser->parseFile($berkas);
        $halaman = $pdf->getPages();

        $teks = '';

        // Dibaca per halaman, bukan sekaligus, karena getText() pada dokumen
        // besar dapat menyatukan baris antar halaman menjadi satu baris panjang.
        foreach ($halaman as $h) {
            $teks .= $h->getText()."\n";
        }

        return $this->dariTeks($teks, count($halaman));
    }

    /**
     * Dipisahkan dari pembacaan berkas supaya penguraiannya dapat diuji tanpa
     * bergantung pada satu PDF tertentu.
     *
     * @return array{
     *     kode: array<string, array{kode:string, uraian:string, masa_manfaat:int}>,
     *     halaman: int,
     *     baris_terbaca: int
     * }
     */
    public function dariTeks(string $teks, int $halaman = 0): array
    {
        $hasil = [];
        $terbaca = 0;

        foreach (preg_split('/\R/u', $teks) ?: [] as $baris) {
            $terbaca++;

            if (! preg_match(self::POLA_BARIS, $baris, $cocok)) {
                continue;
            }

            $kode = $this->rapikanKode($cocok[1]);

            if ($kode === null) {
                continue;
            }

            $uraian = $this->rapikanUraian($cocok[2]);

            if ($uraian === '') {
                continue;
            }

            // Kode yang muncul lebih dari sekali (misalnya karena judul tabel
            // terulang) tidak menimpa entri pertama yang sudah benar.
            $hasil[$kode] ??= [
                'kode' => $kode,
                'uraian' => $uraian,
                'masa_manfaat' => 0,
            ];
        }

        return ['kode' => $hasil, 'halaman' => $halaman, 'baris_terbaca' => $terbaca];
    }

    /** Sama dengan aturan pada perintah impor: 10 digit, tidak ditambal. */
    private function rapikanKode(string $mentah): ?string
    {
        $digit = preg_replace('/\D/', '', $mentah) ?? '';

        if (strlen($digit) !== 10 || $digit[0] === '0' || $digit[0] === '9') {
            return null;
        }

        return sprintf(
            '%s.%s.%s.%s.%s',
            substr($digit, 0, 1), substr($digit, 1, 2), substr($digit, 3, 2),
            substr($digit, 5, 2), substr($digit, 7, 3),
        );
    }

    /**
     * Uraian dibersihkan dari sisa tata letak: titik-titik penuntun, nomor
     * halaman yang menempel di ujung, dan spasi berganda.
     */
    private function rapikanUraian(string $mentah): string
    {
        $uraian = preg_replace('/\.{3,}/', ' ', $mentah) ?? $mentah;
        $uraian = preg_replace('/\s{2,}/', ' ', $uraian) ?? $uraian;
        $uraian = trim($uraian, " \t.-—–|");

        foreach (self::BARIS_DIABAIKAN as $abaikan) {
            if (mb_strtolower($uraian) === $abaikan) {
                return '';
            }
        }

        // Uraian satu huruf hampir pasti sisa kolom yang terpotong.
        return mb_strlen($uraian) < 2 ? '' : $uraian;
    }
}
