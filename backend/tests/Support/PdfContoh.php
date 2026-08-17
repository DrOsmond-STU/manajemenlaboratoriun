<?php

namespace Tests\Support;

/**
 * Pembangkit PDF minimal untuk keperluan uji.
 *
 * Dibuat sendiri, bukan memakai berkas contoh yang disimpan di repositori,
 * supaya ujinya tidak bergantung pada satu PDF yang bisa saja hilang, berubah,
 * atau tidak jelas asal-usulnya. Yang dihasilkan adalah PDF sungguhan dengan
 * struktur objek dan tabel xref yang sah, bukan tiruan — sehingga pengurai
 * yang diuji benar-benar melewati jalur yang sama dengan berkas nyata.
 */
final class PdfContoh
{
    /**
     * @param  list<string>  $baris  Isi teks, satu baris per elemen.
     * @return string Lokasi berkas sementara; pemanggil yang menghapusnya.
     */
    public static function buat(array $baris): string
    {
        $isi = "BT\n/F1 10 Tf\n";
        $y = 780;

        foreach ($baris as $teks) {
            $aman = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $teks);
            $isi .= "1 0 0 1 50 {$y} Tm ({$aman}) Tj\n";
            $y -= 16;
        }

        $isi .= 'ET';

        $objek = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
                .'/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
            '<< /Length '.strlen($isi)." >>\nstream\n{$isi}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offset = [];

        foreach ($objek as $i => $o) {
            $offset[$i] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n{$o}\nendobj\n";
        }

        $awalXref = strlen($pdf);
        $pdf .= 'xref'."\n0 ".(count($objek) + 1)."\n0000000000 65535 f \n";

        foreach ($offset as $o) {
            $pdf .= sprintf("%010d 00000 n \n", $o);
        }

        $pdf .= 'trailer'."\n<< /Size ".(count($objek) + 1)." /Root 1 0 R >>\n"
            ."startxref\n{$awalXref}\n%%EOF";

        $berkas = tempnam(sys_get_temp_dir(), 'lampiran').'.pdf';
        file_put_contents($berkas, $pdf);

        return $berkas;
    }
}
