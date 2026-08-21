<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Melengkapi laboratorium agar sepadan dengan layar yang sudah disetujui.
 *
 * Dua yang kurang:
 *
 * 1. FASILITAS. Daftar pendek yang selalu dibaca bersama laboratoriumnya —
 *    fume hood, biosafety cabinet, emergency shower, APAR. Tidak pernah
 *    dikueri sendirian, jadi tabel penghubung untuknya hanya menambah
 *    sambungan tanpa menambah kemampuan.
 *
 * 2. TEKNISI. Ini justru sebaliknya, dan karena itu memakai tabel penghubung
 *    sungguhan: seorang teknisi melayani beberapa laboratorium sekaligus, dan
 *    pertanyaan "laboratorium mana saja yang ditangani orang ini" adalah
 *    pertanyaan yang benar-benar diajukan — saat menyusun jadwal, saat orang
 *    itu cuti, dan saat menentukan siapa yang menerima notifikasi jadwal
 *    perawatan. Menyimpannya sebagai daftar id di dalam jsonb membuat
 *    pertanyaan itu hanya bisa dijawab dengan memindai seluruh tabel, dan
 *    tidak ada yang menjaga id-nya tetap menunjuk pengguna yang masih ada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('laboratories', function (Blueprint $table) {
            $table->jsonb('fasilitas')->nullable()->after('akreditasi');
        });

        Schema::create('laboratory_technicians', function (Blueprint $table) {
            $table->id();
            $table->foreignId('laboratory_id')->constrained()->cascadeOnDelete();

            // cascadeOnDelete pada penggunanya: penugasan teknisi tidak punya
            // arti tanpa orangnya. Berbeda dari jejak audit, yang justru harus
            // bertahan setelah penggunanya hilang — di sini yang dicatat
            // adalah keadaan sekarang, bukan sejarah.
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->timestamps();

            // Satu orang tidak dapat ditugaskan dua kali ke laboratorium yang
            // sama. Tanpa ini, penugasan ganda menghasilkan notifikasi
            // berganda dan hitungan teknisi yang salah.
            $table->unique(['laboratory_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('laboratory_technicians');
        Schema::table('laboratories', fn (Blueprint $t) => $t->dropColumn('fasilitas'));
    }
};
