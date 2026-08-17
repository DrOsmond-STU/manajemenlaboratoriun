<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pemesanan ruangan.
 *
 * Bentrok jadwal dijaga di lapisan basis data, bukan hanya divalidasi aplikasi
 * (ADR-03). Alasannya: pemeriksaan "apakah masih kosong?" lalu "simpan" adalah
 * dua langkah terpisah, sehingga dua permintaan bersamaan dapat sama-sama
 * melihat slot kosong dan sama-sama menyimpan. Batasan eksklusi menutup celah
 * itu di titik penulisan.
 *
 * Kolom `periode` dibuat GENERATED agar tetap mustahil menyimpang dari
 * `mulai`/`selesai` yang dipakai Eloquent, dan agar tidak ada kode aplikasi
 * yang perlu mengetahui tipe rentang PostgreSQL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('keperluan');
            $table->unsignedInteger('jumlah_peserta')->default(0);
            $table->timestampTz('mulai');
            $table->timestampTz('selesai');
            $table->string('status')->default('menunggu');
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index(['room_id', 'mulai']);
            $table->index(['user_id', 'mulai']);
            $table->index('status');
        });

        // Rentang setengah terbuka '[)': 08.00–12.00 dan 12.00–14.00 dianggap
        // TIDAK bentrok, sehingga pemakaian berurutan tetap diizinkan.
        DB::statement("
            ALTER TABLE bookings
            ADD COLUMN periode tstzrange
            GENERATED ALWAYS AS (tstzrange(mulai, selesai, '[)')) STORED
        ");

        DB::statement('ALTER TABLE bookings ADD CONSTRAINT bookings_selesai_after_mulai CHECK (selesai > mulai)');

        // Pemesanan yang dibatalkan/ditolak tidak lagi memblokir slot.
        DB::statement("
            ALTER TABLE bookings
            ADD CONSTRAINT bookings_no_overlap
            EXCLUDE USING gist (room_id WITH =, periode WITH &&)
            WHERE (status NOT IN ('dibatalkan', 'ditolak'))
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
