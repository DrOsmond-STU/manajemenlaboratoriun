<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Kode ruangan unik hanya di antara ruangan yang masih aktif.
 *
 * Indeks unik semula ikut menghitung baris yang sudah dihapus lunak, sehingga
 * kode ruangan yang pernah dipakai terkunci selamanya. Aturan aplikasi
 * mengatakan sebaliknya (`Rule::unique(...)->withoutTrashed()`), dan selisih
 * itu muncul sebagai galat basis data mentah — validasi meloloskan, lalu
 * penyimpanannya gagal.
 *
 * Yang dipilih adalah aturan aplikasinya, bukan sebaliknya. Kode ruangan
 * adalah label internal: ruangan direnovasi, digabung, dan berganti fungsi,
 * sehingga kode lama wajar dipakai kembali. Ini BERBEDA dari NUP pada aset
 * BMN, yang justru sengaja tidak boleh dipakai ulang karena nomornya sudah
 * beredar di luar sistem — pada label yang menempel di badan alat dan pada
 * dokumen negara.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_kode_unique');
        DB::statement('DROP INDEX IF EXISTS rooms_kode_unique');

        DB::statement('
            CREATE UNIQUE INDEX rooms_kode_unik_aktif
            ON rooms (kode)
            WHERE deleted_at IS NULL
        ');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS rooms_kode_unik_aktif');
        DB::statement('ALTER TABLE rooms ADD CONSTRAINT rooms_kode_unique UNIQUE (kode)');
    }
};
