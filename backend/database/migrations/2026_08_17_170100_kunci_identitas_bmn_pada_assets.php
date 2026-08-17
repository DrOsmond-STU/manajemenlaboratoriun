<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Identitas BMN tidak boleh berubah setelah aset terdaftar.
 *
 * Begitu sebuah aset didaftarkan, identitasnya langsung beredar keluar sistem:
 * tercetak pada label yang ditempel di badan alat, tercatat pada Daftar Barang
 * Ruangan, dan masuk ke laporan yang direkonsiliasi dengan SIMAK-BMN. Mengubah
 * `kode_barang` atau `nup` setelah itu berarti label yang menempel di alat
 * menunjuk barang yang tidak ada lagi — dan tidak ada galat apa pun yang
 * muncul untuk memberi tahu.
 *
 * Aturannya dijaga pemicu basis data, bukan hanya lewat FormRequest, karena
 * jalur tulis tidak hanya satu: ada impor massal, perintah artisan, dan
 * perbaikan manual lewat psql. Semuanya melewati titik ini.
 *
 * Bila memang perlu mengoreksi kode barang yang salah pilih, caranya adalah
 * menghapus aset lalu mendaftarkannya kembali — sehingga NUP lama tetap
 * terpakai dan tidak dipakai ulang oleh barang lain.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE OR REPLACE FUNCTION assets_tolak_ubah_identitas_bmn()
            RETURNS trigger AS $$
            BEGIN
                IF NEW.kode_lokasi IS DISTINCT FROM OLD.kode_lokasi
                   OR NEW.kode_barang IS DISTINCT FROM OLD.kode_barang
                   OR NEW.nup IS DISTINCT FROM OLD.nup THEN
                    RAISE EXCEPTION
                        'Identitas BMN tidak boleh diubah setelah aset terdaftar (aset %)', OLD.id
                        USING ERRCODE = '23514';
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        ");

        DB::statement('
            CREATE TRIGGER assets_identitas_bmn_tetap
            BEFORE UPDATE ON assets
            FOR EACH ROW
            EXECUTE FUNCTION assets_tolak_ubah_identitas_bmn();
        ');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS assets_identitas_bmn_tetap ON assets');
        DB::statement('DROP FUNCTION IF EXISTS assets_tolak_ubah_identitas_bmn()');
    }
};
