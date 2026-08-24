<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Event extends Model
{
    use HasFactory;

    public const STATUS = [
        'direncanakan' => 'Direncanakan',
        'terkonfirmasi' => 'Terkonfirmasi',
        'berlangsung' => 'Sedang berlangsung',
        'selesai' => 'Selesai',
        'dibatalkan' => 'Dibatalkan',
    ];

    protected $fillable = [
        'nama', 'jenis', 'organizer', 'pic_id', 'room_id',
        'tanggal', 'jumlah_peserta', 'anggaran',
        'status', 'catatan', 'dibuat_oleh',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'immutable_date',
            'jumlah_peserta' => 'integer',
            'anggaran' => 'integer',
        ];
    }

    public function pic(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pic_id');
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
            ->orWhere('organizer', 'ilike', "%{$kata}%"));
    }
}
