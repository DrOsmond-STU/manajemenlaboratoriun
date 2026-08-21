<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Peminjaman alat.
 *
 * Modul jadwal kedua. Aturan intinya sama dengan pemesanan ruangan — satu
 * benda tidak boleh dipakai dua pihak pada waktu yang bersamaan — sehingga
 * mekanismenya pun sengaja dibuat sama persis, hanya berganti kunci: aset,
 * bukan ruangan.
 *
 * Kesamaan itu disengaja. Dua modul dengan aturan sama tetapi mekanisme
 * berbeda berarti salah satunya cepat atau lambat akan tertinggal saat yang
 * lain diperbaiki.
 *
 * Yang BERBEDA dari pemesanan ruangan, dan itu penting: alat punya kondisi.
 * Alat rusak berat tidak boleh dipinjamkan sama sekali — dijaga di lapisan
 * aplikasi karena kondisinya dapat berubah setelah peminjaman dibuat, dan
 * batasan basis data tidak dapat menilai keadaan pada saat pengambilan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('equipment_loans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();

            $table->string('keperluan');
            $table->string('unit_kerja')->nullable();
            $table->string('lokasi_pemakaian')->nullable();

            $table->timestampTz('mulai');
            $table->timestampTz('selesai');

            // Waktu nyata serah terima, terpisah dari jadwalnya. Alat sering
            // diambil terlambat atau dikembalikan lebih awal, dan selisih itu
            // justru yang dicari saat menelusuri keterlambatan.
            $table->timestampTz('diambil_pada')->nullable();
            $table->timestampTz('dikembalikan_pada')->nullable();

            $table->string('status', 20)->default('menunggu');
            $table->char('kondisi_saat_kembali', 2)->nullable();
            $table->text('catatan')->nullable();

            $table->timestamps();

            $table->index(['asset_id', 'mulai']);
            $table->index(['user_id', 'mulai']);
            $table->index('status');
            $table->index('unit_kerja');
        });

        DB::statement("
            ALTER TABLE equipment_loans
            ADD CONSTRAINT equipment_loans_status_sah
            CHECK (status IN ('menunggu', 'disetujui', 'ditolak', 'dipinjam', 'dikembalikan', 'dibatalkan'))
        ");

        DB::statement('
            ALTER TABLE equipment_loans
            ADD CONSTRAINT equipment_loans_selesai_after_mulai
            CHECK (selesai > mulai)
        ');

        DB::statement("
            ALTER TABLE equipment_loans
            ADD CONSTRAINT equipment_loans_kondisi_kembali_sah
            CHECK (kondisi_saat_kembali IS NULL OR kondisi_saat_kembali IN ('B', 'RR', 'RB'))
        ");

        // Anti-bentrok, sepadan dengan pemicu pada tabel bookings.
        //
        // Status yang TIDAK memblokir: ditolak, dibatalkan, dan dikembalikan.
        // `dikembalikan` ikut dibebaskan karena alat yang sudah kembali lebih
        // awal seharusnya dapat langsung dipinjam orang lain — menahannya
        // sampai jadwal aslinya berakhir hanya membuat alat menganggur.
        DB::statement("
            CREATE OR REPLACE FUNCTION equipment_loans_tolak_bentrok()
            RETURNS trigger AS \$\$
            BEGIN
                IF NEW.status IN ('ditolak', 'dibatalkan', 'dikembalikan') THEN
                    RETURN NEW;
                END IF;

                PERFORM pg_advisory_xact_lock(hashtext('flms:loan_asset'), NEW.asset_id::int);

                IF EXISTS (
                    SELECT 1 FROM equipment_loans l
                    WHERE l.asset_id = NEW.asset_id
                      AND l.id IS DISTINCT FROM NEW.id
                      AND l.status NOT IN ('ditolak', 'dibatalkan', 'dikembalikan')
                      AND l.mulai   < NEW.selesai
                      AND l.selesai > NEW.mulai
                ) THEN
                    RAISE EXCEPTION
                        'equipment_loans_no_overlap: alat sudah dipinjam pada rentang waktu tersebut'
                        USING ERRCODE = '23P01';
                END IF;

                RETURN NEW;
            END;
            \$\$ LANGUAGE plpgsql;
        ");

        DB::statement('
            CREATE TRIGGER equipment_loans_no_overlap
            BEFORE INSERT OR UPDATE ON equipment_loans
            FOR EACH ROW
            EXECUTE FUNCTION equipment_loans_tolak_bentrok();
        ');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS equipment_loans_no_overlap ON equipment_loans');
        DB::statement('DROP FUNCTION IF EXISTS equipment_loans_tolak_bentrok()');
        Schema::dropIfExists('equipment_loans');
    }
};
