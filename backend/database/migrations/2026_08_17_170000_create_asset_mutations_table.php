<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Riwayat perubahan aset: perpindahan ruangan, perubahan kondisi, pergantian
 * penanggung jawab, dan perubahan status penggunaan.
 *
 * Kenapa riwayat, bukan sekadar menimpa kolomnya?
 *
 * Penatausahaan BMN menuntut pertanggungjawaban: siapa memindahkan barang ke
 * mana, kapan, dan atas dasar apa. Bila kolom `room_id` hanya ditimpa, satu-
 * satunya jawaban yang tersedia adalah keadaan hari ini — sementara pertanyaan
 * yang muncul saat pemeriksaan justru "sejak kapan barang ini di sini" dan
 * "siapa yang memindahkannya".
 *
 * Bentuknya sengaja umum (jenis + nilai lama + nilai baru) agar satu tabel
 * melayani semua jenis perubahan. Alternatifnya, satu tabel per jenis, akan
 * berkembang menjadi empat tabel yang isinya nyaris sama.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_mutations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();

            // penempatan | kondisi | penanggung_jawab | status_penggunaan
            $table->string('jenis', 32);

            $table->string('nilai_lama')->nullable();
            $table->string('nilai_baru')->nullable();

            // Pelaku disimpan agar riwayat tetap dapat dipertanggungjawabkan.
            // nullOnDelete, bukan cascade: pengguna boleh dihapus, riwayatnya
            // tidak boleh ikut hilang.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'created_at']);
            $table->index('jenis');
        });

        DB::statement("
            ALTER TABLE asset_mutations
            ADD CONSTRAINT asset_mutations_jenis_sah
            CHECK (jenis IN ('penempatan', 'kondisi', 'penanggung_jawab', 'status_penggunaan'))
        ");

        // Mencatat perubahan yang tidak mengubah apa pun hanya mengotori riwayat
        // dan membuat pemeriksaan lebih sulit, bukan lebih mudah.
        DB::statement('
            ALTER TABLE asset_mutations
            ADD CONSTRAINT asset_mutations_ada_perubahan
            CHECK (nilai_lama IS DISTINCT FROM nilai_baru)
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_mutations');
    }
};
