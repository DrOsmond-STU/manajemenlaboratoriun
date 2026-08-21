<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Templat checklist — dibuat dan dikelola pengguna, bukan tertanam di kode.
 */
class ChecklistTemplate extends Model
{
    use HasFactory, SoftDeletes;

    /** Enam jenis yang diminta, sesuai dokumen fitur. */
    public const JENIS = [
        'pengecekan' => 'Pengecekan & verifikasi',
        'perawatan' => 'Perawatan',
        'penyewaan' => 'Persiapan penyewaan',
        'kebersihan' => 'Kebersihan',
        'kerapian' => 'Kerapian',
        'kelayakan' => 'Kelayakan',
    ];

    protected $fillable = ['nama', 'jenis', 'deskripsi', 'aktif', 'dibuat_oleh'];

    protected function casts(): array
    {
        return ['aktif' => 'boolean'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(ChecklistItem::class)->orderBy('urutan');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(ChecklistAssignment::class);
    }

    public function runs(): HasMany
    {
        return $this->hasMany(ChecklistRun::class);
    }

    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->where('aktif', true);
    }

    public function jenisNama(): string
    {
        return self::JENIS[$this->jenis] ?? $this->jenis;
    }
}
