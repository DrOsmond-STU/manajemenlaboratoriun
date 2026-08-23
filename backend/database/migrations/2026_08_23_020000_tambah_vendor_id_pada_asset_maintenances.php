<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tautan OPSIONAL ke vendor terdaftar — `pelaksana` (teks bebas) tetap ada
 * apa adanya untuk pekerjaan yang dikerjakan staf internal atau pihak yang
 * belum terdaftar sebagai vendor. Pola yang sama dengan kode_internal
 * (bebas) dan bmn_id (terstruktur) pada aset: dua cara mencatat pelaksana,
 * satu bebas dan satu tertaut, bukan memaksa semuanya jadi vendor.
 *
 * nullOnDelete, bukan restrict: menghapus vendor tidak boleh menghalangi
 * riwayat pekerjaan lama — riwayatnya tetap terbaca lewat `pelaksana`
 * (yang diisi dari nama vendor saat pekerjaan dijadwalkan) walau tautannya
 * terputus.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_maintenances', function (Blueprint $table) {
            $table->foreignId('vendor_id')->nullable()->after('pelaksana')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('asset_maintenances', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vendor_id');
        });
    }
};
