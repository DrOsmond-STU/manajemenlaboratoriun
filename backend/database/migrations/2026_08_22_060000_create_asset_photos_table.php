<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Foto peralatan.
 *
 * BERKASNYA DI LUAR DOCROOT, DAN ITU BUKAN PILIHAN GAYA.
 *
 * Foto aset laboratorium memperlihatkan nomor seri, label BMN, dan tata letak
 * ruangan tempat alat mahal disimpan. Ditaruh di direktori publik, seluruhnya
 * dapat diambil siapa pun yang menebak nama berkasnya — dan nama berkas yang
 * berpola (misalnya nomor aset) membuat menebaknya sepele. Karena itu berkas
 * disimpan di disk privat dan hanya dilayani lewat rute yang memeriksa izin.
 *
 * Yang disimpan di sini hanyalah METADATA. Isi berkasnya tidak pernah masuk
 * basis data: gambar di dalam kolom membuat setiap pencadangan basis data
 * membengkak berlipat, padahal yang paling sering dipulihkan justru barisnya,
 * bukan gambarnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();

            // Jalur relatif terhadap disk privat. Tidak pernah dibentuk dari
            // nama berkas kiriman pengguna — lihat FotoAsetService.
            $table->string('jalur', 255);

            $table->string('nama_asli', 255)->nullable();
            $table->string('mime', 60);
            $table->unsignedInteger('ukuran');

            // Satu foto utama per aset, dipakai sebagai gambar pada kartu dan
            // daftar. Ditegakkan indeks unik parsial di bawah.
            $table->boolean('utama')->default(false);

            $table->unsignedSmallInteger('urutan')->default(0);
            $table->string('keterangan', 200)->nullable();

            $table->foreignId('diunggah_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['asset_id', 'urutan']);
        });

        DB::statement("
            ALTER TABLE asset_photos
            ADD CONSTRAINT asset_photos_mime_gambar
            CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp'))
        ");

        // Ukuran nol berarti berkasnya gagal tersalin tetapi barisnya telanjur
        // dibuat — keadaan yang menampilkan gambar rusak tanpa penjelasan.
        DB::statement('
            ALTER TABLE asset_photos
            ADD CONSTRAINT asset_photos_ukuran_wajar
            CHECK (ukuran > 0 AND ukuran <= 10485760)
        ');

        // Satu foto utama per aset. Parsial, karena yang perlu unik hanya
        // baris yang bertanda utama.
        DB::statement('
            CREATE UNIQUE INDEX asset_photos_satu_utama
            ON asset_photos (asset_id)
            WHERE utama
        ');

        // Jalur tidak boleh dipakai dua baris: dua baris menunjuk satu berkas
        // berarti menghapus salah satunya membuat yang lain menunjuk berkas
        // yang sudah tidak ada.
        DB::statement('CREATE UNIQUE INDEX asset_photos_jalur_unik ON asset_photos (jalur)');
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_photos');
    }
};
