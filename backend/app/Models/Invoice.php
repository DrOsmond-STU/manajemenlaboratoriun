<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Tagihan.
 *
 * Nilainya dihitung dari baris-barisnya, bukan disimpan sebagai kolom.
 * Total yang digandakan menyimpang begitu ada satu jalur yang mengubah baris
 * tanpa memperbarui totalnya — dan pada angka uang, penyimpangan itu berarti
 * tagihan yang jumlahnya tidak sama dengan penjumlahan rinciannya sendiri.
 */
class Invoice extends Model
{
    use HasFactory;

    public const STATUS = [
        'terbit' => 'Terbit',
        'sebagian' => 'Dibayar sebagian',
        'lunas' => 'Lunas',
        'dibatalkan' => 'Dibatalkan',
    ];

    protected $fillable = [
        'rental_id', 'nomor', 'tanggal', 'jatuh_tempo',
        'ppn_persen', 'status', 'catatan', 'dibuat_oleh',
    ];

    protected function casts(): array
    {
        return [
            'tanggal' => 'immutable_date',
            'jatuh_tempo' => 'immutable_date',
            'ppn_persen' => 'integer',
        ];
    }

    public function rental(): BelongsTo
    {
        return $this->belongsTo(Rental::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(InvoiceLine::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
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

    public function terbayar(): int
    {
        return (int) $this->payments()->sum('jumlah');
    }

    public function sisa(): int
    {
        return max(0, $this->total() - $this->terbayar());
    }

    public function jatuhTempoTerlewat(): bool
    {
        return $this->status !== 'lunas'
            && $this->status !== 'dibatalkan'
            && $this->jatuh_tempo->isPast();
    }

    public function scopeBelumLunas(Builder $query): Builder
    {
        return $query->whereIn('status', ['terbit', 'sebagian']);
    }
}
