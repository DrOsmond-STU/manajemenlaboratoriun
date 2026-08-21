<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Tidak setiap peristiwa yang layak diaudit adalah perubahan SATU baris.
 *
 * Menyusun ulang satu perspektif Balanced Scorecard menghapus dan menulis
 * ulang beberapa indikator sekaligus; mencatatnya sebagai N entri "dibuat"
 * tanpa satu pun "dihapus" — akibat penghapusan massal yang tidak melepas
 * peristiwa model — menyesatkan dua kali: tampak seolah indikator baru
 * ditambahkan padahal yang berubah hanya bobotnya, dan yang hilang tidak
 * tercatat sama sekali.
 *
 * Yang benar adalah satu entri berisi keadaan perspektif sebelum dan sesudah.
 * Entri seperti itu tidak menunjuk satu baris mana pun, jadi `model_id`
 * dibolehkan kosong dan identitasnya dipikul `label`.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE audit_logs ALTER COLUMN model_id DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DELETE FROM audit_logs WHERE model_id IS NULL');
        DB::statement('ALTER TABLE audit_logs ALTER COLUMN model_id SET NOT NULL');
    }
};
