<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EventParticipant extends Model
{
    use HasFactory;

    public const STATUS = [
        'terdaftar' => 'Terdaftar',
        'hadir' => 'Hadir',
        'tidak_hadir' => 'Tidak hadir',
    ];

    protected $fillable = [
        'event_id', 'nama', 'instansi', 'email', 'telepon',
        'status', 'hadir_pada', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'hadir_pada' => 'immutable_datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function scopeCari(Builder $query, string $kata): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where('nama', 'ilike', "%{$kata}%")
            ->orWhere('instansi', 'ilike', "%{$kata}%"));
    }
}
