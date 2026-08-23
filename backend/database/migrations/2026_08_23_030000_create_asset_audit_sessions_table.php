<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Audit Aset — stock opname: menghitung ulang keberadaan aset secara fisik,
 * dibandingkan dengan yang tercatat di Register BMN.
 *
 * Sesi TIDAK menyimpan populasi asetnya sendiri (bukan snapshot baris aset
 * pada saat dibuat). Populasi dihitung LANGSUNG dari `assets` yang berada
 * dalam cakupan pengguna, sama seperti RingkasanAset — snapshot akan basi
 * begitu ada aset baru didaftarkan atau dipindahkan selama sesi berjalan,
 * dan populasi yang basi berarti persentase "sudah diverifikasi" berbohong.
 *
 * "Tidak ditemukan" TIDAK disimpan sebagai baris tersendiri. Ia adalah
 * SELISIH populasi dikurangi yang sudah dipindai — lihat AssetAuditService.
 * Selama sesi masih 'berjalan', selisih itu disebut "belum diaudit"; begitu
 * sesi ditutup ('selesai'), label yang sama berubah jadi "tidak ditemukan".
 * Angkanya sama, hanya maknanya berubah begitu jendela auditnya ditutup —
 * bukan dua definisi terpisah yang bisa saling menyimpang.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_audit_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('nama');
            $table->date('mulai');
            $table->date('target_selesai')->nullable();
            $table->string('status', 20)->default('berjalan');
            $table->timestamp('selesai_pada')->nullable();
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index('status');
        });

        DB::statement("
            ALTER TABLE asset_audit_sessions
            ADD CONSTRAINT asset_audit_sessions_status_sah
            CHECK (status IN ('berjalan', 'selesai'))
        ");

        // Sesi yang sudah ditutup wajib punya tanggal penutupan — tanpa ini,
        // "selesai" tanpa timestamp kehilangan titik acuan kapan populasi
        // yang belum dipindai resmi dianggap "tidak ditemukan".
        DB::statement("
            ALTER TABLE asset_audit_sessions
            ADD CONSTRAINT asset_audit_sessions_selesai_bertanggal
            CHECK (status <> 'selesai' OR selesai_pada IS NOT NULL)
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_audit_sessions');
    }
};
