<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris riwayat perubahan aset.
 *
 * Tidak menyediakan cara mengubah atau menghapus: riwayat yang dapat disunting
 * bukan riwayat. Bila ada yang tercatat keliru, koreksinya berupa baris baru.
 */
class AssetMutation extends Model
{
    use HasFactory;

    public const JENIS = [
        'penempatan' => 'Perpindahan ruangan',
        'kondisi' => 'Perubahan kondisi',
        'penanggung_jawab' => 'Pergantian penanggung jawab',
        'status_penggunaan' => 'Perubahan status penggunaan',
    ];

    protected $fillable = [
        'asset_id', 'jenis', 'nilai_lama', 'nilai_baru', 'user_id', 'catatan',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function jenisNama(): string
    {
        return self::JENIS[$this->jenis] ?? $this->jenis;
    }
}
