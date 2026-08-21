<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Penugasan satu pengguna pada satu gedung.
 *
 * Tabel tersendiri, bukan kolom pada `users`, karena satu orang lazim
 * mengampu lebih dari satu gedung — dan menyimpannya sebagai daftar
 * bertanda koma akan membuat penapisan bergantung pada pencocokan teks
 * yang mudah meleset (gedung "A" ikut cocok dengan "A2").
 */
class UserGedung extends Model
{
    protected $table = 'user_gedung';

    protected $fillable = ['user_id', 'gedung'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
