<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris jejak audit.
 *
 * Tidak menyediakan cara mengubah atau menghapus, dan basis data pun
 * menolaknya lewat pemicu. `$timestamps` dimatikan karena `updated_at` pada
 * baris yang mustahil diperbarui hanya menyesatkan.
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    public const PERISTIWA = [
        'dibuat' => 'Dibuat',
        'diubah' => 'Diubah',
        'dihapus' => 'Dihapus',
        'dipulihkan' => 'Dipulihkan',
    ];

    protected $fillable = [
        'peristiwa', 'model', 'model_id', 'label',
        'user_id', 'nama_pelaku', 'sebelum', 'sesudah', 'ip', 'rute',
    ];

    protected function casts(): array
    {
        return [
            'sebelum' => 'array',
            'sesudah' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeUntukModel(Builder $query, string $model, int $id): Builder
    {
        return $query->where('model', $model)->where('model_id', $id);
    }
}
