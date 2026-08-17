<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Pemberi Nomor Urut Pendaftaran (NUP) yang aman terhadap balapan.
 *
 * NUP berjalan per (kode lokasi, kode barang). Cara yang menggoda tetapi salah:
 *
 *     $nup = Asset::where(...)->max('nup') + 1;   // ← membaca
 *     Asset::create([... 'nup' => $nup ...]);     // ← lalu menulis
 *
 * Di antara dua baris itu ada jeda. Dua pendaftaran bersamaan dapat membaca
 * nilai maksimum yang sama, lalu sama-sama mengklaim NUP yang sama — dan barang
 * yang berbeda akan mengaku sebagai barang yang sama di laporan SIMAK-BMN.
 *
 * Kelas ini menutup jeda tersebut dengan satu pernyataan atomik. `ON CONFLICT
 * DO UPDATE` mengunci baris pencatat selama pernyataan berjalan, sehingga
 * penambah kedua menunggu, lalu membaca nilai yang sudah bertambah — bukan
 * nilai basi.
 *
 * Batas terakhirnya tetap indeks unik `assets_identitas_bmn_unik`: seandainya
 * ada kode yang memberi NUP dengan cara lain, basis data tetap menolak
 * kekembaran.
 */
class NupAllocator
{
    /**
     * Klaim NUP berikutnya untuk kombinasi lokasi dan kode barang.
     *
     * Harus dipanggil di dalam transaksi yang sama dengan penyimpanan asetnya,
     * agar nomor tidak terlanjur terpakai bila penyimpanan gagal.
     */
    public function berikutnya(string $kodeLokasi, string $kodeBarang): int
    {
        $hasil = DB::selectOne('
            INSERT INTO bmn_nup_counters (kode_lokasi, kode_barang, nup_terakhir, created_at, updated_at)
            VALUES (?, ?, 1, now(), now())
            ON CONFLICT (kode_lokasi, kode_barang)
            DO UPDATE SET nup_terakhir = bmn_nup_counters.nup_terakhir + 1,
                          updated_at   = now()
            RETURNING nup_terakhir
        ', [$kodeLokasi, $kodeBarang]);

        return (int) $hasil->nup_terakhir;
    }

    /**
     * Selaraskan pencatat dengan NUP tertinggi yang benar-benar terpakai.
     *
     * Diperlukan setelah impor data lama, yang menulis aset langsung tanpa
     * melewati pemberi nomor ini. Tanpa penyelarasan, pendaftaran berikutnya
     * akan mengklaim NUP yang sudah dipakai dan ditolak indeks unik.
     */
    public function selaraskan(string $kodeLokasi, string $kodeBarang): int
    {
        $tertinggi = (int) DB::table('assets')
            ->where('kode_lokasi', $kodeLokasi)
            ->where('kode_barang', $kodeBarang)
            ->max('nup');

        DB::table('bmn_nup_counters')->updateOrInsert(
            ['kode_lokasi' => $kodeLokasi, 'kode_barang' => $kodeBarang],
            ['nup_terakhir' => $tertinggi, 'updated_at' => now(), 'created_at' => now()],
        );

        return $tertinggi;
    }
}
