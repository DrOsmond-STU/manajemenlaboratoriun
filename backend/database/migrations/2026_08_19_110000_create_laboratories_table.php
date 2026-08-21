<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Laboratorium.
 *
 * Berbeda dari ruangan, dan perbedaannya penting: ruangan adalah tempat
 * fisik yang dapat dipesan per jam, sedangkan laboratorium adalah unit kerja
 * teknis yang menempati satu ruangan, punya penanggung jawab, jam layanan,
 * dan akreditasi. Satu ruangan dapat berganti fungsi laboratorium tanpa
 * pindah tempat, dan satu laboratorium dapat pindah ruangan tanpa berganti
 * identitas.
 *
 * Menggabungkan keduanya menjadi satu tabel akan memaksa salah satunya
 * mengalah: entah laboratorium kehilangan riwayat saat pindah ruangan, atau
 * ruangan ikut terhapus saat laboratoriumnya ditutup.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('laboratories', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 32);
            $table->string('nama', 150);

            // Ruangan yang ditempati. nullOnDelete: laboratorium tidak ikut
            // hilang bila ruangannya dihapus — identitasnya berdiri sendiri.
            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();

            $table->string('jenis', 50)->nullable();       // Pengujian / Riset / Kalibrasi
            $table->string('unit_kerja')->nullable();
            $table->unsignedInteger('luas_m2')->nullable();
            $table->unsignedInteger('kapasitas')->default(0);
            $table->string('jam_layanan', 60)->nullable();
            $table->string('akreditasi', 100)->nullable();
            $table->string('status', 20)->default('aktif');

            $table->foreignId('penanggung_jawab_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('supervisor_id')->nullable()->constrained('users')->nullOnDelete();

            $table->text('keterangan')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('unit_kerja');
            $table->index('room_id');
        });

        // Kode unik hanya di antara yang aktif — sama alasannya dengan kode
        // ruangan: laboratorium ditutup dan kodenya wajar dipakai kembali.
        DB::statement('
            CREATE UNIQUE INDEX laboratories_kode_unik_aktif
            ON laboratories (kode)
            WHERE deleted_at IS NULL
        ');

        DB::statement("
            ALTER TABLE laboratories
            ADD CONSTRAINT laboratories_status_sah
            CHECK (status IN ('aktif', 'pemeliharaan', 'tidak_aktif'))
        ");

        // Aset menempel pada laboratorium, bukan hanya pada ruangan. Alat
        // dapat berpindah ruangan bersama laboratoriumnya tanpa kehilangan
        // keterkaitan dengan unit teknis yang bertanggung jawab atasnya.
        Schema::table('assets', function (Blueprint $table) {
            $table->foreignId('laboratory_id')->nullable()->after('room_id')
                ->constrained('laboratories')->nullOnDelete();
            $table->index('laboratory_id');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('laboratory_id');
        });

        Schema::dropIfExists('laboratories');
    }
};
