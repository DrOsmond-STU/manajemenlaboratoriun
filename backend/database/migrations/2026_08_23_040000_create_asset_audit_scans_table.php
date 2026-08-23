<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Satu baris = satu aset yang berhasil dipindai (ditemukan secara fisik)
 * dalam satu sesi audit. Aset yang TIDAK PERNAH dipindai tidak punya baris
 * di sini sama sekali — lihat catatan pada migrasi asset_audit_sessions
 * tentang bagaimana "tidak ditemukan" dihitung dari ketiadaannya.
 *
 * `lokasi_tercatat`/`kondisi_tercatat` adalah SNAPSHOT keadaan aset PADA
 * SAAT DIPINDAI, bukan nilai yang dibaca ulang dari `assets` saat laporan
 * dibuka. Tanpa snapshot, temuan "lokasi berbeda" bisa menghilang begitu
 * saja jika asetnya lantas dipindahkan (lewat Asset Movement) SETELAH
 * dipindai tapi SEBELUM sesi ditutup — padahal saat dipindai, ia memang
 * ditemukan di lokasi yang berbeda dari yang tercatat ketika itu.
 *
 * Satu aset hanya boleh punya SATU baris per sesi — memindai ulang
 * memperbarui baris yang sama (lihat indeks unik), bukan menambah baris
 * baru yang membuat hitungan "sudah diverifikasi" mengembang palsu.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_audit_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_audit_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();

            $table->string('lokasi_tercatat')->nullable();
            $table->string('lokasi_ditemukan')->nullable();
            $table->string('kondisi_tercatat', 2)->nullable();
            $table->string('kondisi_ditemukan', 2)->nullable();

            $table->foreignId('auditor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('dipindai_pada');
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->unique(['asset_audit_session_id', 'asset_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_audit_scans');
    }
};
