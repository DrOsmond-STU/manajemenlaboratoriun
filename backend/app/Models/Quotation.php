<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Penawaran (quotation) — tahap sebelum tagihan, boleh dinegosiasikan dan
 * boleh kedaluwarsa. Lihat migrasi 2026_08_22_100000 untuk alasan lengkap
 * kenapa ini tabel sendiri, bukan status tambahan pada Invoice.
 */
class Quotation extends Model
{
    use HasFactory;

    public const STATUS = [
        'terkirim' => 'Terkirim',
        'negosiasi' => 'Negosiasi',
        'disetujui' => 'Disetujui',
        'ditolak' => 'Ditolak',
    ];

    protected $fillable = [
        'rental_id', 'nomor', 'tanggal', 'berlaku_sampai',
        'ppn_persen', 'status', 'catatan', 'dibuat_oleh',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'immutable_date',
            'berlaku_sampai' => 'immutable_date',
            'ppn_persen' => 'integer',
        ];
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(QuotationLine::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }

    public function subtotal(): int
    {
        return (int) $this->lines()->sum('subtotal');
    }

    public function ppn(): int
    {
        return intdiv($this->subtotal() * $this->ppn_persen, 100);
    }

    public function total(): int
    {
        return $this->subtotal() + $this->ppn();
    }

    /**
     * Kedaluwarsa dihitung, bukan disimpan — status tersimpannya tetap apa
     * adanya (`terkirim`/`negosiasi`) sampai staf mengambil keputusan;
     * "sudah lewat tanggal berlaku" adalah fakta tanggal, bukan keputusan.
     */
    public function kedaluwarsa(): bool
    {
        return in_array($this->status, ['terkirim', 'negosiasi'], true)
            && $this->berlaku_sampai->isPast();
    }

    public function dapatDiterbitkanInvoice(): bool
    {
        return $this->status === 'disetujui' && ! $this->invoice()->exists();
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->whereIn('status', ['terkirim', 'negosiasi']);
    }
}
