<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Melengkapi tabel ruangan agar sepadan dengan layar yang sudah disetujui.
 *
 * Tabel ini semula dibuat untuk melayani modul pemesanan — cukup kode, nama,
 * gedung, lantai, kapasitas. Purwarupa yang sudah ditinjau pengguna
 * menampilkan lebih banyak: jenis ruangan, luas, skema tarif, penanggung
 * jawab, tata letak yang didukung, dan daftar fasilitas.
 *
 * Menyambungkan layar ke tabel yang lebih tipis akan MENGHILANGKAN kolom-kolom
 * itu dari antarmuka tanpa ada yang meminta — bentuk kemunduran yang paling
 * mudah lolos, karena tidak ada galat apa pun, hanya isian yang diam-diam
 * berkurang. Karena itu tabelnya yang menyusul, bukan layarnya yang dipangkas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->string('jenis', 40)->nullable()->after('nama');

            // Luas dalam meter persegi. Bilangan bulat: pecahan luas ruangan
            // tidak pernah dipakai dalam praktik penatausahaan, dan desimal
            // hanya mengundang pertanyaan tentang pembulatan.
            $table->unsignedInteger('luas_m2')->nullable()->after('lantai');

            // Skema tarif dipisahkan dari nilainya. Ruangan internal bertarif
            // nol berbeda maknanya dari ruangan berbayar yang tarifnya belum
            // ditetapkan, dan satu kolom angka saja tidak dapat membedakannya.
            $table->string('skema_tarif', 20)->default('internal')->after('kapasitas');
            $table->unsignedBigInteger('tarif')->nullable()->after('skema_tarif');

            $table->foreignId('penanggung_jawab_id')->nullable()
                ->after('perlu_persetujuan')->constrained('users')->nullOnDelete();

            // Daftar pendek yang tidak pernah dikueri sendirian — selalu
            // dibaca bersama ruangannya. Tabel penghubung untuk ini hanya
            // menambah sambungan tanpa menambah kemampuan.
            $table->jsonb('tata_letak')->nullable();
            $table->jsonb('fasilitas')->nullable();

            $table->text('keterangan')->nullable();

            $table->index('jenis');
        });

        DB::statement("
            ALTER TABLE rooms
            ADD CONSTRAINT rooms_skema_tarif_sah
            CHECK (skema_tarif IN ('internal', 'internal_gratis', 'berbayar', 'terbatas'))
        ");

        // Ruangan berbayar tanpa tarif adalah ruangan yang akan ditagihkan
        // dengan angka yang belum ada. Ditolak di sini, bukan ditemukan saat
        // tagihan pertama terbit.
        DB::statement("
            ALTER TABLE rooms
            ADD CONSTRAINT rooms_berbayar_wajib_bertarif
            CHECK (skema_tarif <> 'berbayar' OR tarif IS NOT NULL)
        ");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_berbayar_wajib_bertarif');
        DB::statement('ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_skema_tarif_sah');

        Schema::table('rooms', function (Blueprint $table) {
            $table->dropConstrainedForeignId('penanggung_jawab_id');
            $table->dropColumn([
                'jenis', 'luas_m2', 'skema_tarif', 'tarif',
                'tata_letak', 'fasilitas', 'keterangan',
            ]);
        });
    }
};
