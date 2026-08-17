<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Ekstensi btree_gist diperlukan agar satu batasan eksklusi dapat mencampur
 * pembanding kesetaraan (room_id WITH =) dengan pembanding tumpang tindih
 * rentang (periode WITH &&) di dalam indeks GiST yang sama.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');
    }

    public function down(): void
    {
        // Sengaja tidak di-drop: ekstensi mungkin dipakai objek lain di basis
        // data yang sama, dan menghapusnya bisa menggagalkan rollback.
    }
};
