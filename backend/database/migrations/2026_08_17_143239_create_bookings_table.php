<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pemesanan ruangan.
 *
 * Bentrok jadwal dijaga di lapisan basis data, bukan hanya divalidasi aplikasi
 * (ADR-03). Alasannya: pemeriksaan "apakah masih kosong?" lalu "simpan" adalah
 * dua langkah terpisah, sehingga dua permintaan bersamaan dapat sama-sama
 * melihat slot kosong dan sama-sama menyimpan. Batasan eksklusi menutup celah
 * itu di titik penulisan.
 *
 * Kolom `periode` dibuat GENERATED agar tetap mustahil menyimpang dari
 * `mulai`/`selesai` yang dipakai Eloquent, dan agar tidak ada kode aplikasi
 * yang perlu mengetahui tipe rentang PostgreSQL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('keperluan');
            $table->unsignedInteger('jumlah_peserta')->default(0);
            $table->timestampTz('mulai');
            $table->timestampTz('selesai');
            $table->string('status')->default('menunggu');
            $table->text('catatan')->nullable();
            $table->timestamps();

            $table->index(['room_id', 'mulai']);
            $table->index(['user_id', 'mulai']);
            $table->index('status');
        });

        // Rentang setengah terbuka '[)': 08.00–12.00 dan 12.00–14.00 dianggap
        // TIDAK bentrok, sehingga pemakaian berurutan tetap diizinkan.
        DB::statement("
            ALTER TABLE bookings
            ADD COLUMN periode tstzrange
            GENERATED ALWAYS AS (tstzrange(mulai, selesai, '[)')) STORED
        ");

        DB::statement('ALTER TABLE bookings ADD CONSTRAINT bookings_selesai_after_mulai CHECK (selesai > mulai)');

        // Anti-bentrok. Idealnya ini satu batasan eksklusi:
        //
        //     EXCLUDE USING gist (room_id WITH =, periode WITH &&)
        //
        // tetapi bentuk itu menuntut ekstensi btree_gist, dan server tujuan
        // tidak memasang satu pun ekstensi contrib PostgreSQL — hanya plpgsql
        // yang tersedia. Karena itu jaminannya diwujudkan sebagai pemicu.
        //
        // Kunci penasihat diambil LEBIH DULU, dan itu bukan hiasan: tanpa
        // kunci, dua transaksi dapat sama-sama memeriksa slot yang sama
        // sebelum salah satunya menulis. Kunci berlaku sampai transaksi
        // selesai, sehingga pemeriksaan untuk satu ruangan berurutan.
        //
        // Yang tetap dipertahankan dari bentuk aslinya: aturannya hidup DI
        // DALAM basis data, sehingga berlaku untuk semua jalur tulis —
        // termasuk impor massal dan perbaikan manual lewat psql.
        DB::statement("
            CREATE OR REPLACE FUNCTION bookings_tolak_bentrok()
            RETURNS trigger AS \$\$
            BEGIN
                IF NEW.status IN ('dibatalkan', 'ditolak') THEN
                    RETURN NEW;
                END IF;

                PERFORM pg_advisory_xact_lock(hashtext('flms:booking_room'), NEW.room_id::int);

                IF EXISTS (
                    SELECT 1 FROM bookings b
                    WHERE b.room_id = NEW.room_id
                      AND b.id IS DISTINCT FROM NEW.id
                      AND b.status NOT IN ('dibatalkan', 'ditolak')
                      AND b.mulai  < NEW.selesai
                      AND b.selesai > NEW.mulai
                ) THEN
                    -- Kode galat dan penyebutan nama disamakan dengan batasan
                    -- eksklusi aslinya, supaya BookingService tetap mengenali
                    -- bentrok tanpa perlu tahu mekanisme mana yang dipakai.
                    RAISE EXCEPTION
                        'bookings_no_overlap: ruangan sudah dipakai pada rentang waktu tersebut'
                        USING ERRCODE = '23P01';
                END IF;

                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql;
        ");

        DB::statement('
            CREATE TRIGGER bookings_no_overlap
            BEFORE INSERT OR UPDATE ON bookings
            FOR EACH ROW
            EXECUTE FUNCTION bookings_tolak_bentrok();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
