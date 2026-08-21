<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris tagihan — CUPLIKAN, bukan acuan.
 *
 * Deskripsi dan harganya disalin saat tagihan diterbitkan. Tagihan yang sudah
 * terbit tidak boleh berubah nilainya hanya karena tarifnya dinaikkan bulan
 * depan.
 */
class InvoiceLine extends Model
{
    protected $fillable = ['invoice_id', 'deskripsi', 'kuantitas', 'satuan', 'harga_satuan'];

    /** `subtotal` dihitung basis data (GENERATED). */
    protected $guarded = ['subtotal'];

    protected function casts(): array
    {
        return [
            'kuantitas' => 'integer',
            'harga_satuan' => 'integer',
            'subtotal' => 'integer',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
