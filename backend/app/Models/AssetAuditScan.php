<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu pemindaian sungguhan (aset yang berhasil ditemukan). Lihat docblock
 * migrasi pembuatnya untuk alasan `lokasi_tercatat`/`kondisi_tercatat`
 * disimpan sebagai snapshot, bukan dibaca ulang dari `assets` saat ini.
 */
class AssetAuditScan extends Model
{
    use HasFactory;

    public const TEMUAN = [
        'sesuai' => 'Sesuai catatan',
        'lokasi_berbeda' => 'Lokasi berbeda',
        'kondisi_berbeda' => 'Kondisi berbeda',
    ];

    protected $fillable = [
        'asset_audit_session_id', 'asset_id',
        'lokasi_tercatat', 'lokasi_ditemukan',
        'kondisi_tercatat', 'kondisi_ditemukan',
        'auditor_id', 'dipindai_pada', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'dipindai_pada' => 'immutable_datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(AssetAuditSession::class, 'asset_audit_session_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function auditor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auditor_id');
    }

    /**
     * SATU kode temuan, bukan disimpan sebagai kolom — dihitung dari
     * perbandingan snapshot vs hasil temuan, sehingga tidak pernah bisa
     * menyimpang dari nilai yang dibandingkannya sendiri.
     *
     * Bila lokasi DAN kondisi sama-sama berbeda, "lokasi_berbeda" menang —
     * aset yang ditemukan di tempat yang salah adalah kegagalan proses yang
     * lebih mendesak daripada catatan kondisi yang perlu diperbarui.
     */
    public function temuan(): string
    {
        $lokasiBerbeda = $this->lokasi_ditemukan !== null && $this->lokasi_ditemukan !== $this->lokasi_tercatat;
        $kondisiBerbeda = $this->kondisi_ditemukan !== null && $this->kondisi_ditemukan !== $this->kondisi_tercatat;

        return match (true) {
            $lokasiBerbeda => 'lokasi_berbeda',
            $kondisiBerbeda => 'kondisi_berbeda',
            default => 'sesuai',
        };
    }
}
