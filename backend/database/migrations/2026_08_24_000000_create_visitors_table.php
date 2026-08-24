<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Manajemen Pengunjung — registrasi tamu, check-in/out, dan badge.
 *
 * TIDAK PUNYA sumbu cakupan gedung/unit kerja — sama seperti Vendor:
 * front desk perlu melihat SELURUH tamu, terlepas gedung/ruangan mana
 * yang mereka kunjungi hari itu.
 *
 * `status` SENGAJA disimpan sebagai kolom (bukan diturunkan murni dari
 * masuk_pada/keluar_pada saat dibaca) supaya dapat ditapis langsung lewat
 * WHERE tanpa menghitung ulang tiga kemungkinan setiap kali — dijaga tetap
 * konsisten dengan pasangan tanggalnya lewat CHECK di bawah, sama seperti
 * pola AssetMaintenance.status vs dikerjakan_pada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visitors', function (Blueprint $table) {
            $table->id();
            $table->string('nama');
            $table->string('instansi')->nullable();
            $table->string('tujuan')->nullable();
            $table->foreignId('host_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();

            $table->date('tanggal');
            $table->timestamp('masuk_pada')->nullable();
            $table->timestamp('keluar_pada')->nullable();
            $table->string('badge', 20)->nullable();

            $table->string('status', 20)->default('terjadwal');
            $table->text('catatan')->nullable();
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index('tanggal');
            $table->index('status');
        });

        DB::statement("
            ALTER TABLE visitors
            ADD CONSTRAINT visitors_status_sah
            CHECK (status IN ('terjadwal', 'di_dalam', 'selesai'))
        ");

        // Tidak bisa "di dalam" atau "selesai" tanpa waktu masuk yang
        // tercatat — status dan pasangan tanggalnya wajib konsisten,
        // pola yang sama dengan asset_maintenances_selesai_bertanggal.
        DB::statement("
            ALTER TABLE visitors
            ADD CONSTRAINT visitors_masuk_bertanggal
            CHECK (status = 'terjadwal' OR masuk_pada IS NOT NULL)
        ");
        DB::statement("
            ALTER TABLE visitors
            ADD CONSTRAINT visitors_keluar_bertanggal
            CHECK (status <> 'selesai' OR keluar_pada IS NOT NULL)
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('visitors');
    }
};
