<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Melengkapi Penyewaan & Penagihan: tarif tunggal untuk tiga layar, quotation
 * sebagai penawaran resmi sebelum tagihan, dan status verifikasi pembayaran.
 *
 * TARIF DIPERLUAS MENJADI SATU TABEL UNTUK TIGA LAYAR PURWARUPA.
 *
 * Purwarupa yang disetujui punya tiga layar berbeda: "Daftar Tarif" (tarif
 * per fasilitas), "Tarif Add-on" (Sound System, Operator AV, dst — tidak
 * melekat pada satu fasilitas tertentu), dan "Paket Layanan" (satu harga
 * untuk gabungan fasilitas+layanan, dengan deskripsi dan kapasitas). Ketiganya
 * sama-sama "barang berharga yang dapat dijual" — bedanya hanya JENISNYA.
 * Kolom `jenis` ditambahkan alih-alih membuat tiga tabel terpisah, karena
 * ketiganya memakai field yang sama persis (nama, harga, satuan, status
 * aktif) dan kelak akan sama-sama dicari sebagai baris tagihan.
 *
 * QUOTATION ADALAH TAHAP BARU, BUKAN PERLUASAN INVOICE.
 *
 * Purwarupa memisahkan tegas "Quotation" (penawaran, dapat dinegosiasikan,
 * kedaluwarsa) dari "Invoice" (tagihan resmi, mengikat). Menyatukan
 * keduanya berarti kehilangan bedanya: quotation BOLEH berubah sebelum
 * disetujui, invoice TIDAK BOLEH berubah setelah terbit. `quotation_lines`
 * sengaja bercermin persis pada `invoice_lines` (baris tersalin, bukan
 * acuan tarif) — begitu quotation disetujui dan diterbitkan jadi invoice,
 * barisnya disalin apa adanya, sehingga kenaikan tarif setelah negosiasi
 * tidak diam-diam mengubah angka yang sudah disepakati.
 *
 * DISKON TIDAK DIMODELKAN SEBAGAI KOLOM TERPISAH.
 *
 * `invoice_lines` dan `quotation_lines` sama-sama menegakkan `harga_satuan
 * >= 0` — TIDAK ADA ANGKA UANG NEGATIF (lihat migrasi penagihan). Diskon yang
 * dinegosiasikan karenanya dituliskan langsung sebagai penyesuaian harga
 * satuan baris terkait, bukan baris "Diskon" bernilai minus. Ini menjaga
 * jumlah baris tetap sama dengan totalnya, tanpa pengecualian.
 *
 * PEMBAYARAN MENDAPAT STATUS VERIFIKASI.
 *
 * Purwarupa membedakan "Menunggu Verifikasi" dari "Terverifikasi" — staf
 * mencatat transfer yang dilaporkan klien, tetapi tagihan belum dianggap
 * lunas sampai stafnya sendiri memastikan uangnya benar masuk. Baku mutu
 * `terverifikasi` dipakai sebagai bawaan karena satu-satunya jalur pencatatan
 * pembayaran saat ini adalah staf mengetik langsung (bukan gerbang pembayaran
 * daring yang melapor sendiri) — status `menunggu_verifikasi` tersedia untuk
 * dipakai eksplisit saat staf memang belum yakin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tariffs', function (Blueprint $table) {
            $table->string('jenis', 10)->default('tarif')->after('nama');
            $table->text('deskripsi')->nullable()->after('segmen');
            $table->unsignedSmallInteger('kapasitas')->nullable()->after('deskripsi');
        });
        DB::statement("ALTER TABLE tariffs ADD CONSTRAINT tariffs_jenis_sah CHECK (jenis IN ('tarif','addon','paket'))");

        Schema::create('quotations', function (Blueprint $table) {
            $table->id();
            $table->string('nomor', 40)->unique();
            $table->foreignId('rental_id')->constrained()->restrictOnDelete();

            $table->date('tanggal');
            $table->date('berlaku_sampai');
            $table->unsignedSmallInteger('ppn_persen')->default(0);
            $table->string('status', 15)->default('terkirim');
            $table->text('catatan')->nullable();

            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
        });

        DB::statement("
            ALTER TABLE quotations ADD CONSTRAINT quotations_status_sah
            CHECK (status IN ('terkirim','negosiasi','disetujui','ditolak'))
        ");
        DB::statement('ALTER TABLE quotations ADD CONSTRAINT quotations_berlaku_wajar CHECK (berlaku_sampai >= tanggal)');
        DB::statement('ALTER TABLE quotations ADD CONSTRAINT quotations_ppn_wajar CHECK (ppn_persen BETWEEN 0 AND 100)');

        Schema::create('quotation_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();

            $table->string('deskripsi', 250);
            $table->unsignedInteger('kuantitas')->default(1);
            $table->string('satuan', 20)->default('paket');
            $table->bigInteger('harga_satuan');

            $table->timestamps();
        });

        DB::statement('ALTER TABLE quotation_lines ADD CONSTRAINT quotation_lines_harga_tidak_negatif CHECK (harga_satuan >= 0)');
        DB::statement('ALTER TABLE quotation_lines ADD CONSTRAINT quotation_lines_kuantitas_positif CHECK (kuantitas > 0)');
        DB::statement('
            ALTER TABLE quotation_lines
            ADD COLUMN subtotal bigint
            GENERATED ALWAYS AS (kuantitas::bigint * harga_satuan) STORED
        ');

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('quotation_id')->nullable()->after('rental_id')
                ->constrained()->nullOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->string('status', 20)->default('terverifikasi')->after('metode');
        });
        DB::statement("
            ALTER TABLE payments ADD CONSTRAINT payments_status_sah
            CHECK (status IN ('menunggu_verifikasi','terverifikasi'))
        ");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_sah');
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('status');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('quotation_id');
        });

        Schema::dropIfExists('quotation_lines');

        DB::statement('ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_sah');
        DB::statement('ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_berlaku_wajar');
        DB::statement('ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_ppn_wajar');
        Schema::dropIfExists('quotations');

        DB::statement('ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS tariffs_jenis_sah');
        Schema::table('tariffs', function (Blueprint $table) {
            $table->dropColumn(['jenis', 'deskripsi', 'kapasitas']);
        });
    }
};
