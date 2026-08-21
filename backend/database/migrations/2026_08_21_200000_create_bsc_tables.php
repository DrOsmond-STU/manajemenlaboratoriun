<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Balanced Scorecard.
 *
 * Dua kesalahan menghancurkan hampir setiap BSC yang dikerjakan di lembar
 * sebar, dan keduanya ditutup di sini oleh basis data:
 *
 * 1. BOBOT YANG TIDAK LAGI BERJUMLAH 100.
 *    Seseorang menambah satu indikator, bobot perspektifnya menjadi 115, dan
 *    skor gabungannya menggelembung tanpa ada yang menyadarinya. Tidak ada
 *    galat, tidak ada tanda apa pun — angkanya hanya menjadi salah, dan
 *    keputusan diambil di atasnya sepanjang tahun.
 *
 *    Ditutup pemicu batasan DEFERRABLE INITIALLY DEFERRED: pemeriksaannya
 *    terjadi saat COMMIT, bukan per baris. Satu perspektif karena itu dapat
 *    disusun ulang utuh dalam satu transaksi — indikator dihapus, ditambah,
 *    bobotnya diatur ulang — dan yang dituntut hanyalah bahwa pada akhirnya
 *    berjumlah 100. Batasan per baris biasa mustahil melakukannya: menghapus
 *    satu indikator saja akan langsung melanggar.
 *
 *    Ini kemampuan PostgreSQL yang tidak dimiliki MariaDB, dan salah satu
 *    alasan pemilihannya (lihat §3).
 *
 * 2. ARAH INDIKATOR YANG DIABAIKAN.
 *    "Jumlah keluhan pelanggan" membaik ketika TURUN. Rumus capaian yang
 *    selalu realisasi/target akan menilai penurunan keluhan sebagai kegagalan
 *    dan kenaikan keluhan sebagai prestasi. Karena itu `polaritas` wajib,
 *    tanpa nilai bawaan yang diam-diam benar untuk sebagian kasus saja.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bsc_indikator', function (Blueprint $table) {
            $table->id();

            $table->string('perspektif', 20);

            // '2026' atau '2026-Q1'.
            $table->string('periode', 7);

            $table->string('nama', 200);
            $table->string('satuan', 30)->nullable();

            // Wajib diisi. Tidak ada nilai bawaan justru karena bawaan apa pun
            // akan benar untuk sebagian indikator dan diam-diam salah untuk
            // sisanya.
            $table->string('polaritas', 12);

            $table->decimal('target', 18, 4);
            $table->decimal('realisasi', 18, 4)->nullable();

            $table->decimal('bobot', 5, 2);

            $table->unsignedSmallInteger('urutan')->default(0);
            $table->text('catatan')->nullable();

            $table->timestamps();

            $table->index(['periode', 'perspektif']);
        });

        DB::statement("
            ALTER TABLE bsc_indikator
            ADD CONSTRAINT bsc_indikator_perspektif_sah
            CHECK (perspektif IN ('keuangan', 'pelanggan', 'proses-internal', 'pembelajaran'))
        ");

        DB::statement("
            ALTER TABLE bsc_indikator
            ADD CONSTRAINT bsc_indikator_polaritas_sah
            CHECK (polaritas IN ('naik-baik', 'turun-baik'))
        ");

        DB::statement("
            ALTER TABLE bsc_indikator
            ADD CONSTRAINT bsc_indikator_periode_sah
            CHECK (periode ~ '^[0-9]{4}(-Q[1-4])?$')
        ");

        DB::statement('
            ALTER TABLE bsc_indikator
            ADD CONSTRAINT bsc_indikator_bobot_sah
            CHECK (bobot > 0 AND bobot <= 100)
        ');

        // Target nol membuat capaian tidak terdefinisi pada indikator
        // turun-baik (pembagian dengan nol) dan tidak bermakna pada
        // naik-baik. Ditolak di sini supaya tidak muncul sebagai galat
        // aritmetika jauh kemudian, saat laporan dicetak.
        DB::statement('
            ALTER TABLE bsc_indikator
            ADD CONSTRAINT bsc_indikator_target_tidak_nol
            CHECK (target <> 0)
        ');

        DB::statement('
            CREATE UNIQUE INDEX bsc_indikator_nama_unik
            ON bsc_indikator (periode, perspektif, lower(nama))
        ');

        // --- Bobot per perspektif harus berjumlah 100 -----------------------
        DB::statement("
            CREATE OR REPLACE FUNCTION bsc_periksa_bobot()
            RETURNS trigger AS \$\$
            DECLARE
                sasaran RECORD;
                jumlah numeric;
            BEGIN
                -- Baris lama DAN baru sama-sama diperiksa: memindahkan
                -- indikator antarperspektif merusak keseimbangan di kedua
                -- sisi, dan hanya memeriksa sisi tujuan akan melewatkan
                -- perspektif asal yang kini kurang dari 100.
                FOR sasaran IN
                    SELECT DISTINCT periode, perspektif FROM (
                        SELECT NEW.periode AS periode, NEW.perspektif AS perspektif
                        WHERE TG_OP <> 'DELETE'
                        UNION ALL
                        SELECT OLD.periode, OLD.perspektif
                        WHERE TG_OP <> 'INSERT'
                    ) s
                LOOP
                    SELECT COALESCE(SUM(bobot), 0) INTO jumlah
                    FROM bsc_indikator
                    WHERE periode = sasaran.periode AND perspektif = sasaran.perspektif;

                    -- Perspektif yang dikosongkan seluruhnya sah: sebuah
                    -- scorecard boleh saja belum menggarap satu perspektif.
                    -- Yang tidak boleh adalah terisi sebagian lalu dianggap
                    -- utuh saat skornya dihitung.
                    IF jumlah <> 0 AND jumlah <> 100 THEN
                        RAISE EXCEPTION
                            'bsc_bobot_tidak_seimbang: bobot perspektif % periode % berjumlah %, seharusnya 100',
                            sasaran.perspektif, sasaran.periode, jumlah
                            USING ERRCODE = '23514';
                    END IF;
                END LOOP;

                RETURN NULL;
            END;
            \$\$ LANGUAGE plpgsql;
        ");

        DB::statement('
            CREATE CONSTRAINT TRIGGER bsc_bobot_seimbang
            AFTER INSERT OR UPDATE OR DELETE ON bsc_indikator
            DEFERRABLE INITIALLY DEFERRED
            FOR EACH ROW
            EXECUTE FUNCTION bsc_periksa_bobot();
        ');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS bsc_bobot_seimbang ON bsc_indikator');
        DB::statement('DROP FUNCTION IF EXISTS bsc_periksa_bobot()');
        Schema::dropIfExists('bsc_indikator');
    }
};
