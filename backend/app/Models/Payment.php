<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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

    /**
     * `terverifikasi` adalah bawaan: satu-satunya jalur pencatatan saat ini
     * adalah staf mengetik langsung, jadi pembayaran dianggap sudah
     * dipastikan kecuali staf sengaja menandainya `menunggu_verifikasi`.
     * Hanya pembayaran terverifikasi yang dihitung `Invoice::terbayar()`.
     */
    public const STATUS = [
        'menunggu_verifikasi' => 'Menunggu verifikasi',
        'terverifikasi' => 'Terverifikasi',
    ];

    protected $fillable = [
        'invoice_id', 'tanggal', 'jumlah', 'metode', 'status', 'referensi', 'catatan', 'dicatat_oleh',
    ];

    protected function casts(): array
    {
        return ['tanggal' => 'immutable_date', 'jumlah' => 'integer'];
    }

    public function scopeTerverifikasi(Builder $query): Builder
    {
        return $query->where('status', 'terverifikasi');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
