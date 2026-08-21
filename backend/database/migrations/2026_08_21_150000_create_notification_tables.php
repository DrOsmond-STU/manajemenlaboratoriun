<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Notifikasi jadwal ke surel penanggung jawab.
 *
 * SIFAT YANG PALING MENENTUKAN: TIDAK MENGIRIM DUA KALI.
 *
 * Penjadwal berjalan tiap beberapa menit. Tanpa penjagaan, pengingat yang
 * sama akan terkirim berulang sepanjang hari — dan orang yang menerima
 * belasan surel identik akan berhenti membacanya sama sekali, termasuk yang
 * penting. Pengingat yang tidak terkirim buruk; pengingat yang terkirim
 * belasan kali lebih buruk, karena merusak seluruh kanalnya.
 *
 * Penjagaannya indeks unik pada (penerima, jenis, sumber, tanggal acuan) —
 * bukan pemeriksaan di aplikasi. Dua proses penjadwal yang kebetulan berjalan
 * bersamaan tetap tidak dapat menembusnya.
 */
return new class extends Migration
{
    public function up(): void
    {
        // --- Preferensi per pengguna ------------------------------------
        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // booking | peminjaman | pemeliharaan | kalibrasi | checklist
            $table->string('kategori', 20);

            $table->boolean('email_aktif')->default(true);

            // Berapa hari sebelum jadwal pengingat dikirim. 0 berarti hanya
            // pada hari-H.
            $table->unsignedSmallInteger('ingatkan_h_min')->default(1);

            $table->timestamps();

            $table->unique(['user_id', 'kategori']);
        });

        DB::statement("
            ALTER TABLE notification_preferences
            ADD CONSTRAINT notification_preferences_kategori_sah
            CHECK (kategori IN ('booking', 'peminjaman', 'pemeliharaan', 'kalibrasi', 'checklist'))
        ");

        // --- Catatan pengiriman ------------------------------------------
        Schema::create('notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('email');

            $table->string('kategori', 20);
            $table->string('sumber_tipe', 30);
            $table->unsignedBigInteger('sumber_id');

            // Tanggal jadwal yang diingatkan. Bagian dari kunci keunikan,
            // sehingga jadwal yang diundur menghasilkan pengingat baru — dan
            // itu memang yang diinginkan.
            $table->date('tanggal_acuan');

            $table->string('perihal', 200);
            $table->string('status', 15)->default('terkirim');
            $table->text('galat')->nullable();
            $table->timestampTz('dikirim_pada')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index('kategori');
        });

        DB::statement("
            ALTER TABLE notification_logs
            ADD CONSTRAINT notification_logs_status_sah
            CHECK (status IN ('terkirim', 'gagal'))
        ");

        // Inilah jaminannya. Satu pengingat, satu penerima, satu tanggal.
        DB::statement('
            CREATE UNIQUE INDEX notification_logs_sekali_saja
            ON notification_logs (user_id, kategori, sumber_tipe, sumber_id, tanggal_acuan)
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
        Schema::dropIfExists('notification_preferences');
    }
};
