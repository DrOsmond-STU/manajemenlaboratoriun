<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pemeliharaan melekat pada ruangan atau laboratorium juga, tidak hanya
 * alat — melengkapi `asset_maintenances` agar sepadan dengan layar yang
 * sudah disetujui.
 *
 * Purwarupa Maintenance & Work Order sudah menunjukkannya sejak awal: baris
 * kerjanya menyebut "Meeting Room Delta" dan "Laboratorium Komputasi & IoT"
 * sebagai target, bukan hanya nama alat. Backend yang dibangun sebelumnya
 * hanya mengenal `asset_id` — pola yang sama dengan checklist dipakai lagi
 * di sini: tiga kunci asing yang boleh kosong, dijaga `num_nonnulls(...) = 1`
 * di basis data, bukan relasi polimorfik. Lihat
 * `App\Models\Concerns\MelekatPadaSumberDaya` untuk alasan lengkapnya.
 *
 * KALIBRASI TETAP KHUSUS ALAT. Anda tidak mengkalibrasi sebuah ruangan.
 * Batasan CHECK terpisah menegakkannya: jenis kalibrasi wajib punya
 * `asset_id`, bukan salah satu dari ketiganya secara bebas.
 *
 * Nama tabel dan kelasnya (`AssetMaintenance`) SENGAJA TIDAK diubah
 * meski cakupannya melebihi aset. Mengganti nama berarti mengubah setiap
 * relasi, factory, dan pengujian yang sudah menyebutnya — pekerjaan besar
 * tanpa menambah kemampuan apa pun bagi pengguna. Namanya kini sedikit
 * tidak tepat; itu ditanggung sadar, dicatat di sini dan di
 * docs/BACKEND.md, bukan ditutupi dengan penggantian nama yang mahal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_maintenances', function (Blueprint $table) {
            $table->foreignId('room_id')->nullable()->after('asset_id')
                ->constrained()->cascadeOnDelete();
            $table->foreignId('laboratory_id')->nullable()->after('room_id')
                ->constrained()->cascadeOnDelete();
        });

        // asset_id sebelumnya wajib (satu-satunya target yang dikenal).
        // Doctrine/DBAL tidak terpasang di proyek ini, jadi diubah lewat SQL
        // mentah, bukan Blueprint::change().
        DB::statement('ALTER TABLE asset_maintenances ALTER COLUMN asset_id DROP NOT NULL');

        DB::statement('
            ALTER TABLE asset_maintenances
            ADD CONSTRAINT asset_maintenances_target_tunggal
            CHECK (num_nonnulls(room_id, laboratory_id, asset_id) = 1)
        ');

        DB::statement('
            ALTER TABLE asset_maintenances
            ADD CONSTRAINT asset_maintenances_kalibrasi_hanya_alat
            CHECK (jenis <> \'kalibrasi\' OR asset_id IS NOT NULL)
        ');

        DB::statement('ALTER TABLE asset_maintenances DROP CONSTRAINT asset_maintenances_jenis_sah');
        DB::statement("
            ALTER TABLE asset_maintenances
            ADD CONSTRAINT asset_maintenances_jenis_sah
            CHECK (jenis IN ('preventif', 'korektif', 'darurat', 'kalibrasi'))
        ");

        $table = 'asset_maintenances';
        Schema::table($table, function (Blueprint $t) {
            $t->index(['room_id', 'jadwal']);
            $t->index(['laboratory_id', 'jadwal']);
        });
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE asset_maintenances DROP CONSTRAINT asset_maintenances_jenis_sah');
        DB::statement("
            ALTER TABLE asset_maintenances
            ADD CONSTRAINT asset_maintenances_jenis_sah
            CHECK (jenis IN ('preventif', 'korektif', 'kalibrasi'))
        ");
        DB::statement('ALTER TABLE asset_maintenances DROP CONSTRAINT asset_maintenances_kalibrasi_hanya_alat');
        DB::statement('ALTER TABLE asset_maintenances DROP CONSTRAINT asset_maintenances_target_tunggal');
        DB::statement('ALTER TABLE asset_maintenances ALTER COLUMN asset_id SET NOT NULL');

        Schema::table('asset_maintenances', function (Blueprint $table) {
            $table->dropConstrainedForeignId('laboratory_id');
            $table->dropConstrainedForeignId('room_id');
        });
    }
};
