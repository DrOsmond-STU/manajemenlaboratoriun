<?php

namespace App\Models;

use App\Models\Concerns\DapatDibatasiCakupan;
use App\Support\CakupanData;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Laboratorium — unit kerja teknis yang menempati sebuah ruangan.
 *
 * @see database/migrations/..._create_laboratories_table.php untuk alasan
 *      pemisahannya dari Room
 */
class Laboratory extends Model
{
    use DapatDibatasiCakupan, HasFactory, SoftDeletes;

    protected $table = 'laboratories';

    public const STATUS = [
        'aktif' => 'Aktif',
        'pemeliharaan' => 'Pemeliharaan',
        'tidak_aktif' => 'Tidak Aktif',
    ];

    protected $fillable = [
        'kode', 'nama', 'room_id', 'jenis', 'unit_kerja', 'luas_m2', 'kapasitas',
        'jam_layanan', 'akreditasi', 'status', 'penanggung_jawab_id', 'supervisor_id',
        'keterangan',
    ];

    protected function casts(): array
    {
        return [
            'luas_m2' => 'integer',
            'kapasitas' => 'integer',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function penanggungJawab(): BelongsTo
    {
        return $this->belongsTo(User::class, 'penanggung_jawab_id');
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }

    public function scopeCari(Builder $query, string $kata): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where('nama', 'ilike', "%{$kata}%")
            ->orWhere('kode', 'ilike', "%{$kata}%")
            ->orWhere('jenis', 'ilike', "%{$kata}%"));
    }

    /**
     * Dibatasi gedung ruangan yang ditempatinya, dan unit kerjanya sendiri.
     *
     * Laboratorium yang belum menempati ruangan mana pun tetap terlihat —
     * sama alasannya dengan aset yang belum ditempatkan: unit yang baru
     * dibentuk atau sedang menunggu ruangan tidak boleh hilang dari daftar.
     */
    protected static function terapkanCakupan(Builder $query, User $pengguna): Builder
    {
        $gedung = static::gedungPengguna($pengguna);

        if ($gedung !== []) {
            $query->where(fn (Builder $q) => $q
                ->whereNull('room_id')
                ->orWhereHas('room', fn (Builder $r) => $r->whereIn('gedung', $gedung)));
        }

        if (CakupanData::dibatasiUnitKerja($pengguna)) {
            $query->where(fn (Builder $q) => $q
                ->whereNull('unit_kerja')
                ->orWhere('unit_kerja', $pengguna->unit_kerja));
        }

        return $query;
    }
}
