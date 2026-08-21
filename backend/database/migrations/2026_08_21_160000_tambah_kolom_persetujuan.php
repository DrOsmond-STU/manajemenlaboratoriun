<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Persetujuan pemesanan ruangan dan peminjaman alat.
 *
 * ATURAN YANG DIJAGA BASIS DATA: TIDAK BOLEH MENYETUJUI PENGAJUAN SENDIRI.
 *
 * SECURITY.md §4.3 menyebutnya sebagai aturan yang tidak boleh dilanggar,
 * "meskipun peran mengizinkan". Aturan semacam itu terlalu penting untuk
 * hanya dijaga lapisan aplikasi: ia harus tetap berlaku pada impor massal,
 * perintah artisan, dan perbaikan manual lewat psql.
 *
 * Batasannya sederhana dan tidak dapat ditawar:
 *
 *     disetujui_oleh IS NULL OR disetujui_oleh <> user_id
 *
 * Kolom disimpan pada masing-masing tabel, bukan pada satu tabel persetujuan
 * bersama. Alasannya: batasan di atas hanya dapat ditulis bila pemohon dan
 * penyetuju berada pada baris yang sama. Tabel persetujuan terpisah akan
 * memaksa aturan itu turun menjadi pemicu lintas tabel — lebih rumit, dan
 * lebih mudah salah.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['bookings', 'equipment_loans'] as $tabel) {
            Schema::table($tabel, function (Blueprint $table) {
                $table->foreignId('disetujui_oleh')->nullable()->after('status')
                    ->constrained('users')->nullOnDelete();
                $table->timestampTz('disetujui_pada')->nullable()->after('disetujui_oleh');
                $table->text('alasan_penolakan')->nullable()->after('disetujui_pada');

                $table->index('disetujui_oleh');
            });

            DB::statement("
                ALTER TABLE {$tabel}
                ADD CONSTRAINT {$tabel}_tidak_setujui_sendiri
                CHECK (disetujui_oleh IS NULL OR disetujui_oleh <> user_id)
            ");

            // Penolakan tanpa alasan membuat pemohon tidak tahu apa yang harus
            // diperbaiki, dan berujung pengajuan ulang yang sama persis.
            DB::statement("
                ALTER TABLE {$tabel}
                ADD CONSTRAINT {$tabel}_penolakan_beralasan
                CHECK (status <> 'ditolak' OR alasan_penolakan IS NOT NULL)
            ");
        }
    }

    public function down(): void
    {
        foreach (['bookings', 'equipment_loans'] as $tabel) {
            DB::statement("ALTER TABLE {$tabel} DROP CONSTRAINT IF EXISTS {$tabel}_tidak_setujui_sendiri");
            DB::statement("ALTER TABLE {$tabel} DROP CONSTRAINT IF EXISTS {$tabel}_penolakan_beralasan");

            Schema::table($tabel, function (Blueprint $table) {
                $table->dropConstrainedForeignId('disetujui_oleh');
                $table->dropColumn(['disetujui_pada', 'alasan_penolakan']);
            });
        }
    }
};
