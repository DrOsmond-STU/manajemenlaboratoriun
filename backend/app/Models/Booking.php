<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    use HasFactory;

    /** Status yang tidak lagi memblokir slot — harus sama dengan klausa WHERE batasan eksklusi. */
    public const STATUS_TIDAK_MEMBLOKIR = ['dibatalkan', 'ditolak'];

    protected $fillable = [
        'room_id', 'user_id', 'keperluan', 'jumlah_peserta', 'mulai', 'selesai', 'status', 'catatan',
    ];

    /**
     * `periode` dihitung basis data (GENERATED), jadi tidak boleh ditulis aplikasi.
     */
    protected $guarded = ['periode'];

    protected function casts(): array
    {
        return [
            'mulai' => 'immutable_datetime',
            'selesai' => 'immutable_datetime',
            'jumlah_peserta' => 'integer',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Hanya pemesanan yang masih memblokir slot. */
    public function scopeAktif(Builder $query): Builder
    {
        return $query->whereNotIn('status', self::STATUS_TIDAK_MEMBLOKIR);
    }

    /** Pemesanan yang bersinggungan dengan sebuah rentang waktu. */
    public function scopeBersinggungan(Builder $query, string $mulai, string $selesai): Builder
    {
        return $query->where('mulai', '<', $selesai)->where('selesai', '>', $mulai);
    }
}
