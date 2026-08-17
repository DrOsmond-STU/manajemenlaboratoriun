<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Aset / peralatan laboratorium dan fasilitas.
 *
 * DUA PENOMORAN — keduanya wajib unik, dengan peran berbeda:
 *
 *   1. Identitas BMN (kunci utama menurut negara)
 *      <kode lokasi>.<kode barang>.<NUP>
 *      contoh: 024.05.0100.652431.000.3.08.01.03.001.00003
 *      Dibentuk basis data sebagai kolom GENERATED `bmn_id`, sehingga mustahil
 *      menyimpang dari ketiga unsur pembentuknya.
 *
 *   2. Kode internal (penomoran satuan kerja sendiri)
 *      polanya ditentukan pengguna, contoh: STU/KIM-01/KROM/2022/0012
 *      Bebas bentuk, tetapi tetap wajib unik agar dapat dipakai pada barcode
 *      dan pencarian harian.
 *
 * Yang dijaga basis data:
 *   - kombinasi (kode lokasi, kode barang, NUP) tidak boleh kembar — inilah
 *     identitas BMN, dan kekembaran di sini berarti dua barang berbeda
 *     mengaku sebagai barang yang sama di laporan SIMAK-BMN;
 *   - kode internal tidak boleh kembar;
 *   - nilai perolehan tidak boleh negatif;
 *   - kondisi hanya B / RR / RB.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();

            // --- Identitas BMN ---------------------------------------------
            $table->string('kode_lokasi', 32);
            $table->string('kode_barang', 16);
            $table->unsignedInteger('nup');

            // --- Penomoran internal ----------------------------------------
            $table->string('kode_internal', 64)->unique();

            // --- Identitas barang ------------------------------------------
            $table->string('nama');
            $table->string('merk')->nullable();
            $table->string('tipe')->nullable();
            $table->string('serial_number')->nullable();
            $table->text('spesifikasi')->nullable();

            // --- Perolehan --------------------------------------------------
            $table->string('cara_perolehan')->default('Pembelian');
            $table->date('tgl_perolehan');
            $table->string('sumber_dana')->nullable();
            $table->string('no_bukti')->nullable();
            $table->string('no_kontrak')->nullable();
            $table->unsignedInteger('kuantitas')->default(1);
            $table->string('satuan', 32)->default('Unit');

            // --- Nilai & penyusutan ------------------------------------------
            // bigInteger: nilai perolehan dalam rupiah penuh tanpa desimal.
            // Barang laboratorium dapat menembus miliaran, di luar jangkauan
            // integer 32-bit.
            $table->bigInteger('nilai_perolehan')->default(0);
            $table->unsignedSmallInteger('masa_manfaat')->default(0);

            // --- Status & penatausahaan (PMK 181/PMK.06/2016) ----------------
            $table->char('kondisi', 2)->default('B');
            $table->string('status_penggunaan')->default('Digunakan untuk Operasional Satker');
            $table->string('no_psp')->nullable();
            $table->date('tgl_psp')->nullable();
            $table->char('kib', 1)->nullable();

            // --- Penempatan --------------------------------------------------
            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('penanggung_jawab_id')->nullable()->constrained('users')->nullOnDelete();

            $table->text('keterangan')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('kode_barang')->references('kode')->on('bmn_kode_barang')->restrictOnDelete();

            $table->unique(['kode_lokasi', 'kode_barang', 'nup'], 'assets_identitas_bmn_unik');
            $table->index('kode_barang');
            $table->index('room_id');
            $table->index('kondisi');
        });

        // Identitas BMN dibentuk basis data agar tidak mungkin menyimpang dari
        // unsur pembentuknya. NUP diformat lima digit sesuai lazimnya dokumen
        // BMN (00003), bukan angka telanjang.
        DB::statement("
            ALTER TABLE assets
            ADD COLUMN bmn_id text
            GENERATED ALWAYS AS (
                kode_lokasi || '.' || kode_barang || '.' || lpad(nup::text, 5, '0')
            ) STORED
        ");

        DB::statement('CREATE UNIQUE INDEX assets_bmn_id_unik ON assets (bmn_id)');

        DB::statement("
            ALTER TABLE assets
            ADD CONSTRAINT assets_kondisi_sah
            CHECK (kondisi IN ('B', 'RR', 'RB'))
        ");

        DB::statement('
            ALTER TABLE assets
            ADD CONSTRAINT assets_nilai_tidak_negatif
            CHECK (nilai_perolehan >= 0)
        ');

        DB::statement('
            ALTER TABLE assets
            ADD CONSTRAINT assets_kuantitas_positif
            CHECK (kuantitas > 0)
        ');

        DB::statement('
            ALTER TABLE assets
            ADD CONSTRAINT assets_nup_positif
            CHECK (nup > 0)
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
