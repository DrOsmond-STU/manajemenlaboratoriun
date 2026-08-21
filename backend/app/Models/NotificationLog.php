<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Catatan satu pengingat yang pernah dikirim.
 *
 * Bukan sekadar jejak: barisnya sendiri yang MENCEGAH pengiriman ulang, lewat
 * indeks unik (penerima, kategori, sumber, tanggal acuan).
 */
class NotificationLog extends Model
{
    protected $fillable = [
        'user_id', 'email', 'kategori', 'sumber_tipe', 'sumber_id',
        'tanggal_acuan', 'perihal', 'status', 'galat', 'dikirim_pada',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_acuan' => 'immutable_date',
            'dikirim_pada' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
