<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Vendor & mitra — pemasok jasa pendukung fasilitas.
 *
 * Tidak punya ->dalamCakupan(): sama seperti Rental/Invoice/Payment, vendor
 * adalah entitas administratif tingkat satuan kerja, bukan sesuatu yang
 * melekat pada satu gedung tertentu.
 */
class Vendor extends Model
{
    use HasFactory;

    protected $fillable = [
        'kode', 'nama', 'kategori', 'pic_nama', 'pic_telepon', 'pic_email',
        'rating', 'kontrak_berlaku_sampai', 'aktif', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'float',
            'kontrak_berlaku_sampai' => 'immutable_date',
            'aktif' => 'boolean',
        ];
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(AssetMaintenance::class);
    }

    public function scopeCari(Builder $query, string $kata): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where('nama', 'ilike', "%{$kata}%")
            ->orWhere('kode', 'ilike', "%{$kata}%")
            ->orWhere('kategori', 'ilike', "%{$kata}%"));
    }
}
