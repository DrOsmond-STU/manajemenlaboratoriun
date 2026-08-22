<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris penawaran — sama persis polanya dengan InvoiceLine. Saat
 * penawaran diterbitkan jadi invoice, baris ini disalin apa adanya ke
 * invoice_lines; keduanya tetap tabel terpisah supaya mengedit baris
 * penawaran yang belum disetujui tidak pernah menyentuh invoice mana pun.
 */
class QuotationLine extends Model
{
    protected $fillable = ['quotation_id', 'deskripsi', 'kuantitas', 'satuan', 'harga_satuan'];

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

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }
}
