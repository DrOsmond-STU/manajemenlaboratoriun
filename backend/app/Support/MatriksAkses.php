<?php

namespace App\Support;

/**
 * Matriks peran × modul — sumber kebenaran tunggal untuk otorisasi.
 *
 * Isinya sengaja disalin apa adanya dari SECURITY.md §4.1, bukan diterjemahkan
 * lebih dulu menjadi daftar izin. Alasannya: daftar izin yang ditulis tangan
 * akan menyimpang dari dokumennya begitu salah satu berubah, dan penyimpangan
 * itu tidak menimbulkan galat apa pun — hanya orang yang diam-diam boleh
 * melakukan hal yang seharusnya tidak boleh.
 *
 * Tingkat diterjemahkan menjadi izin oleh IZIN_PER_TINGKAT di bawah, sehingga
 * mengubah satu sel di sini langsung mengubah izin yang terbentuk.
 *
 * TINGKAT KEPERCAYAAN ISI
 * -----------------------
 * Enam peran pertama (super-admin sampai employee) tercantum lengkap pada
 * matriks SECURITY.md §4.1 dan disalin persis.
 *
 * Enam peran sisanya TIDAK ada di matriks itu; tingkatnya disimpulkan dari
 * uraian "Kebutuhan utama" pada PRD §4 dan ditandai dengan PERLU_DIKONFIRMASI.
 * Jangan diperlakukan sebagai keputusan yang sudah disetujui pemilik produk.
 */
final class MatriksAkses
{
    /** Tingkat akses, dari yang paling sempit. */
    public const TINGKAT = ['-', 'LIHAT', 'BUAT', 'UBAH', 'PENUH'];

    /** @var array<string, list<string>> */
    public const IZIN_PER_TINGKAT = [
        '-' => [],
        'LIHAT' => ['lihat'],
        'BUAT' => ['lihat', 'buat'],
        'UBAH' => ['lihat', 'buat', 'ubah'],
        'PENUH' => ['lihat', 'buat', 'ubah', 'hapus', 'kelola'],
    ];

    /**
     * @var array<string, string> Modul beserta namanya untuk antarmuka.
     *
     * `pengguna` (Manajemen Pengguna & Peran) TIDAK ADA di SECURITY.md §4.1
     * — modul itu ditambahkan belakangan, dan diberi PENUH hanya untuk
     * super-admin, `-` untuk seluruh peran lain, TANPA kecuali. Ini
     * keputusan konservatif yang sengaja dibuat lebih ketat daripada
     * menyimpulkan dari PRD (pola yang dipakai `PERLU_DIKONFIRMASI`
     * lainnya): membuat/menonaktifkan akun dan melihat peran siapa punya
     * akses apa adalah salah satu tindakan paling sensitif dalam sistem
     * ini, dan melebar-lebarkan aksesnya tanpa persetujuan eksplisit
     * pemilik produk berisiko jauh lebih besar daripada mempersempitnya.
     */
    public const MODUL = [
        'dashboard' => 'Dashboard',
        'booking-ruangan' => 'Booking ruangan',
        'booking-alat' => 'Booking alat',
        'laboratorium' => 'Laboratorium',
        'aset' => 'Aset & BMN',
        'penyewaan' => 'Penyewaan & penagihan',
        'pemeliharaan' => 'Pemeliharaan',
        'kalibrasi' => 'Kalibrasi',
        'checklist' => 'Checklist',
        'notifikasi' => 'Notifikasi email',
        'master-data' => 'Master data',
        'audit' => 'Audit trail',
        'pengguna' => 'Pengguna & peran',

        // Tidak ada di SECURITY.md §4.1 (dibangun belakangan, seperti
        // `pengguna`) — tetapi TIDAK sesensitif itu, karena berisi data
        // referensi operasional (nama vendor, kontak, kategori, kontrak),
        // bukan akun/akses siapa pun. Tingkatnya karena itu MENIRU KOLOM
        // `master-data` PERSIS di seluruh peran — vendor secara operasional
        // setara dengan data referensi lain (ruangan, laboratorium), bukan
        // butuh penguncian ekstra ala `pengguna`.
        'vendor' => 'Vendor & mitra',
    ];

    /** @var array<string, string> */
    public const NAMA_PERAN = [
        'super-admin' => 'Super Admin',
        'facility-manager' => 'Facility Manager',
        'lab-manager' => 'Laboratory Manager',
        'asset-manager' => 'Asset Manager',
        'finance' => 'Finance',
        'employee' => 'Employee / User',
        'lab-technician' => 'Lab Technician',
        'room-administrator' => 'Room Administrator',
        'event-manager' => 'Event Manager',
        'pic' => 'PIC / Penanggung Jawab',
        'external-user' => 'External User',
        'management' => 'Management',
    ];

    /** Peran yang tingkatnya disimpulkan, bukan diambil dari matriks resmi. */
    public const PERLU_DIKONFIRMASI = [
        'lab-technician', 'room-administrator', 'event-manager',
        'pic', 'external-user', 'management',
    ];

    /**
     * peran => modul => tingkat
     *
     * @var array<string, array<string, string>>
     */
    public const MATRIKS = [
        // ---- Disalin persis dari SECURITY.md §4.1 -----------------------
        'super-admin' => [
            'dashboard' => 'PENUH', 'booking-ruangan' => 'PENUH', 'booking-alat' => 'PENUH',
            'laboratorium' => 'PENUH', 'aset' => 'PENUH', 'penyewaan' => 'PENUH',
            'pemeliharaan' => 'PENUH', 'kalibrasi' => 'PENUH', 'checklist' => 'PENUH',
            'notifikasi' => 'PENUH', 'master-data' => 'PENUH', 'audit' => 'PENUH',
            'pengguna' => 'PENUH', 'vendor' => 'PENUH',
        ],
        'facility-manager' => [
            'dashboard' => 'PENUH', 'booking-ruangan' => 'PENUH', 'booking-alat' => 'LIHAT',
            'laboratorium' => 'LIHAT', 'aset' => 'UBAH', 'penyewaan' => 'UBAH',
            'pemeliharaan' => 'PENUH', 'kalibrasi' => 'LIHAT', 'checklist' => 'PENUH',
            'notifikasi' => 'UBAH', 'master-data' => 'UBAH', 'audit' => 'LIHAT',
            'pengguna' => '-', 'vendor' => 'UBAH',
        ],
        'lab-manager' => [
            'dashboard' => 'LIHAT', 'booking-ruangan' => 'UBAH', 'booking-alat' => 'PENUH',
            'laboratorium' => 'PENUH', 'aset' => 'LIHAT', 'penyewaan' => '-',
            'pemeliharaan' => 'UBAH', 'kalibrasi' => 'PENUH', 'checklist' => 'UBAH',
            'notifikasi' => 'LIHAT', 'master-data' => 'UBAH', 'audit' => '-',
            'pengguna' => '-', 'vendor' => 'UBAH',
        ],
        'asset-manager' => [
            'dashboard' => 'LIHAT', 'booking-ruangan' => 'LIHAT', 'booking-alat' => 'UBAH',
            'laboratorium' => 'LIHAT', 'aset' => 'PENUH', 'penyewaan' => '-',
            'pemeliharaan' => 'UBAH', 'kalibrasi' => 'UBAH', 'checklist' => 'UBAH',
            'notifikasi' => 'LIHAT', 'master-data' => 'UBAH', 'audit' => '-',
            'pengguna' => '-', 'vendor' => 'UBAH',
        ],
        'finance' => [
            'dashboard' => 'LIHAT', 'booking-ruangan' => 'LIHAT', 'booking-alat' => '-',
            'laboratorium' => '-', 'aset' => 'LIHAT', 'penyewaan' => 'PENUH',
            'pemeliharaan' => 'LIHAT', 'kalibrasi' => '-', 'checklist' => '-',
            'notifikasi' => 'LIHAT', 'master-data' => '-', 'audit' => '-',
            'pengguna' => '-', 'vendor' => '-',
        ],
        'employee' => [
            'dashboard' => 'LIHAT', 'booking-ruangan' => 'BUAT', 'booking-alat' => 'BUAT',
            'laboratorium' => 'LIHAT', 'aset' => '-', 'penyewaan' => '-',
            'pemeliharaan' => '-', 'kalibrasi' => '-', 'checklist' => 'BUAT',
            'notifikasi' => '-', 'master-data' => '-', 'audit' => '-',
            'pengguna' => '-', 'vendor' => '-',
        ],

        // ---- PERLU_DIKONFIRMASI: disimpulkan dari PRD §4 ----------------
        'lab-technician' => [
            'dashboard' => 'LIHAT', 'booking-ruangan' => 'LIHAT', 'booking-alat' => 'UBAH',
            'laboratorium' => 'LIHAT', 'aset' => 'LIHAT', 'penyewaan' => '-',
            'pemeliharaan' => 'UBAH', 'kalibrasi' => 'UBAH', 'checklist' => 'UBAH',
            'notifikasi' => '-', 'master-data' => '-', 'audit' => '-',
            'pengguna' => '-', 'vendor' => '-',
        ],
        'room-administrator' => [
            'dashboard' => 'LIHAT', 'booking-ruangan' => 'PENUH', 'booking-alat' => 'LIHAT',
            'laboratorium' => '-', 'aset' => 'LIHAT', 'penyewaan' => 'LIHAT',
            'pemeliharaan' => 'LIHAT', 'kalibrasi' => '-', 'checklist' => 'UBAH',
            'notifikasi' => 'LIHAT', 'master-data' => 'UBAH', 'audit' => '-',
            'pengguna' => '-', 'vendor' => 'UBAH',
        ],
        'event-manager' => [
            'dashboard' => 'LIHAT', 'booking-ruangan' => 'UBAH', 'booking-alat' => 'BUAT',
            'laboratorium' => '-', 'aset' => 'LIHAT', 'penyewaan' => 'UBAH',
            'pemeliharaan' => '-', 'kalibrasi' => '-', 'checklist' => 'BUAT',
            'notifikasi' => 'LIHAT', 'master-data' => '-', 'audit' => '-',
            'pengguna' => '-', 'vendor' => '-',
        ],
        'pic' => [
            'dashboard' => 'LIHAT', 'booking-ruangan' => 'UBAH', 'booking-alat' => 'UBAH',
            'laboratorium' => 'LIHAT', 'aset' => 'LIHAT', 'penyewaan' => '-',
            'pemeliharaan' => 'LIHAT', 'kalibrasi' => 'LIHAT', 'checklist' => 'UBAH',
            'notifikasi' => 'LIHAT', 'master-data' => '-', 'audit' => '-',
            'pengguna' => '-', 'vendor' => '-',
        ],
        'external-user' => [
            'dashboard' => '-', 'booking-ruangan' => 'BUAT', 'booking-alat' => '-',
            'laboratorium' => '-', 'aset' => '-', 'penyewaan' => 'BUAT',
            'pemeliharaan' => '-', 'kalibrasi' => '-', 'checklist' => '-',
            'notifikasi' => '-', 'master-data' => '-', 'audit' => '-',
            'pengguna' => '-', 'vendor' => '-',
        ],
        'management' => [
            'dashboard' => 'LIHAT', 'booking-ruangan' => 'LIHAT', 'booking-alat' => 'LIHAT',
            'laboratorium' => 'LIHAT', 'aset' => 'LIHAT', 'penyewaan' => 'LIHAT',
            'pemeliharaan' => 'LIHAT', 'kalibrasi' => 'LIHAT', 'checklist' => 'LIHAT',
            'notifikasi' => 'LIHAT', 'master-data' => 'LIHAT', 'audit' => 'LIHAT',
            'pengguna' => '-', 'vendor' => 'LIHAT',
        ],
    ];

    /**
     * Seluruh nama izin yang mungkin, misalnya `aset.ubah`.
     *
     * @return list<string>
     */
    public static function semuaIzin(): array
    {
        $izin = [];

        foreach (array_keys(self::MODUL) as $modul) {
            foreach (self::IZIN_PER_TINGKAT['PENUH'] as $aksi) {
                $izin[] = "{$modul}.{$aksi}";
            }
        }

        return $izin;
    }

    /**
     * Izin yang dimiliki satu peran.
     *
     * @return list<string>
     */
    public static function izinPeran(string $peran): array
    {
        $izin = [];

        foreach (self::MATRIKS[$peran] ?? [] as $modul => $tingkat) {
            foreach (self::IZIN_PER_TINGKAT[$tingkat] ?? [] as $aksi) {
                $izin[] = "{$modul}.{$aksi}";
            }
        }

        return $izin;
    }
}
