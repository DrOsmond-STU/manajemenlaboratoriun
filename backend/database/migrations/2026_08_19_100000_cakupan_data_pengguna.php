<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cakupan data pengguna (SECURITY.md §4.2).
 *
 * Otorisasi bekerja pada dua sumbu. Sumbu pertama — peran menentukan TINDAKAN
 * — sudah ada. Sumbu kedua ini menentukan OBJEK: dari sekian data yang boleh
 * disentuh perannya, mana saja yang benar-benar miliknya.
 *
 * Tanpa sumbu kedua, seorang PIC gedung A yang berhak "melihat aset" berarti
 * melihat aset seluruh satuan kerja — termasuk gedung yang bukan urusannya.
 * Itu tidak menimbulkan galat apa pun; hanya kebocoran yang tidak disadari.
 *
 * KEPUTUSAN YANG PERLU DIKONFIRMASI
 * ---------------------------------
 * Pengguna TANPA penugasan gedung tidak dibatasi, bukan dikunci total.
 *
 * Alasannya praktis: mengunci total membuat setiap pengguna baru tidak dapat
 * bekerja sampai seseorang ingat menugaskannya, dan pada sistem yang baru
 * dipasang itu berarti semua orang buntu sekaligus.
 *
 * Tetapi konsekuensinya harus disadari: bila admin LUPA menugaskan gedung,
 * penggunanya melihat semua gedung — gagal ke arah longgar, bukan ketat.
 * Bila satuan kerja Anda menghendaki sebaliknya, ubah `tanpaPenugasanBerarti`
 * pada App\Support\CakupanData menjadi 'tidak ada', dan sediakan prosedur
 * penugasan sebelum akun diaktifkan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Unit kerja pengguna. Dipakai membatasi booking dan aset.
            $table->string('unit_kerja')->nullable()->after('email');
            $table->index('unit_kerja');
        });

        // Penugasan gedung. Satu pengguna dapat mengampu lebih dari satu
        // gedung, sehingga tabel tersendiri — bukan kolom pada users.
        Schema::create('user_gedung', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('gedung');
            $table->timestamps();

            $table->unique(['user_id', 'gedung']);
            $table->index('gedung');
        });

        // Unit kerja pada aset dan pemesanan, agar keduanya dapat ditapis
        // tanpa menelusuri relasi berlapis setiap kali.
        Schema::table('assets', function (Blueprint $table) {
            $table->string('unit_kerja')->nullable()->after('kode_internal');
            $table->index('unit_kerja');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->string('unit_kerja')->nullable()->after('keperluan');
            $table->index('unit_kerja');
        });

        DB::statement("COMMENT ON TABLE user_gedung IS 'Penugasan gedung per pengguna; kosong berarti tidak dibatasi'");
    }

    public function down(): void
    {
        Schema::table('bookings', fn (Blueprint $t) => $t->dropColumn('unit_kerja'));
        Schema::table('assets', fn (Blueprint $t) => $t->dropColumn('unit_kerja'));
        Schema::dropIfExists('user_gedung');
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('unit_kerja'));
    }
};
