<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetPhoto extends Model
{
    use HasFactory;

    protected $table = 'asset_photos';

    protected $fillable = [
        'asset_id', 'jalur', 'nama_asli', 'mime', 'ukuran',
        'utama', 'urutan', 'keterangan', 'diunggah_oleh',
    ];

    protected function casts(): array
    {
        return [
            'utama' => 'boolean',
            'ukuran' => 'integer',
            'urutan' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function pengunggah(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diunggah_oleh');
    }
}
