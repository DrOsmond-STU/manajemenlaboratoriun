<?php

namespace Database\Seeders;

use App\Models\BmnKodeBarang;
use Illuminate\Database\Seeder;

/**
 * ⚠  CUPLIKAN CONTOH — BUKAN MASTER RESMI.
 *
 * Daftar di bawah hanya memuat sebagian kecil kode barang, secukupnya untuk
 * pengembangan dan pengujian. Master sesungguhnya berisi ribuan kode dan wajib
 * diimpor dari referensi resmi Kementerian Keuangan/SAKTI milik satuan kerja
 * sebelum modul aset dipakai untuk data nyata.
 *
 * Uraian dan masa manfaat di sini mengikuti purwarupa dan BELUM diverifikasi
 * terhadap dokumen resmi. Jangan dijadikan rujukan penyusutan.
 */
class BmnKodeBarangSeeder extends Seeder
{
    /**
     * @var list<array{kode:string, uraian:string, masa_manfaat:int}>
     */
    private const KODE = [
        // Golongan 3 — Peralatan dan Mesin, Bidang 08 — Alat Laboratorium
        ['kode' => '3.08.01.03.001', 'uraian' => 'Chromatography Set (HPLC)', 'masa_manfaat' => 8],
        ['kode' => '3.08.01.03.004', 'uraian' => 'Spectrophotometer', 'masa_manfaat' => 8],
        ['kode' => '3.08.01.08.003', 'uraian' => 'Autoclave', 'masa_manfaat' => 8],
        ['kode' => '3.08.01.09.005', 'uraian' => 'Alat Keselamatan Kerja Laboratorium', 'masa_manfaat' => 5],
        ['kode' => '3.08.01.06.002', 'uraian' => 'Microscope', 'masa_manfaat' => 10],
        ['kode' => '3.08.01.12.007', 'uraian' => 'Alat Preparasi Sampel', 'masa_manfaat' => 8],
        ['kode' => '3.08.01.14.002', 'uraian' => 'Analytical Balance', 'masa_manfaat' => 8],
        ['kode' => '3.08.01.16.004', 'uraian' => 'Alat Pengkondisian Ruangan Laboratorium', 'masa_manfaat' => 8],
        ['kode' => '3.08.01.21.009', 'uraian' => 'Alat Uji Mekanik', 'masa_manfaat' => 10],
        ['kode' => '3.08.01.24.006', 'uraian' => 'Alat Analisis Material', 'masa_manfaat' => 10],
        ['kode' => '3.08.01.30.001', 'uraian' => 'Alat Elektrokimia', 'masa_manfaat' => 8],
        ['kode' => '3.08.07.02.003', 'uraian' => 'Alat Sampling Lingkungan', 'masa_manfaat' => 5],
        ['kode' => '3.08.07.04.001', 'uraian' => 'Alat Analisis Kualitas Air', 'masa_manfaat' => 8],
        ['kode' => '3.08.09.03.005', 'uraian' => 'Alat Kalibrasi', 'masa_manfaat' => 10],

        // Bidang lain yang dipakai fasilitas penunjang
        ['kode' => '3.05.01.05.012', 'uraian' => 'Meubelair', 'masa_manfaat' => 4],
        ['kode' => '3.05.02.01.003', 'uraian' => 'Alat Pendingin (AC)', 'masa_manfaat' => 5],
        ['kode' => '3.06.01.05.048', 'uraian' => 'Alat Audio Visual', 'masa_manfaat' => 5],
        ['kode' => '3.10.01.02.003', 'uraian' => 'Personal Computer', 'masa_manfaat' => 4],
    ];

    public function run(): void
    {
        foreach (self::KODE as $baris) {
            // updateOrCreate agar seeder aman dijalankan berulang dan tidak
            // menggandakan master saat dipakai menyegarkan lingkungan uji.
            BmnKodeBarang::updateOrCreate(['kode' => $baris['kode']], $baris);
        }
    }
}
