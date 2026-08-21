<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dashboard yang dapat disusun sendiri pengguna.
 *
 * Kisinya 12 kolom, mengikuti kelaziman tata letak web. Geometrinya dijaga
 * batasan basis data, BUKAN oleh kode JavaScript yang menyusunnya:
 * seret-lepas di peramban mengirim angka apa pun yang dikehendaki
 * pengirimnya, dan satu widget berlebar 0 atau berlebar 40 merusak tata letak
 * bagi semua orang yang membukanya — termasuk pemiliknya sendiri, yang lalu
 * tidak punya cara memperbaikinya lewat antarmuka yang sudah rusak.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dashboards', function (Blueprint $table) {
            $table->id();
            $table->string('nama', 120);

            // NULL berarti dashboard bersama (templat organisasi); selain itu
            // milik pribadi seseorang.
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();

            $table->string('jenis', 20)->default('operasional');
            $table->boolean('utama')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'jenis']);
        });

        DB::statement("
            ALTER TABLE dashboards
            ADD CONSTRAINT dashboards_jenis_sah
            CHECK (jenis IN ('operasional', 'analitik', 'bsc'))
        ");

        // Satu dashboard utama per pengguna, dan satu untuk dashboard bersama.
        // Indeks parsial, karena yang perlu unik hanya baris yang bertanda
        // utama — pengguna boleh punya berapa pun dashboard lainnya.
        DB::statement('
            CREATE UNIQUE INDEX dashboards_utama_per_pengguna
            ON dashboards (COALESCE(user_id, 0))
            WHERE utama
        ');

        Schema::create('dashboard_widgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dashboard_id')->constrained()->cascadeOnDelete();

            // Kunci dari RegistriWidget. Bukan nama tabel, bukan kueri —
            // lihat keterangan panjang di kelas itu.
            $table->string('widget', 60);

            // Kosong berarti pakai judul bawaan registri. Pengguna boleh
            // menamainya sendiri; yang tidak boleh diubahnya adalah cara
            // angkanya dihitung.
            $table->string('judul', 120)->nullable();
            $table->string('bentuk', 20)->nullable();

            // Tapis penyajian (rentang waktu, batas jumlah baris). Isinya
            // divalidasi lapisan aplikasi per jenis widget, bukan diteruskan
            // apa adanya ke kueri.
            $table->jsonb('opsi')->nullable();

            $table->unsignedSmallInteger('kolom')->default(0);
            $table->unsignedSmallInteger('baris')->default(0);
            $table->unsignedSmallInteger('lebar')->default(3);
            $table->unsignedSmallInteger('tinggi')->default(2);

            $table->timestamps();

            $table->index(['dashboard_id', 'baris', 'kolom']);
        });

        DB::statement('
            ALTER TABLE dashboard_widgets
            ADD CONSTRAINT dashboard_widgets_geometri_sah
            CHECK (
                lebar BETWEEN 1 AND 12
                AND tinggi BETWEEN 1 AND 12
                AND kolom BETWEEN 0 AND 11
                AND baris <= 200
                -- Tidak boleh menjorok keluar kisi. Widget yang tepinya lewat
                -- kolom ke-12 akan terpotong atau membungkus tak terduga,
                -- tergantung peramban — dan penyebabnya nyaris mustahil
                -- ditemukan dari laporan pengguna.
                AND kolom + lebar <= 12
            )
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('dashboard_widgets');
        Schema::dropIfExists('dashboards');
    }
};
