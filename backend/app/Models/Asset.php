<?php

namespace App\Models;

use App\Services\Penyusutan;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Aset / peralatan laboratorium dan fasilitas, dengan dua penomoran:
 * identitas BMN (`bmn_id`) dan kode internal (`kode_internal`).
 */
class Asset extends Model
{
    use HasFactory, SoftDeletes;

    /** Kondisi barang menurut penatausahaan BMN. */
    public const KONDISI = [
        'B' => 'Baik',
        'RR' => 'Rusak Ringan',
        'RB' => 'Rusak Berat',
    ];

    protected $fillable = [
        'kode_lokasi', 'kode_barang', 'nup', 'kode_internal',
        'nama', 'merk', 'tipe', 'serial_number', 'spesifikasi',
        'cara_perolehan', 'tgl_perolehan', 'sumber_dana', 'no_bukti', 'no_kontrak',
        'kuantitas', 'satuan', 'nilai_perolehan', 'masa_manfaat',
        'kondisi', 'status_penggunaan', 'no_psp', 'tgl_psp', 'kib',
        'room_id', 'penanggung_jawab_id', 'keterangan',
    ];

    /** `bmn_id` dihitung basis data (GENERATED), jadi tidak boleh ditulis aplikasi. */
    protected $guarded = ['bmn_id'];

    protected function casts(): array
    {
        return [
            'tgl_perolehan' => 'immutable_date',
            'tgl_psp' => 'immutable_date',
            'nup' => 'integer',
            'kuantitas' => 'integer',
            'nilai_perolehan' => 'integer',
            'masa_manfaat' => 'integer',
        ];
    }

    public function kodeBarang(): BelongsTo
    {
        return $this->belongsTo(BmnKodeBarang::class, 'kode_barang', 'kode');
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function penanggungJawab(): BelongsTo
    {
        return $this->belongsTo(User::class, 'penanggung_jawab_id');
    }

    /** NUP berformat lima digit sebagaimana lazim pada dokumen BMN. */
    protected function nupFmt(): Attribute
    {
        return Attribute::get(fn (): string => str_pad((string) $this->nup, 5, '0', STR_PAD_LEFT));
    }

    /** Penyusutan garis lurus per PMK 65/PMK.06/2017. */
    protected function penyusutan(): Attribute
    {
        return Attribute::get(fn (): Penyusutan => Penyusutan::hitung(
            nilaiPerolehan: $this->nilai_perolehan,
            masaManfaat: $this->masa_manfaat,
            tglPerolehan: $this->tgl_perolehan,
        ));
    }

    public function scopeCari(Builder $query, string $kata): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where('nama', 'ilike', "%{$kata}%")
            ->orWhere('kode_internal', 'ilike', "%{$kata}%")
            ->orWhere('bmn_id', 'like', "%{$kata}%")
            ->orWhere('serial_number', 'ilike', "%{$kata}%"));
    }

    public function scopeKondisi(Builder $query, string $kondisi): Builder
    {
        return $query->where('kondisi', $kondisi);
    }
}
