<?php

namespace App\Support;

/**
 * Daftar tetap widget yang boleh dipasang di dashboard.
 *
 * INI ADALAH BATAS KEAMANAN, BUKAN SEKADAR KATALOG.
 *
 * Permintaannya adalah dashboard yang widgetnya dapat dikelola sendiri
 * pengguna. Cara paling langsung memenuhinya — menyimpan sumber data widget
 * sebagai teks bebas, misalnya nama tabel atau potongan kueri — akan
 * membongkar dua hal sekaligus:
 *
 *   1. Injeksi SQL lewat jalur yang tidak terlihat seperti jalur data:
 *      seseorang menyunting dashboard-nya sendiri, lalu kuerinya dijalankan
 *      server dengan hak penuh basis data.
 *   2. Penembusan cakupan data. Seluruh modul lain sudah membatasi apa yang
 *      terlihat lewat ->dalamCakupan(). Widget berkueri bebas melewatinya
 *      begitu saja, dan pengguna dapat menyusun widget yang menghitung
 *      ruangan di gedung yang tidak boleh dilihatnya — angkanya saja sudah
 *      membocorkan keberadaan datanya.
 *
 * Karena itu yang dapat dikelola pengguna adalah PENYAJIANNYA — widget mana,
 * di posisi mana, selebar dan setinggi apa, judul apa, dengan tapis apa —
 * sementara CARA menghitungnya tetap kode yang ditinjau. Kuncinya disimpan di
 * basis data, dan kunci yang tidak ada di daftar ini ditolak.
 *
 * Setiap widget menyebut izin yang dituntutnya. Izin diperiksa saat data
 * DIAMBIL, bukan hanya saat widget dipasang: peran berubah seiring waktu, dan
 * orang yang kehilangan peran Finance tidak boleh terus melihat angka piutang
 * hanya karena widgetnya sudah tersimpan di tata letaknya sejak dulu.
 */
class RegistriWidget
{
    /** Bentuk penyajian yang dikenal antarmuka. */
    public const BENTUK = ['angka', 'daftar', 'sebaran', 'garis', 'batang'];

    /**
     * @var array<string, array{judul: string, izin: string, bentuk: string, satuan?: string}>
     */
    public const WIDGET = [
        // --- Aset & BMN ------------------------------------------------------
        'aset.jumlah' => [
            'judul' => 'Jumlah aset', 'izin' => 'aset.lihat',
            'bentuk' => 'angka', 'satuan' => 'unit',
        ],
        'aset.kondisi' => [
            'judul' => 'Sebaran kondisi aset', 'izin' => 'aset.lihat',
            'bentuk' => 'sebaran',
        ],
        'aset.nilai-perolehan' => [
            'judul' => 'Nilai perolehan', 'izin' => 'aset.lihat',
            'bentuk' => 'angka', 'satuan' => 'rupiah',
        ],
        'aset.tanpa-penanggung-jawab' => [
            'judul' => 'Aset tanpa penanggung jawab', 'izin' => 'aset.lihat',
            'bentuk' => 'angka', 'satuan' => 'unit',
        ],

        // --- Booking ruangan --------------------------------------------------
        'booking.hari-ini' => [
            'judul' => 'Pemesanan ruangan hari ini', 'izin' => 'booking-ruangan.lihat',
            'bentuk' => 'daftar',
        ],
        'booking.menunggu' => [
            'judul' => 'Pemesanan menunggu persetujuan', 'izin' => 'booking-ruangan.lihat',
            'bentuk' => 'angka', 'satuan' => 'pengajuan',
        ],

        // --- Peminjaman alat --------------------------------------------------
        'peminjaman.aktif' => [
            'judul' => 'Alat sedang dipinjam', 'izin' => 'booking-alat.lihat',
            'bentuk' => 'angka', 'satuan' => 'unit',
        ],
        'peminjaman.terlambat' => [
            'judul' => 'Peminjaman terlambat kembali', 'izin' => 'booking-alat.lihat',
            'bentuk' => 'daftar',
        ],

        // --- Kalibrasi & pemeliharaan ----------------------------------------
        'kalibrasi.kedaluwarsa' => [
            'judul' => 'Kalibrasi kedaluwarsa', 'izin' => 'kalibrasi.lihat',
            'bentuk' => 'daftar',
        ],
        'pemeliharaan.terjadwal' => [
            'judul' => 'Pemeliharaan terjadwal', 'izin' => 'pemeliharaan.lihat',
            'bentuk' => 'daftar',
        ],

        // --- Checklist --------------------------------------------------------
        'checklist.tugas-saya' => [
            'judul' => 'Checklist yang harus saya kerjakan', 'izin' => 'checklist.lihat',
            'bentuk' => 'daftar',
        ],

        // --- Penyewaan & penagihan -------------------------------------------
        'tagihan.piutang' => [
            'judul' => 'Piutang belum tertagih', 'izin' => 'penyewaan.lihat',
            'bentuk' => 'angka', 'satuan' => 'rupiah',
        ],
        'tagihan.jatuh-tempo' => [
            'judul' => 'Tagihan lewat jatuh tempo', 'izin' => 'penyewaan.lihat',
            'bentuk' => 'daftar',
        ],
    ];

    /** @return list<string> */
    public static function kunci(): array
    {
        return array_keys(self::WIDGET);
    }

    public static function ada(string $kunci): bool
    {
        return isset(self::WIDGET[$kunci]);
    }

    public static function izin(string $kunci): ?string
    {
        return self::WIDGET[$kunci]['izin'] ?? null;
    }

    /**
     * @return array{judul: string, izin: string, bentuk: string, satuan?: string}|null
     */
    public static function keterangan(string $kunci): ?array
    {
        return self::WIDGET[$kunci] ?? null;
    }
}
