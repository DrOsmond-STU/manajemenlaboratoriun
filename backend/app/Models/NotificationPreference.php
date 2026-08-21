<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Preferensi notifikasi per pengguna per kategori.
 *
 * Ketiadaan baris berarti "pakai bawaan": aktif, ingatkan H-1. Itu disengaja —
 * mewajibkan setiap pengguna menyetel preferensinya lebih dulu berarti tidak
 * seorang pun menerima pengingat sampai mereka mengurusnya, dan pengingat yang
 * tidak pernah sampai sama saja dengan tidak ada.
 */
class NotificationPreference extends Model
{
    public const KATEGORI = [
        'booking' => 'Pemesanan ruangan',
        'peminjaman' => 'Peminjaman alat',
        'pemeliharaan' => 'Pemeliharaan',
        'kalibrasi' => 'Kalibrasi',
        'checklist' => 'Checklist',
    ];

    public const BAWAAN_AKTIF = true;

    public const BAWAAN_H_MIN = 1;

    protected $fillable = ['user_id', 'kategori', 'email_aktif', 'ingatkan_h_min'];

    protected function casts(): array
    {
        return [
            'email_aktif' => 'boolean',
            'ingatkan_h_min' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
