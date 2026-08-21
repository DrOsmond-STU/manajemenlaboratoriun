<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu kali pelaksanaan checklist.
 */
class ChecklistRun extends Model
{
    use Concerns\MelekatPadaSumberDaya, HasFactory;

    public const STATUS = [
        'berjalan' => 'Sedang dikerjakan',
        'selesai' => 'Selesai',
        'dibatalkan' => 'Dibatalkan',
    ];

    protected $fillable = [
        'checklist_template_id', 'room_id', 'laboratory_id', 'asset_id', 'user_id',
        'status', 'dimulai_pada', 'selesai_pada', 'butir_total', 'butir_lulus', 'skor', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'dimulai_pada' => 'immutable_datetime',
            'selesai_pada' => 'immutable_datetime',
            'butir_total' => 'integer',
            'butir_lulus' => 'integer',
            'skor' => 'integer',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'checklist_template_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(ChecklistAnswer::class);
    }

    public function scopeBerjalan(Builder $query): Builder
    {
        return $query->where('status', 'berjalan');
    }
}
