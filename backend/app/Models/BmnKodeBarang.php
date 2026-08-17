<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Master kode barang BMN (PMK 29/PMK.06/2010).
 *
 * @see database/migrations/..._create_bmn_kode_barang_table.php untuk susunan digit
 */
class BmnKodeBarang extends Model
{
    use HasFactory;

    protected $table = 'bmn_kode_barang';

    /** Pola 10 digit berjenjang: X.XX.XX.XX.XXX */
    public const POLA_KODE = '/^[1-8]\.[0-9]{2}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3}$/';

    /** Golongan yang wajib punya Kartu Identitas Barang. */
    public const KIB_PER_GOLONGAN = [
        '2' => 'A',   // Tanah
        '3' => 'B',   // Peralatan dan Mesin
        '4' => 'C',   // Gedung dan Bangunan
        '5' => 'D',   // Jalan, Irigasi, dan Jaringan
        '6' => 'E',   // Aset Tetap Lainnya
    ];

    protected $fillable = [
        'kode', 'uraian', 'golongan', 'bidang', 'kelompok', 'sub_kelompok', 'masa_manfaat', 'kib',
    ];

    protected function casts(): array
    {
        return ['masa_manfaat' => 'integer'];
    }

    /**
     * Jenjang diisi dari kodenya sendiri agar pemanggil tidak perlu memecah
     * string, dan agar tidak mungkin berbeda dari basis data yang memeriksa
     * hal yang sama lewat CHECK constraint.
     */
    protected static function booted(): void
    {
        static::saving(function (self $kb) {
            if (! $kb->kode) {
                return;
            }

            $kb->golongan = substr($kb->kode, 0, 1);
            $kb->bidang = substr($kb->kode, 0, 4);
            $kb->kelompok = substr($kb->kode, 0, 7);
            $kb->sub_kelompok = substr($kb->kode, 0, 10);
            $kb->kib ??= self::KIB_PER_GOLONGAN[$kb->golongan] ?? null;
        });
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'kode_barang', 'kode');
    }

    /** Tapis berdasarkan awalan kode, misalnya '3.08' untuk seluruh alat laboratorium. */
    public function scopeDiBawah(Builder $query, string $awalan): Builder
    {
        return $query->where('kode', 'like', $awalan.'%');
    }

    public function scopeCari(Builder $query, string $kata): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where('kode', 'like', "%{$kata}%")
            ->orWhere('uraian', 'ilike', "%{$kata}%"));
    }
}
