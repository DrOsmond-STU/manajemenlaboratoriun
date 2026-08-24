<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Manajemen Pengunjung — registrasi tamu, check-in/out, dan badge.
 *
 * Tidak punya ->dalamCakupan(): sama seperti Vendor, front desk perlu
 * melihat SELURUH tamu, terlepas gedung/ruangan mana yang mereka kunjungi.
 */
class Visitor extends Model
{
    use HasFactory;

    public const STATUS = [
        'terjadwal' => 'Terjadwal',
        'di_dalam' => 'Di Dalam',
        'selesai' => 'Selesai',
    ];

    protected $fillable = [
        'nama', 'instansi', 'tujuan', 'host_id', 'room_id',
        'tanggal', 'masuk_pada', 'keluar_pada', 'badge',
        'status', 'catatan', 'dibuat_oleh',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'immutable_date',
            'masuk_pada' => 'immutable_datetime',
            'keluar_pada' => 'immutable_datetime',
        ];
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function pendaftar(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }

    public function scopeCari(Builder $query, string $kata): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where('nama', 'ilike', "%{$kata}%")
            ->orWhere('instansi', 'ilike', "%{$kata}%"));
    }
}
