<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Master kode barang BMN (PMK 29/PMK.06/2010).
 *
 * Kode barang terdiri atas 10 digit berjenjang:
 *
 *     3 . 08 . 01 . 03 . 001
 *     │   │    │    │    └── Sub-Sub Kelompok (3 digit)
 *     │   │    │    └─────── Sub Kelompok     (2 digit)
 *     │   │    └──────────── Kelompok         (2 digit)
 *     │   └───────────────── Bidang           (2 digit)
 *     └───────────────────── Golongan         (1 digit)
 *
 * Golongan 1 Persediaan, 2 Tanah, 3 Peralatan dan Mesin, 4 Gedung dan
 * Bangunan, 5 Jalan/Irigasi/Jaringan, 6 Aset Tetap Lainnya, 7 Konstruksi
 * Dalam Pengerjaan, 8 Aset Tak Berwujud.
 *
 * Tabel ini adalah acuan, bukan data transaksi: isinya berasal dari referensi
 * resmi Kementerian Keuangan/SAKTI dan tidak boleh dikarang sendiri. Seeder
 * bawaan hanya memuat cuplikan contoh untuk pengembangan — lihat
 * BmnKodeBarangSeeder.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bmn_kode_barang', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 16)->unique();
            $table->string('uraian');

            // Disimpan terurai agar dapat ditapis per jenjang tanpa memotong
            // string di setiap kueri.
            $table->char('golongan', 1);
            $table->string('bidang', 4);
            $table->string('kelompok', 7);
            $table->string('sub_kelompok', 10);

            // Masa manfaat dalam tahun (PMK 65/PMK.06/2017). Nol berarti tidak
            // disusutkan — misalnya tanah.
            $table->unsignedSmallInteger('masa_manfaat')->default(0);

            // Kartu Identitas Barang: A Tanah, B Peralatan dan Mesin,
            // C Gedung dan Bangunan, D Jalan/Irigasi/Jaringan, E Aset Tetap Lainnya.
            $table->char('kib', 1)->nullable();

            $table->timestamps();

            $table->index('golongan');
            $table->index('bidang');
            $table->index('kelompok');
        });

        // Format kode dijaga basis data, bukan hanya validasi aplikasi: master
        // ini juga diisi lewat impor massal yang tidak melewati FormRequest.
        DB::statement("
            ALTER TABLE bmn_kode_barang
            ADD CONSTRAINT bmn_kode_barang_format
            CHECK (kode ~ '^[1-8]\\.[0-9]{2}\\.[0-9]{2}\\.[0-9]{2}\\.[0-9]{3}$')
        ");

        // Jenjang wajib konsisten dengan kodenya sendiri, sehingga tapis per
        // bidang/kelompok tidak mungkin menyimpang dari kode barangnya.
        DB::statement('
            ALTER TABLE bmn_kode_barang
            ADD CONSTRAINT bmn_kode_barang_jenjang_konsisten
            CHECK (
                golongan     = substring(kode from 1 for 1)
                AND bidang       = substring(kode from 1 for 4)
                AND kelompok     = substring(kode from 1 for 7)
                AND sub_kelompok = substring(kode from 1 for 10)
            )
        ');

        DB::statement('
            ALTER TABLE bmn_kode_barang
            ADD CONSTRAINT bmn_kode_barang_masa_manfaat_wajar
            CHECK (masa_manfaat BETWEEN 0 AND 100)
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('bmn_kode_barang');
    }
};
