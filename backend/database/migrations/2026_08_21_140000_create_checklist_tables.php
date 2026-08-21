<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Checklist: templat, butir, penugasan, pelaksanaan, dan jawaban.
 *
 * MENGAPA TIGA KUNCI ASING, BUKAN RELASI POLIMORFIK
 *
 * Checklist melekat pada ruangan, laboratorium, ATAU aset. Cara lazim
 * menuliskannya adalah relasi polimorfik — satu kolom tipe dan satu kolom id.
 * Cara itu tidak dipakai di sini, karena PostgreSQL tidak dapat memasang kunci
 * asing pada kolom polimorfik: id yang menunjuk baris terhapus akan diterima
 * tanpa keluhan, dan checklist menjadi yatim tanpa ada yang tahu.
 *
 * Sebagai gantinya, tiga kolom kunci asing yang boleh kosong, dengan batasan
 * bahwa TEPAT SATU di antaranya terisi. Integritas acuannya utuh, dan
 * "melekat pada dua hal sekaligus" maupun "tidak melekat pada apa pun"
 * sama-sama mustahil.
 *
 * Harganya: menambah jenis sumber daya baru berarti menambah kolom. Dengan
 * tiga jenis yang sudah pasti, harga itu jauh lebih murah daripada kehilangan
 * integritas acuan.
 */
return new class extends Migration
{
    public function up(): void
    {
        // --- Templat ---------------------------------------------------
        Schema::create('checklist_templates', function (Blueprint $table) {
            $table->id();
            $table->string('nama', 150);

            // pengecekan | perawatan | penyewaan | kebersihan | kerapian | kelayakan
            $table->string('jenis', 20);

            $table->text('deskripsi')->nullable();
            $table->boolean('aktif')->default(true);

            // Templat dibuat dan dikelola pengguna, bukan tertanam di kode.
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index('jenis');
            $table->index('aktif');
        });

        DB::statement("
            ALTER TABLE checklist_templates
            ADD CONSTRAINT checklist_templates_jenis_sah
            CHECK (jenis IN ('pengecekan', 'perawatan', 'penyewaan', 'kebersihan', 'kerapian', 'kelayakan'))
        ");

        // --- Butir ------------------------------------------------------
        Schema::create('checklist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('checklist_template_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('urutan')->default(1);
            $table->string('teks', 300);

            // ya_tidak | angka | teks | pilihan
            $table->string('tipe', 12)->default('ya_tidak');

            $table->boolean('wajib')->default(true);
            $table->json('pilihan')->nullable();
            $table->string('satuan', 20)->nullable();
            $table->text('petunjuk')->nullable();

            $table->timestamps();

            $table->index(['checklist_template_id', 'urutan']);
        });

        DB::statement("
            ALTER TABLE checklist_items
            ADD CONSTRAINT checklist_items_tipe_sah
            CHECK (tipe IN ('ya_tidak', 'angka', 'teks', 'pilihan'))
        ");

        // --- Penugasan: templat × sumber daya × penanggung jawab ---------
        Schema::create('checklist_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('checklist_template_id')->constrained()->cascadeOnDelete();

            $table->foreignId('room_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('laboratory_id')->nullable()->constrained('laboratories')->cascadeOnDelete();
            $table->foreignId('asset_id')->nullable()->constrained()->cascadeOnDelete();

            // Checklist melekat pada user — inilah yang membuat seseorang tahu
            // apa yang harus dikerjakannya hari ini.
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // harian | mingguan | bulanan | triwulanan | tahunan | insidental
            $table->string('periode', 15)->default('bulanan');
            $table->boolean('aktif')->default(true);

            $table->timestamps();

            $table->index('user_id');
            $table->index('aktif');
        });

        DB::statement('
            ALTER TABLE checklist_assignments
            ADD CONSTRAINT checklist_assignments_tepat_satu_sumber_daya
            CHECK (num_nonnulls(room_id, laboratory_id, asset_id) = 1)
        ');

        DB::statement("
            ALTER TABLE checklist_assignments
            ADD CONSTRAINT checklist_assignments_periode_sah
            CHECK (periode IN ('harian', 'mingguan', 'bulanan', 'triwulanan', 'tahunan', 'insidental'))
        ");

        // Satu templat tidak perlu ditugaskan dua kali kepada orang yang sama
        // untuk sumber daya yang sama.
        DB::statement('
            CREATE UNIQUE INDEX checklist_assignments_unik
            ON checklist_assignments (
                checklist_template_id, user_id,
                COALESCE(room_id, 0), COALESCE(laboratory_id, 0), COALESCE(asset_id, 0)
            )
        ');

        // --- Pelaksanaan -------------------------------------------------
        Schema::create('checklist_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('checklist_template_id')->constrained()->restrictOnDelete();

            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('laboratory_id')->nullable()->constrained('laboratories')->nullOnDelete();
            $table->foreignId('asset_id')->nullable()->constrained()->nullOnDelete();

            $table->foreignId('user_id')->constrained()->restrictOnDelete();

            $table->string('status', 15)->default('berjalan');
            $table->timestampTz('dimulai_pada')->nullable();
            $table->timestampTz('selesai_pada')->nullable();

            // Ringkasan hasil, dihitung saat penyelesaian.
            $table->unsignedSmallInteger('butir_total')->default(0);
            $table->unsignedSmallInteger('butir_lulus')->default(0);
            $table->unsignedSmallInteger('skor')->nullable();

            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index(['checklist_template_id', 'status']);
            $table->index(['user_id', 'status']);
            $table->index('selesai_pada');
        });

        DB::statement("
            ALTER TABLE checklist_runs
            ADD CONSTRAINT checklist_runs_status_sah
            CHECK (status IN ('berjalan', 'selesai', 'dibatalkan'))
        ");

        DB::statement('
            ALTER TABLE checklist_runs
            ADD CONSTRAINT checklist_runs_tepat_satu_sumber_daya
            CHECK (num_nonnulls(room_id, laboratory_id, asset_id) = 1)
        ');

        DB::statement("
            ALTER TABLE checklist_runs
            ADD CONSTRAINT checklist_runs_selesai_bertanggal
            CHECK (status <> 'selesai' OR selesai_pada IS NOT NULL)
        ");

        // --- Jawaban -------------------------------------------------------
        Schema::create('checklist_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('checklist_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('checklist_item_id')->constrained()->restrictOnDelete();

            $table->string('nilai', 300)->nullable();
            $table->boolean('lulus')->nullable();
            $table->text('catatan')->nullable();

            $table->timestamps();

            // Satu butir hanya dijawab sekali dalam satu pelaksanaan.
            $table->unique(['checklist_run_id', 'checklist_item_id'], 'checklist_answers_unik');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_answers');
        Schema::dropIfExists('checklist_runs');
        Schema::dropIfExists('checklist_assignments');
        Schema::dropIfExists('checklist_items');
        Schema::dropIfExists('checklist_templates');
    }
};
