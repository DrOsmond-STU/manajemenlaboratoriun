<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pemeliharaan dan kalibrasi alat.
 *
 * SATU TABEL UNTUK KEDUANYA — alasannya, bukan kemalasan.
 *
 * Pemeliharaan dan kalibrasi menjawab pertanyaan yang sama bagi pengelola:
 * "kapan alat ini terakhir ditangani, dan kapan jatuh tempo berikutnya?"
 * Daftar jatuh tempo yang dilihat teknisi setiap pagi menggabungkan keduanya.
 * Dua tabel terpisah berarti setiap kueri semacam itu harus menyatukannya
 * kembali dengan UNION — dan cepat atau lambat ada satu tempat yang lupa,
 * sehingga sebagian jatuh tempo tidak muncul tanpa ada yang menyadarinya.
 *
 * Yang khas kalibrasi — nomor sertifikat, lembaga, masa berlaku — disimpan
 * sebagai kolom yang boleh kosong, dan diwajibkan di lapisan aplikasi hanya
 * ketika jenisnya kalibrasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_maintenances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();

            // preventif | korektif | kalibrasi
            $table->string('jenis', 20);

            $table->date('jadwal');
            $table->date('dikerjakan_pada')->nullable();

            $table->string('pelaksana')->nullable();
            $table->foreignId('petugas_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('status', 20)->default('dijadwalkan');
            $table->text('hasil')->nullable();
            $table->bigInteger('biaya')->nullable();

            // --- Khusus kalibrasi ---------------------------------------
            $table->string('no_sertifikat', 100)->nullable();
            $table->string('lembaga_kalibrasi', 150)->nullable();
            $table->date('berlaku_sampai')->nullable();

            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'jadwal']);
            $table->index(['jenis', 'status']);
            $table->index('jadwal');
            $table->index('berlaku_sampai');
        });

        DB::statement("
            ALTER TABLE asset_maintenances
            ADD CONSTRAINT asset_maintenances_jenis_sah
            CHECK (jenis IN ('preventif', 'korektif', 'kalibrasi'))
        ");

        DB::statement("
            ALTER TABLE asset_maintenances
            ADD CONSTRAINT asset_maintenances_status_sah
            CHECK (status IN ('dijadwalkan', 'berjalan', 'selesai', 'dibatalkan'))
        ");

        DB::statement('
            ALTER TABLE asset_maintenances
            ADD CONSTRAINT asset_maintenances_biaya_tidak_negatif
            CHECK (biaya IS NULL OR biaya >= 0)
        ');

        // Pekerjaan yang berstatus selesai wajib punya tanggal pengerjaan.
        // Tanpa ini, "selesai" tanpa tanggal akan lolos dan seluruh perhitungan
        // jatuh tempo berikutnya kehilangan titik acuannya.
        DB::statement("
            ALTER TABLE asset_maintenances
            ADD CONSTRAINT asset_maintenances_selesai_bertanggal
            CHECK (status <> 'selesai' OR dikerjakan_pada IS NOT NULL)
        ");

        Schema::table('assets', function (Blueprint $table) {
            // Tidak semua alat perlu kalibrasi. Meja dan lemari asam tidak.
            $table->boolean('wajib_kalibrasi')->default(false)->after('masa_manfaat');
            $table->index('wajib_kalibrasi');
        });
    }

    public function down(): void
    {
        Schema::table('assets', fn (Blueprint $t) => $t->dropColumn('wajib_kalibrasi'));
        Schema::dropIfExists('asset_maintenances');
    }
};
