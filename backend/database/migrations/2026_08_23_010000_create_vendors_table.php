<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Vendor & mitra — pemasok jasa pendukung fasilitas (AV, katering, HVAC,
 * kalibrasi, dekorasi, keamanan, dan sejenisnya).
 *
 * TIDAK PUNYA sumbu cakupan gedung/unit kerja — sama seperti Penyewaan &
 * Penagihan (lihat catatan di DataWidget), vendor adalah entitas
 * administratif tingkat satuan kerja, bukan sesuatu yang melekat pada satu
 * gedung tertentu.
 *
 * `kontrak_berlaku_sampai` NULLABLE dipakai apa adanya sebagai penanda
 * "tanpa kontrak tetap" (purwarupa: "Per Proyek") — bukan kolom status
 * terpisah yang bisa menyimpang dari tanggalnya sendiri.
 *
 * `rating` adalah PENILAIAN STAF YANG DIISI MANUAL, bukan dihitung dari
 * riwayat pekerjaan — sistem ini tidak (belum) punya alur "nilai vendor
 * setelah pekerjaan selesai". Menyimpannya sebagai kolom yang jujur diisi
 * manual lebih baik daripada berpura-pura itu skor terhitung.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vendors', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 32)->unique();
            $table->string('nama');
            $table->string('kategori');
            $table->string('pic_nama')->nullable();
            $table->string('pic_telepon', 32)->nullable();
            $table->string('pic_email')->nullable();
            $table->decimal('rating', 2, 1)->nullable();
            $table->date('kontrak_berlaku_sampai')->nullable();
            $table->boolean('aktif')->default(true);
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index('kategori');
            $table->index('aktif');
        });

        DB::statement('
            ALTER TABLE vendors
            ADD CONSTRAINT vendors_rating_valid
            CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('vendors');
    }
};
