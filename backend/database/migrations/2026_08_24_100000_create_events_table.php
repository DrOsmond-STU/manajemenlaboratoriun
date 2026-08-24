<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * "Manajemen Event" purwarupa. Sebuah event pada dasarnya adalah booking
 * ruangan yang lebih kaya — punya organizer, PIC, jumlah peserta, dan
 * anggaran perencanaan — sehingga tabelnya berdiri sendiri (bukan kolom
 * tambahan pada `bookings`) supaya field-field itu tidak memaksa SETIAP
 * booking (termasuk rapat internal biasa) ikut menyimpannya.
 *
 * `anggaran` SENGAJA TIDAK ditautkan ke Tariff/Invoice/Payment — ini
 * angka PERENCANAAN yang diisi manual oleh penyelenggara, bukan tagihan
 * resmi. Event yang sungguh disewakan (butuh tagihan) tetap lewat jalur
 * Penyewaan yang sudah ada; keduanya sengaja dibiarkan sebagai dua
 * konsep berbeda untuk saat ini (lihat catatan rancangan di BACKEND.md).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->string('nama');
            $table->string('jenis')->nullable();
            $table->string('organizer')->nullable();
            $table->foreignId('pic_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();

            $table->date('tanggal');
            $table->unsignedInteger('jumlah_peserta')->nullable();
            $table->bigInteger('anggaran')->nullable();

            $table->string('status', 20)->default('direncanakan');
            $table->text('catatan')->nullable();
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index('tanggal');
            $table->index('status');
        });

        DB::statement("
            ALTER TABLE events
            ADD CONSTRAINT events_status_sah
            CHECK (status IN ('direncanakan', 'terkonfirmasi', 'berlangsung', 'selesai', 'dibatalkan'))
        ");
        DB::statement('
            ALTER TABLE events
            ADD CONSTRAINT events_anggaran_tidak_negatif
            CHECK (anggaran IS NULL OR anggaran >= 0)
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
