<?php

namespace App\Models;

use App\Models\Concerns\DapatDibatasiCakupan;
use App\Support\CakupanData;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    use DapatDibatasiCakupan, HasFactory;

    /** Status yang tidak lagi memblokir slot — harus sama dengan klausa WHERE batasan eksklusi. */
    public const STATUS_TIDAK_MEMBLOKIR = ['dibatalkan', 'ditolak'];

    /**
     * Nama status yang terbaca.
     *
     * Dikirim bersama kodenya supaya antarmuka tidak perlu memelihara salinan
     * daftar yang sama — salinan itu pasti menyimpang, dan yang tampil lalu
     * jadi kode mentah seperti "menunggu" di tengah kalimat berbahasa
     * Indonesia yang rapi.
     */
    public const STATUS = [
        'menunggu' => 'Menunggu persetujuan',
        'disetujui' => 'Disetujui',
        'ditolak' => 'Ditolak',
        'berlangsung' => 'Sedang berlangsung',
        'selesai' => 'Selesai',
        'dibatalkan' => 'Dibatalkan',
    ];

    protected $fillable = [
        'room_id', 'user_id', 'keperluan', 'unit_kerja', 'jumlah_peserta',
        'mulai', 'selesai', 'status', 'catatan',
        'disetujui_oleh', 'disetujui_pada', 'alasan_penolakan',
    ];

    /**
     * `periode` dihitung basis data (GENERATED), jadi tidak boleh ditulis aplikasi.
     */
    protected $guarded = ['periode'];

    protected function casts(): array
    {
        return [
            'mulai' => 'immutable_datetime',
            'selesai' => 'immutable_datetime',
            'jumlah_peserta' => 'integer',
            'disetujui_pada' => 'immutable_datetime',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function penyetuju(): BelongsTo
    {
        return $this->belongsTo(User::class, 'disetujui_oleh');
    }

    /** Hanya pemesanan yang masih memblokir slot. */
    public function scopeAktif(Builder $query): Builder
    {
        return $query->whereNotIn('status', self::STATUS_TIDAK_MEMBLOKIR);
    }

    /** Pemesanan yang bersinggungan dengan sebuah rentang waktu. */
    public function scopeBersinggungan(Builder $query, string $mulai, string $selesai): Builder
    {
        return $query->where('mulai', '<', $selesai)->where('selesai', '>', $mulai);
    }

    /**
     * Pemesanan dibatasi gedung dan unit kerja — TETAPI pengajuan milik
     * sendiri selalu terlihat.
     *
     * Aturan kepemilikan itu bukan kelonggaran: pemohon yang tidak dapat
     * melihat pengajuannya sendiri tidak punya cara mengetahui apakah
     * pengajuannya disetujui, dan akan mengajukan ulang berkali-kali.
     * Pengecualian ini disebut eksplisit pada SECURITY.md §4.2.
     */
    protected static function terapkanCakupan(Builder $query, User $pengguna): Builder
    {
        $gedung = static::gedungPengguna($pengguna);
        $dibatasiUnit = CakupanData::dibatasiUnitKerja($pengguna);

        if ($gedung === [] && ! $dibatasiUnit) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($gedung, $dibatasiUnit, $pengguna) {
            // Selalu terlihat: pengajuan sendiri.
            $q->where('user_id', $pengguna->id);

            $q->orWhere(function (Builder $lain) use ($gedung, $dibatasiUnit, $pengguna) {
                if ($gedung !== []) {
                    $lain->whereHas('room', fn (Builder $r) => $r->whereIn('gedung', $gedung));
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
