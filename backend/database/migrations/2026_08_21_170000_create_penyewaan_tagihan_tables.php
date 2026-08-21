<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Penyewaan dan penagihan.
 *
 * TIGA ATURAN UANG YANG DIJAGA BASIS DATA
 *
 * 1. BARIS TAGIHAN ADALAH CUPLIKAN, BUKAN ACUAN.
 *    Tagihan yang sudah terbit tidak boleh berubah nilainya hanya karena
 *    tarifnya dinaikkan bulan depan. Karena itu baris tagihan menyimpan
 *    deskripsi dan harganya sendiri, disalin saat penerbitan — bukan menunjuk
 *    baris tarif yang dapat berubah kapan saja.
 *
 * 2. PEMBAYARAN TIDAK BOLEH MELEBIHI TAGIHAN.
 *    Kelebihan bayar bukan sekadar angka janggal: ia menghasilkan kewajiban
 *    mengembalikan uang yang tidak tercatat di mana pun. Dijaga pemicu, karena
 *    aturannya melibatkan penjumlahan lintas baris dan tidak dapat ditulis
 *    sebagai CHECK.
 *
 * 3. TIDAK ADA ANGKA UANG NEGATIF.
 *    Koreksi dilakukan lewat baris pembatalan yang tercatat, bukan dengan
 *    menuliskan angka minus yang menghilangkan jejaknya.
 *
 * Seluruh nilai uang disimpan sebagai bilangan bulat rupiah penuh. Pecahan
 * biner pada angka uang menghasilkan selisih satu rupiah yang mustahil
 * dijelaskan kepada bagian keuangan.
 */
return new class extends Migration
{
    public function up(): void
    {
        // --- Tarif ------------------------------------------------------
        Schema::create('tariffs', function (Blueprint $table) {
            $table->id();
            $table->string('nama', 150);

            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('laboratory_id')->nullable()->constrained('laboratories')->nullOnDelete();
            $table->foreignId('asset_id')->nullable()->constrained()->nullOnDelete();

            // jam | hari | paket
            $table->string('satuan_waktu', 10)->default('jam');
            $table->bigInteger('harga');

            // Tarif berbeda untuk internal dan pihak luar adalah hal lazim.
            $table->string('segmen', 15)->default('umum');

            $table->boolean('aktif')->default(true);
            $table->timestamps();

            $table->index(['aktif', 'segmen']);
        });

        DB::statement("ALTER TABLE tariffs ADD CONSTRAINT tariffs_satuan_sah CHECK (satuan_waktu IN ('jam','hari','paket'))");
        DB::statement("ALTER TABLE tariffs ADD CONSTRAINT tariffs_segmen_sah CHECK (segmen IN ('internal','umum','pemerintah'))");
        DB::statement('ALTER TABLE tariffs ADD CONSTRAINT tariffs_harga_tidak_negatif CHECK (harga >= 0)');

        // --- Penyewaan ---------------------------------------------------
        Schema::create('rentals', function (Blueprint $table) {
            $table->id();
            $table->string('penyewa', 150);
            $table->string('instansi', 150)->nullable();
            $table->string('kontak', 100)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('npwp', 30)->nullable();

            $table->foreignId('room_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('laboratory_id')->nullable()->constrained('laboratories')->nullOnDelete();

            $table->timestampTz('mulai');
            $table->timestampTz('selesai');

            $table->string('segmen', 15)->default('umum');
            $table->string('status', 15)->default('draf');
            $table->text('keperluan')->nullable();

            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
            $table->index(['mulai', 'selesai']);
        });

        DB::statement("
            ALTER TABLE rentals ADD CONSTRAINT rentals_status_sah
            CHECK (status IN ('draf','dikonfirmasi','berjalan','selesai','dibatalkan'))
        ");
        DB::statement('ALTER TABLE rentals ADD CONSTRAINT rentals_selesai_after_mulai CHECK (selesai > mulai)');

        // --- Tagihan ------------------------------------------------------
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rental_id')->constrained()->restrictOnDelete();

            $table->string('nomor', 40)->unique();
            $table->date('tanggal');
            $table->date('jatuh_tempo');

            // Persen PPN disimpan pada tagihannya, bukan diambil dari
            // konfigurasi saat menampilkan: tarif pajak berubah, dan tagihan
            // lama harus tetap menunjukkan angka yang dulu ditagihkan.
            $table->unsignedSmallInteger('ppn_persen')->default(0);

            $table->string('status', 15)->default('terbit');
            $table->text('catatan')->nullable();

            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
            $table->index('jatuh_tempo');
        });

        DB::statement("
            ALTER TABLE invoices ADD CONSTRAINT invoices_status_sah
            CHECK (status IN ('terbit','lunas','sebagian','dibatalkan'))
        ");
        DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_jatuh_tempo_wajar CHECK (jatuh_tempo >= tanggal)');
        DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_ppn_wajar CHECK (ppn_persen BETWEEN 0 AND 100)');

        // --- Baris tagihan (cuplikan) ----------------------------------------
        Schema::create('invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();

            $table->string('deskripsi', 250);
            $table->unsignedInteger('kuantitas')->default(1);
            $table->string('satuan', 20)->default('paket');
            $table->bigInteger('harga_satuan');

            $table->timestamps();
        });

        DB::statement('ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_harga_tidak_negatif CHECK (harga_satuan >= 0)');
        DB::statement('ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_kuantitas_positif CHECK (kuantitas > 0)');

        // Subtotal dihitung basis data agar mustahil menyimpang dari
        // kuantitas dan harga satuannya.
        DB::statement('
            ALTER TABLE invoice_lines
            ADD COLUMN subtotal bigint
            GENERATED ALWAYS AS (kuantitas::bigint * harga_satuan) STORED
        ');

        // --- Pembayaran ---------------------------------------------------------
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->restrictOnDelete();

            $table->date('tanggal');
            $table->bigInteger('jumlah');
            $table->string('metode', 20)->default('transfer');
            $table->string('referensi', 100)->nullable();
            $table->text('catatan')->nullable();

            $table->foreignId('dicatat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['invoice_id', 'tanggal']);
        });

        DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_jumlah_positif CHECK (jumlah > 0)');
        DB::statement("
            ALTER TABLE payments ADD CONSTRAINT payments_metode_sah
            CHECK (metode IN ('transfer','tunai','kartu','lainnya'))
        ");

        // Pembayaran tidak boleh melebihi nilai tagihan.
        //
        // Melibatkan penjumlahan lintas baris, sehingga tidak dapat ditulis
        // sebagai CHECK — harus pemicu. Kunci penasihat per tagihan mencegah
        // dua pembayaran bersamaan sama-sama lolos pemeriksaan, persis pola
        // yang sama dengan anti-bentrok jadwal.
        DB::statement("
            CREATE OR REPLACE FUNCTION payments_tolak_kelebihan()
            RETURNS trigger AS \$\$
            DECLARE
                nilai_tagihan bigint;
                sudah_dibayar bigint;
            BEGIN
                PERFORM pg_advisory_xact_lock(hashtext('flms:invoice'), NEW.invoice_id::int);

                SELECT COALESCE(SUM(l.subtotal), 0)
                     * (100 + COALESCE(i.ppn_persen, 0)) / 100
                INTO nilai_tagihan
                FROM invoices i
                LEFT JOIN invoice_lines l ON l.invoice_id = i.id
                WHERE i.id = NEW.invoice_id
                GROUP BY i.ppn_persen;

                SELECT COALESCE(SUM(jumlah), 0) INTO sudah_dibayar
                FROM payments
                WHERE invoice_id = NEW.invoice_id
                  AND id IS DISTINCT FROM NEW.id;

                IF sudah_dibayar + NEW.jumlah > COALESCE(nilai_tagihan, 0) THEN
                    RAISE EXCEPTION
                        'payments_melebihi_tagihan: pembayaran % melebihi sisa tagihan %',
                        NEW.jumlah, COALESCE(nilai_tagihan, 0) - sudah_dibayar
                        USING ERRCODE = '23514';
                END IF;

                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql;
        ");

        DB::statement('
            CREATE TRIGGER payments_tidak_melebihi_tagihan
            BEFORE INSERT OR UPDATE ON payments
            FOR EACH ROW
            EXECUTE FUNCTION payments_tolak_kelebihan();
        ');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS payments_tidak_melebihi_tagihan ON payments');
        DB::statement('DROP FUNCTION IF EXISTS payments_tolak_kelebihan()');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('rentals');
        Schema::dropIfExists('tariffs');
    }
};
