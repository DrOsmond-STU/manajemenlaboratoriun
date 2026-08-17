<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pencatat NUP terakhir per (kode lokasi, kode barang).
 *
 * NUP — Nomor Urut Pendaftaran — berjalan per sub-sub kelompok barang pada
 * satu satuan kerja, bukan global. Dua alat dengan kode barang berbeda sama-
 * sama boleh ber-NUP 1.
 *
 * Kenapa tabel tersendiri, bukan `MAX(nup) + 1` saat mendaftar?
 *
 * `MAX(nup) + 1` membaca lalu menulis dalam dua langkah, sehingga dua
 * pendaftaran bersamaan dapat membaca nilai maksimum yang sama dan sama-sama
 * mengklaim NUP berikutnya. Dengan tabel ini, klaim dilakukan satu pernyataan
 * atomik `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, sehingga tidak ada
 * jeda antara membaca dan menulis. Lihat App\Services\NupAllocator.
 *
 * Alasan yang sama dengan batasan eksklusi pada tabel bookings: aturan yang
 * tidak boleh dilanggar dijaga basis data, bukan hanya niat baik aplikasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bmn_nup_counters', function (Blueprint $table) {
            $table->id();
            $table->string('kode_lokasi', 32);
            $table->string('kode_barang', 16);
            $table->unsignedInteger('nup_terakhir')->default(0);
            $table->timestamps();

            $table->unique(['kode_lokasi', 'kode_barang']);
        });

        DB::statement('
            ALTER TABLE bmn_nup_counters
            ADD CONSTRAINT bmn_nup_counters_tidak_mundur
            CHECK (nup_terakhir >= 0)
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('bmn_nup_counters');
    }
};
