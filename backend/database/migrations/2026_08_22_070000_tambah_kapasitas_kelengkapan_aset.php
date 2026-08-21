<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dua isian pada formulir registrasi alat yang belum punya tempat.
 *
 * `kapasitas_ukur` adalah TEKS, bukan angka: yang ditulis petugas berbentuk
 * "0,1–500 mg/L", "±0,0001 g", "20–200 °C" — rentang bersatuan, bukan
 * bilangan tunggal. Memaksanya menjadi angka berarti membuang satuan dan
 * batas bawahnya, yaitu justru bagian yang menentukan apakah alat itu cocok
 * untuk sebuah pengujian.
 *
 * `kelengkapan` adalah larik: kolom, detektor, perangkat lunak, manual,
 * sertifikat. Selalu dibaca bersama asetnya dan tidak pernah dikueri
 * sendirian — sama seperti fasilitas ruangan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('kapasitas_ukur', 120)->nullable()->after('spesifikasi');
            $table->jsonb('kelengkapan')->nullable()->after('kapasitas_ukur');
        });
    }

    public function down(): void
    {
        Schema::table('assets', fn (Blueprint $t) => $t->dropColumn(['kapasitas_ukur', 'kelengkapan']));
    }
};
