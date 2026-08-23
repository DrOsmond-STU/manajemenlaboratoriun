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
 *
 * CATATAN, PADA PERLUASAN INI: beberapa widget purwarupa dijatuhkan, bukan
 * dipangkas diam-diam — dicatat di docs/BACKEND.md §4.2 karena domainnya
 * memang belum punya model di server (pengunjung/kunjungan) atau
 * membutuhkan definisi yang saat ini masih berupa asumsi (jam operasional
 * untuk utilisasi). "Utilisasi laboratorium" khususnya dijatuhkan karena
 * laboratorium sendiri tidak punya mekanisme pemesanan — hanya ruangan yang
 * punya `bookings`.
 */
class RegistriWidget
{
    /**
     * Bentuk penyajian yang dikenal antarmuka.
     *
     * `bsc-skor`, `bsc-perspektif`, `bsc-peta`, `bsc-tabel` adalah EMPAT
     * presentasi berbeda atas SATU widget (`bsc.kartu`) dan data yang SAMA
     * persis (kartu skor BSC periode berjalan) — bukan empat widget
     * terpisah. Memisahkannya sebagai widget berarti Scorecard::kartu()
     * dihitung berkali-kali untuk data yang identik.
     */
    public const BENTUK = [
        'angka', 'daftar', 'sebaran', 'garis', 'batang', 'deret', 'matriks', 'teks',
        'bsc-skor', 'bsc-perspektif', 'bsc-peta', 'bsc-tabel',
    ];

    /**
     * @var array<string, array{judul: string, izin: ?string, bentuk: string, satuan?: string}>
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
        'aset.nilai-buku' => [
            'judul' => 'Nilai buku BMN', 'izin' => 'aset.lihat',
            'bentuk' => 'angka', 'satuan' => 'rupiah',
        ],
        'aset.kepatuhan-kalibrasi' => [
            'judul' => 'Kepatuhan kalibrasi', 'izin' => 'kalibrasi.lihat',
            'bentuk' => 'angka', 'satuan' => '%',
        ],

        // --- Ruangan ------------------------------------------------------------
        'ruangan.jumlah' => [
            'judul' => 'Jumlah ruangan', 'izin' => 'master-data.lihat',
            'bentuk' => 'angka', 'satuan' => 'unit',
        ],
        'ruangan.status' => [
            'judul' => 'Status ruangan', 'izin' => 'master-data.lihat',
            'bentuk' => 'sebaran',
        ],
        'ruangan.utilisasi' => [
            'judul' => 'Utilisasi ruangan', 'izin' => 'booking-ruangan.lihat',
            'bentuk' => 'angka', 'satuan' => '%',
        ],
        'ruangan.tren-utilisasi' => [
            'judul' => 'Tren utilisasi ruangan', 'izin' => 'booking-ruangan.lihat',
            'bentuk' => 'deret', 'satuan' => '%',
        ],
        'ruangan.heatmap-okupansi' => [
            'judul' => 'Heatmap okupansi ruangan', 'izin' => 'booking-ruangan.lihat',
            'bentuk' => 'matriks',
        ],

        // --- Booking ruangan --------------------------------------------------
        'booking.hari-ini' => [
            'judul' => 'Pemesanan ruangan hari ini', 'izin' => 'booking-ruangan.lihat',
            'bentuk' => 'daftar',
        ],
        'booking.mendatang' => [
            'judul' => 'Pemesanan mendatang', 'izin' => 'booking-ruangan.lihat',
            'bentuk' => 'daftar',
        ],
        'booking.menunggu' => [
            'judul' => 'Pemesanan menunggu persetujuan', 'izin' => 'booking-ruangan.lihat',
            'bentuk' => 'angka', 'satuan' => 'pengajuan',
        ],
        'booking.status' => [
            'judul' => 'Sebaran status booking', 'izin' => 'booking-ruangan.lihat',
            'bentuk' => 'sebaran',
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
        'peminjaman.status' => [
            'judul' => 'Sebaran status peminjaman', 'izin' => 'booking-alat.lihat',
            'bentuk' => 'sebaran',
        ],

        // --- Laboratorium ---------------------------------------------------
        'laboratorium.jumlah' => [
            'judul' => 'Jumlah laboratorium', 'izin' => 'laboratorium.lihat',
            'bentuk' => 'angka', 'satuan' => 'unit',
        ],
        'laboratorium.status' => [
            'judul' => 'Status laboratorium', 'izin' => 'laboratorium.lihat',
            'bentuk' => 'sebaran',
        ],
        'laboratorium.tanpa-penanggung-jawab' => [
            'judul' => 'Laboratorium tanpa penanggung jawab', 'izin' => 'laboratorium.lihat',
            'bentuk' => 'angka', 'satuan' => 'unit',
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
        'pemeliharaan.aktif' => [
            'judul' => 'Pekerjaan pemeliharaan aktif', 'izin' => 'pemeliharaan.lihat',
            'bentuk' => 'angka', 'satuan' => 'pekerjaan',
        ],
        'pemeliharaan.jenis' => [
            'judul' => 'Pemeliharaan per jenis', 'izin' => 'pemeliharaan.lihat',
            'bentuk' => 'sebaran',
        ],
        'pemeliharaan.biaya-ytd' => [
            'judul' => 'Biaya pemeliharaan tahun berjalan', 'izin' => 'pemeliharaan.lihat',
            'bentuk' => 'angka', 'satuan' => 'rupiah',
        ],
        'pemeliharaan.tren-biaya' => [
            'judul' => 'Tren biaya pemeliharaan', 'izin' => 'pemeliharaan.lihat',
            'bentuk' => 'deret', 'satuan' => 'rupiah',
        ],

        // --- Checklist --------------------------------------------------------
        'checklist.tugas-saya' => [
            'judul' => 'Checklist yang harus saya kerjakan', 'izin' => 'checklist.lihat',
            'bentuk' => 'daftar',
        ],
        'checklist.jatuh-tempo' => [
            'judul' => 'Checklist jatuh tempo', 'izin' => 'checklist.lihat',
            'bentuk' => 'daftar',
        ],
        'checklist.per-jenis' => [
            'judul' => 'Checklist per jenis', 'izin' => 'checklist.lihat',
            'bentuk' => 'sebaran',
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
        'tagihan.status' => [
            'judul' => 'Sebaran status tagihan', 'izin' => 'penyewaan.lihat',
            'bentuk' => 'sebaran',
        ],
        'penyewaan.jumlah-aktif' => [
            'judul' => 'Penyewaan aktif', 'izin' => 'penyewaan.lihat',
            'bentuk' => 'angka', 'satuan' => 'sewa',
        ],
        'penyewaan.pendapatan-ytd' => [
            'judul' => 'Pendapatan sewa tahun berjalan', 'izin' => 'penyewaan.lihat',
            'bentuk' => 'angka', 'satuan' => 'rupiah',
        ],
        'penyewaan.tren-pendapatan' => [
            'judul' => 'Tren pendapatan sewa', 'izin' => 'penyewaan.lihat',
            'bentuk' => 'deret', 'satuan' => 'rupiah',
        ],

        // --- Notifikasi email --------------------------------------------------
        'notifikasi.terkirim-hari-ini' => [
            'judul' => 'Notifikasi terkirim hari ini', 'izin' => 'notifikasi.lihat',
            'bentuk' => 'angka', 'satuan' => 'email',
        ],
        'notifikasi.gagal' => [
            'judul' => 'Notifikasi gagal terkirim', 'izin' => 'notifikasi.lihat',
            'bentuk' => 'angka', 'satuan' => 'email',
        ],

        // --- Balanced Scorecard -------------------------------------------------
        'bsc.skor' => [
            'judul' => 'Skor Balanced Scorecard', 'izin' => 'dashboard.lihat',
            'bentuk' => 'angka', 'satuan' => '%',
        ],
        'bsc.per-perspektif' => [
            'judul' => 'Skor per perspektif', 'izin' => 'dashboard.lihat',
            'bentuk' => 'sebaran',
        ],
        'bsc.tren-skor' => [
            'judul' => 'Tren skor Balanced Scorecard', 'izin' => 'dashboard.lihat',
            'bentuk' => 'deret', 'satuan' => '%',
        ],
        // 'bentuk' bawaannya salah satu dari empat presentasi BSC; pemasang
        // memilih sendiri lewat kolom bentuk saat menyimpan tata letak —
        // lihat SimpanDashboardRequest.
        'bsc.kartu' => [
            'judul' => 'Kartu Skor Balanced Scorecard', 'izin' => 'dashboard.lihat',
            'bentuk' => 'bsc-skor',
        ],

        // --- Lintas modul --------------------------------------------------------
        // Menggabungkan beberapa kondisi mendesak dari domain berbeda ke
        // satu panel. Setiap butir tetap tunduk pada izin domainnya
        // masing-masing di dalam DataWidget — widget ini sendiri tidak
        // punya izin tunggal karena bukan milik satu domain.
        'sistem.peringatan' => [
            'judul' => 'Peringatan Operasional', 'izin' => null,
            'bentuk' => 'daftar',
        ],

        // Catatan bebas: tidak ada data yang dihitung server sama sekali —
        // isinya murni teks yang diketik pengguna dan tersimpan di `opsi`.
        // Tanpa izin: menulis catatan sendiri bukan akses ke data siapa pun.
        'catatan.bebas' => [
            'judul' => 'Catatan', 'izin' => null,
            'bentuk' => 'teks',
        ],
    ];

    /**
     * Susunan bawaan dashboard baru — sengaja SEBUAH SUBSET terkurasi, bukan
     * "seluruh widget yang izinnya dipunyai peran ini".
     *
     * Katalog penuh (di atas) sudah 40-an entri setelah perluasan ini. Tanpa
     * kurasi, seorang Super Admin yang punya hampir semua izin akan
     * mendapatkan dashboard pertama berisi puluhan widget sekaligus —
     * sebaliknya dari maksud "berguna sejak login pertama".
     *
     * @var list<string>
     */
    public const BAWAAN = [
        'aset.jumlah', 'aset.kondisi', 'aset.nilai-perolehan', 'aset.tanpa-penanggung-jawab',
        'booking.hari-ini', 'booking.menunggu',
        'peminjaman.aktif', 'peminjaman.terlambat',
        'kalibrasi.kedaluwarsa', 'pemeliharaan.terjadwal',
        'checklist.tugas-saya',
        'tagihan.piutang', 'tagihan.jatuh-tempo',
        'sistem.peringatan',
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
     * @return array{judul: string, izin: ?string, bentuk: string, satuan?: string}|null
     */
    public static function keterangan(string $kunci): ?array
    {
        return self::WIDGET[$kunci] ?? null;
    }
}
