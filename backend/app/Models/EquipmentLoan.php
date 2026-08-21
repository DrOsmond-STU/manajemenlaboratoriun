<?php

namespace App\Models;

use App\Models\Concerns\DapatDibatasiCakupan;
use App\Support\CakupanData;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Peminjaman alat.
 */
class EquipmentLoan extends Model
{
    use DapatDibatasiCakupan, HasFactory;

    /**
     * Status yang tidak lagi menahan alat.
     *
     * HARUS sama persis dengan klausa pada pemicu basis data. Bila keduanya
     * menyimpang, aplikasi dan basis data akan berbeda pendapat tentang alat
     * mana yang sedang bebas — dan yang kalah adalah pengguna, yang melihat
     * alat tersedia lalu ditolak saat menyimpan.
     */
    public const STATUS_TIDAK_MENAHAN = ['ditolak', 'dibatalkan', 'dikembalikan'];

    public const STATUS = [
        'menunggu' => 'Menunggu persetujuan',
        'disetujui' => 'Disetujui',
        'ditolak' => 'Ditolak',
        'dipinjam' => 'Sedang dipinjam',
        'dikembalikan' => 'Dikembalikan',
        'dibatalkan' => 'Dibatalkan',
    ];

    protected $fillable = [
        'asset_id', 'user_id', 'keperluan', 'unit_kerja', 'lokasi_pemakaian',
        'mulai', 'selesai', 'diambil_pada', 'dikembalikan_pada',
        'status', 'kondisi_saat_kembali', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'mulai' => 'immutable_datetime',
            'selesai' => 'immutable_datetime',
            'diambil_pada' => 'immutable_datetime',
            'dikembalikan_pada' => 'immutable_datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Peminjaman yang masih menahan alat. */
    public function scopeMenahan(Builder $query): Builder
    {
        return $query->whereNotIn('status', self::STATUS_TIDAK_MENAHAN);
    }

    public function scopeBersinggungan(Builder $query, string $mulai, string $selesai): Builder
    {
        return $query->where('mulai', '<', $selesai)->where('selesai', '>', $mulai);
    }

    /** Sudah lewat batas waktu tetapi belum dikembalikan. */
    public function terlambat(): bool
    {
        return $this->status === 'dipinjam' && $this->selesai->isPast();
    }

    /**
     * Dibatasi lewat aset yang dipinjam — dan peminjaman sendiri selalu
     * terlihat, sama alasannya dengan pemesanan ruangan.
     */
    protected static function terapkanCakupan(Builder $query, User $pengguna): Builder
    {
        $gedung = static::gedungPengguna($pengguna);
        $dibatasiUnit = CakupanData::dibatasiUnitKerja($pengguna);

        if ($gedung === [] && ! $dibatasiUnit) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($gedung, $dibatasiUnit, $pengguna) {
            $q->where('user_id', $pengguna->id);

            $q->orWhere(function (Builder $lain) use ($gedung, $dibatasiUnit, $pengguna) {
                if ($gedung !== []) {
                    $lain->whereHas('asset', fn (Builder $a) => $a
                        ->where(fn (Builder $x) => $x
                            ->whereNull('room_id')
                            ->orWhereHas('room', fn (Builder $r) => $r->whereIn('gedung', $gedung))));
                }

                if ($dibatasiUnit) {
                    $lain->where(fn (Builder $u) => $u
                        ->whereNull('unit_kerja')
                        ->orWhere('unit_kerja', $pengguna->unit_kerja));
                }
            });
        });
    }
}
