<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Melengkapi Manajemen Pengguna & Peran.
 *
 * `aktif` MENGGANTIKAN TIGA STATUS PURWARUPA (Aktif/Cuti/Nonaktif) DENGAN
 * DUA STATUS SUNGGUHAN.
 *
 * Purwarupa punya status "Cuti" di antara Aktif dan Nonaktif. Tidak ada
 * sistem manajemen cuti/kepegawaian di aplikasi ini — dan untuk kontrol
 * akses, "sedang cuti" tidak berbeda dari "aktif": pengguna cuti biasanya
 * tetap boleh masuk (memeriksa surel, menyelesaikan yang mendesak), bukan
 * dikunci sistem. Kolom `aktif` karenanya biner: dapat masuk atau tidak.
 * Nuansa kepegawaian "sedang cuti" bukan keputusan kontrol akses dan tidak
 * dimodelkan di sini.
 *
 * TIDAK ADA HAPUS PENGGUNA, HANYA NONAKTIFKAN.
 *
 * Pengguna terhubung ke audit_logs, bookings, checklist_pelaksanaan, dan
 * banyak tabel lain sebagai pencatat/pelaku. Menghapus barisnya akan
 * meninggalkan referensi yatim atau memutus jejak "siapa melakukan apa".
 * Menonaktifkan (aktif=false) mencegahnya masuk tanpa kehilangan
 * riwayatnya — pola yang sama dengan status pada Rental/Invoice/Quotation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('aktif')->default(true)->after('unit_kerja');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('aktif');
        });
    }
};
