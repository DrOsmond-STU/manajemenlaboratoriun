<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * "Peserta Event" purwarupa — registrasi & absensi peserta per event.
 *
 * cascadeOnDelete ke `events` (BUKAN nullOnDelete seperti relasi lain
 * window ini): seorang peserta tanpa event tidak bermakna apa pun —
 * baris pesertanya memang milik event tersebut, bukan entitas mandiri
 * yang kebetulan menautkannya.
 *
 * Distribusi QR undangan dan mode kiosk self-service SENGAJA TIDAK
 * dimodelkan — absensi tetap dicatat staf/panitia lewat layar ini,
 * mengikuti simplifikasi yang sama dengan Manajemen Pengunjung.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();

            $table->string('nama');
            $table->string('instansi')->nullable();
            $table->string('email')->nullable();
            $table->string('telepon')->nullable();

            $table->string('status', 20)->default('terdaftar');
            $table->timestamp('hadir_pada')->nullable();
            $table->text('catatan')->nullable();

            $table->timestamps();

            $table->index('event_id');
            $table->index('status');
        });

        DB::statement("
            ALTER TABLE event_participants
            ADD CONSTRAINT event_participants_status_sah
            CHECK (status IN ('terdaftar', 'hadir', 'tidak_hadir'))
        ");
        DB::statement("
            ALTER TABLE event_participants
            ADD CONSTRAINT event_participants_hadir_bertanggal
            CHECK (status <> 'hadir' OR hadir_pada IS NOT NULL)
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('event_participants');
    }
};
