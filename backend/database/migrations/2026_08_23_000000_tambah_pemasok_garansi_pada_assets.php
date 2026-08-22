<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Layar "Asset Register" purwarupa melacak pemasok dan tanggal berakhir
 * garansi — dua hal yang TIDAK ADA pada penatausahaan BMN (PMK 181/PMK.06/
 * 2016 mengenal cara perolehan, sumber dana, dan nomor bukti, bukan nama
 * vendor atau masa garansi). Keduanya nyata dan berguna untuk pengelolaan
 * aset TI/AV sehari-hari, jadi tabelnya dilebarkan mengikuti layar —
 * "tabel yang menyusul layar, bukan layar yang dipangkas".
 *
 * Keduanya nullable: aset lama atau yang diperoleh lewat hibah tidak selalu
 * punya pemasok tunggal atau garansi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('pemasok', 150)->nullable()->after('no_kontrak');
            $table->date('garansi_berakhir')->nullable()->after('pemasok');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['pemasok', 'garansi_berakhir']);
        });
    }
};
