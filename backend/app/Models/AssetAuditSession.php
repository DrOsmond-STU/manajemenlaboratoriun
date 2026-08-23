<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sesi audit fisik (stock opname) atas aset — lihat docblock migrasinya
 * untuk bagaimana "tidak ditemukan" dihitung tanpa disimpan sebagai baris.
 */
class AssetAuditSession extends Model
{
    use HasFactory;

    public const STATUS = [
        'berjalan' => 'Berjalan',
        'selesai' => 'Selesai',
    ];

    protected $fillable = [
        'nama', 'mulai', 'target_selesai', 'status',
        'selesai_pada', 'dibuat_oleh', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'mulai' => 'immutable_date',
            'target_selesai' => 'immutable_date',
            'selesai_pada' => 'immutable_datetime',
        ];
    }

    public function scans(): HasMany
    {
        return $this->hasMany(AssetAuditScan::class);
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
