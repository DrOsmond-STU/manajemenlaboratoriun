<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Jejak audit.
 *
 * SIFAT YANG MEMBUATNYA BERARTI: HANYA BISA DITAMBAH.
 *
 * Jejak audit yang dapat disunting bukan jejak audit. Bila barisnya dapat
 * diubah atau dihapus, satu-satunya orang yang benar-benar dirugikan
 * ketiadaannya adalah pemeriksa — sementara pihak yang ingin menutupi sesuatu
 * justru terbantu, karena catatan yang tampak lengkap lebih meyakinkan
 * daripada catatan yang jelas-jelas tidak ada.
 *
 * Karena itu UPDATE dan DELETE ditolak pemicu, bukan sekadar tidak
 * disediakan endpoint-nya. Aplikasi bisa berubah; pemicu berlaku juga untuk
 * perbaikan manual lewat psql, skrip impor, dan siapa pun yang punya
 * kredensial basis data.
 *
 * Konsekuensi yang harus diterima: baris yang salah tidak dapat diperbaiki,
 * hanya diikuti baris koreksi. Itu memang harga sebuah jejak audit.
 *
 * NILAI SENSITIF TIDAK PERNAH MASUK.
 *
 * Perubahan kata sandi tercatat sebagai peristiwa, tetapi nilainya —
 * lama maupun baru — tidak pernah disimpan. Jejak audit adalah tempat yang
 * paling banyak dibaca orang saat memeriksa, dan menaruh rahasia di sana
 * sama saja menyebarkannya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();

            // dibuat | diubah | dihapus | dipulihkan
            $table->string('peristiwa', 15);

            $table->string('model', 60);
            $table->unsignedBigInteger('model_id');
            $table->string('label', 200)->nullable();

            // SENGAJA TANPA KUNCI ASING.
            //
            // Tabel yang hanya bisa ditambah tidak dapat memiliki kunci asing
            // ke tabel yang barisnya bisa hilang: `ON DELETE SET NULL` adalah
            // UPDATE, `ON DELETE CASCADE` adalah DELETE, dan keduanya ditolak
            // pemicu di bawah. Yang terjadi bukan jejak audit rusak,
            // melainkan penghapusan penggunanya yang gagal selamanya —
            // kegagalan di tempat yang sama sekali tidak diduga.
            //
            // Integritas referensial pun bukan yang dicari di sini. Jejak
            // audit adalah catatan sejarah: yang harus dijamin justru
            // sebaliknya, bahwa ia tetap utuh setelah pengguna yang dicatat
            // tidak ada lagi. Arti barisnya dipikul `nama_pelaku`, yang
            // disalin saat peristiwa terjadi.
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('nama_pelaku', 150)->nullable();

            // Hanya kolom yang BERUBAH yang disimpan, bukan seluruh model.
            // Menyimpan semuanya membuat perubahan satu kolom tenggelam di
            // antara puluhan kolom yang tidak berubah — dan yang dicari
            // pemeriksa justru yang berubah.
            $table->jsonb('sebelum')->nullable();
            $table->jsonb('sesudah')->nullable();

            $table->string('ip', 45)->nullable();
            $table->string('rute', 200)->nullable();

            $table->timestampTz('created_at')->useCurrent();

            $table->index(['model', 'model_id']);
            $table->index('user_id');
            $table->index('created_at');
            $table->index('peristiwa');
        });

        DB::statement("
            ALTER TABLE audit_logs
            ADD CONSTRAINT audit_logs_peristiwa_sah
            CHECK (peristiwa IN ('dibuat', 'diubah', 'dihapus', 'dipulihkan'))
        ");

        // Hanya bisa ditambah.
        DB::statement("
            CREATE OR REPLACE FUNCTION audit_logs_tolak_ubah_hapus()
            RETURNS trigger AS \$\$
            BEGIN
                RAISE EXCEPTION
                    'audit_logs_hanya_tambah: jejak audit tidak dapat diubah atau dihapus'
                    USING ERRCODE = '42501';
            END;
            \$\$ LANGUAGE plpgsql;
        ");

        DB::statement('
            CREATE TRIGGER audit_logs_hanya_tambah
            BEFORE UPDATE OR DELETE ON audit_logs
            FOR EACH ROW
            EXECUTE FUNCTION audit_logs_tolak_ubah_hapus();
        ');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS audit_logs_hanya_tambah ON audit_logs');
        DB::statement('DROP FUNCTION IF EXISTS audit_logs_tolak_ubah_hapus()');
        Schema::dropIfExists('audit_logs');
    }
};
