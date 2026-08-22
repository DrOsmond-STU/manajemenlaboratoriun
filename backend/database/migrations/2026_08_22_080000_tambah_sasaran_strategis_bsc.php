<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sasaran strategis (objective) sebagai lapis pengelompokan antara
 * perspektif dan indikator kinerja.
 *
 * Kartu skor BSC yang dibangun `2026_08_21_200000_create_bsc_tables.php`
 * hanya dua tingkat: perspektif → indikator langsung. Purwarupa yang sudah
 * disetujui punya tiga tingkat — Kaplan & Norton memang begitu: setiap
 * perspektif berisi beberapa SASARAN STRATEGIS ("Meningkatkan pendapatan
 * layanan"), dan setiap sasaran baru berisi indikator kinerjanya. Tanpa
 * pengelompokan ini, sepuluh indikator dalam satu perspektif tampil sebagai
 * daftar datar tanpa konteks mengapa mereka dikumpulkan bersama.
 *
 * Sasaran TIDAK punya bobotnya sendiri — bobot tetap milik indikator dan
 * tetap dijumlahkan per PERSPEKTIF (bukan per sasaran), persis aturan yang
 * sudah ditegakkan pemicu tertunda pada migrasi sebelumnya. Sasaran murni
 * pengelompokan tampilan; menambahkan bobot berjenjang di sana akan berarti
 * dua aturan penjumlahan yang harus selalu sinkron, dan purwarupa yang
 * disetujui pun tidak memberi bobot pada sasaran.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bsc_objectives', function (Blueprint $table) {
            $table->id();
            $table->string('perspektif', 20);
            $table->string('periode', 7);
            $table->string('nama', 200);
            $table->unsignedSmallInteger('urutan')->default(0);
            $table->timestamps();

            $table->index(['periode', 'perspektif']);
        });

        DB::statement("
            ALTER TABLE bsc_objectives
            ADD CONSTRAINT bsc_objectives_perspektif_sah
            CHECK (perspektif IN ('keuangan', 'pelanggan', 'proses-internal', 'pembelajaran'))
        ");

        DB::statement("
            ALTER TABLE bsc_objectives
            ADD CONSTRAINT bsc_objectives_periode_sah
            CHECK (periode ~ '^[0-9]{4}(-Q[1-4])?$')
        ");

        DB::statement('
            CREATE UNIQUE INDEX bsc_objectives_nama_unik
            ON bsc_objectives (periode, perspektif, lower(nama))
        ');

        Schema::table('bsc_indikator', function (Blueprint $table) {
            // TIDAK NULL: purwarupa yang disetujui tidak punya indikator
            // "lepas" di luar sasaran manapun, dan mengizinkannya di sini
            // hanya memindahkan pertanyaan "sasaran apa" ke antarmuka tanpa
            // jawaban. cascadeOnDelete supaya menulis ulang satu perspektif
            // (hapus sasaran lama, buat baru) ikut membersihkan indikator
            // lamanya lewat basis data, bukan lewat urutan panggilan yang
            // harus selalu benar di kode aplikasi.
            $table->foreignId('bsc_objective_id')->after('perspektif')
                ->constrained('bsc_objectives')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bsc_indikator', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bsc_objective_id');
        });

        Schema::dropIfExists('bsc_objectives');
    }
};
