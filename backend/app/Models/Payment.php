<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    public const METODE = [
        'transfer' => 'Transfer bank',
        'tunai' => 'Tunai',
        'kartu' => 'Kartu',
        'lainnya' => 'Lainnya',
    ];

    protected $fillable = [
        'invoice_id', 'tanggal', 'jumlah', 'metode', 'referensi', 'catatan', 'dicatat_oleh',
    ];

    protected function casts(): array
    {
        return ['tanggal' => 'immutable_date', 'jumlah' => 'integer'];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
