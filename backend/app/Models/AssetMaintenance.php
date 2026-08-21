<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu pekerjaan pemeliharaan atau kalibrasi pada sebuah alat.
 */
class AssetMaintenance extends Model
{
    use HasFactory;

    public const JENIS = [
        'preventif' => 'Pemeliharaan preventif',
        'korektif' => 'Pemeliharaan korektif',
        'kalibrasi' => 'Kalibrasi',
    ];

    public const STATUS = [
        'dijadwalkan' => 'Dijadwalkan',
        'berjalan' => 'Sedang dikerjakan',
        'selesai' => 'Selesai',
        'dibatalkan' => 'Dibatalkan',
    ];

    /** Jenis yang termasuk modul kalibrasi, bukan pemeliharaan. */
    public const JENIS_KALIBRASI = 'kalibrasi';

    protected $fillable = [
        'asset_id', 'jenis', 'jadwal', 'dikerjakan_pada', 'pelaksana', 'petugas_id',
        'status', 'hasil', 'biaya', 'no_sertifikat', 'lembaga_kalibrasi',
        'berlaku_sampai', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'jadwal' => 'immutable_date',
            'dikerjakan_pada' => 'immutable_date',
            'berlaku_sampai' => 'immutable_date',
            'biaya' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function petugas(): BelongsTo
    {
        return $this->belongsTo(User::class, 'petugas_id');
    }

    /** Belum selesai dan sudah lewat jadwalnya. */
    public function scopeTerlambat(Builder $query): Builder
    {
        return $query->whereIn('status', ['dijadwalkan', 'berjalan'])
            ->whereDate('jadwal', '<', now());
    }

    /** Jatuh tempo dalam sekian hari ke depan — daftar kerja harian teknisi. */
    public function scopeJatuhTempo(Builder $query, int $hari = 30): Builder
    {
        return $query->whereIn('status', ['dijadwalkan', 'berjalan'])
            ->whereDate('jadwal', '<=', now()->addDays($hari))
            ->whereDate('jadwal', '>=', now()->subYears(5));
    }

    public function scopeKalibrasi(Builder $query): Builder
    {
        return $query->where('jenis', self::JENIS_KALIBRASI);
    }

    public function terlambat(): bool
    {
        return in_array($this->status, ['dijadwalkan', 'berjalan'], true)
            && $this->jadwal->isPast();
    }

    public function jenisNama(): string
    {
        return self::JENIS[$this->jenis] ?? $this->jenis;
    }
}
