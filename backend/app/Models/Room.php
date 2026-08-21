<?php

namespace App\Models;

use App\Models\Concerns\DapatDibatasiCakupan;
use App\Models\Concerns\Diaudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Room extends Model
{
    use DapatDibatasiCakupan, Diaudit, HasFactory, SoftDeletes;

    public const STATUS = [
        'tersedia' => 'Tersedia',
        'pemeliharaan' => 'Pemeliharaan',
        'tidak_aktif' => 'Tidak aktif',
    ];

    /**
     * Skema tarif dipisahkan dari nilainya.
     *
     * Ruangan internal bertarif nol berbeda maknanya dari ruangan berbayar
     * yang tarifnya belum ditetapkan — satu kolom angka saja tidak dapat
     * membedakan keduanya, dan yang kedua adalah kesalahan yang harus
     * ketahuan sebelum tagihan pertama terbit.
     */
    public const SKEMA_TARIF = [
        'internal' => 'Internal (tanpa tarif)',
        'internal_gratis' => 'Internal gratis, eksternal berbayar',
        'berbayar' => 'Berbayar',
        'terbatas' => 'Terbatas / khusus',
    ];

    protected $fillable = [
        'kode', 'nama', 'jenis', 'gedung', 'lantai', 'luas_m2',
        'kapasitas', 'skema_tarif', 'tarif', 'status', 'perlu_persetujuan',
        'penanggung_jawab_id', 'tata_letak', 'fasilitas', 'keterangan',
    ];

    protected function casts(): array
    {
        return [
            'kapasitas' => 'integer',
            'luas_m2' => 'integer',
            'tarif' => 'integer',
            'perlu_persetujuan' => 'boolean',
            'tata_letak' => 'array',
            'fasilitas' => 'array',
        ];
    }

    /** @return list<string> */
    public function kolomDiaudit(): array
    {
        // Tarif dan skemanya menentukan uang yang ditagihkan; kode adalah
        // kunci yang dipakai dokumen lain untuk menunjuk ruangan ini.
        return ['kode', 'nama', 'skema_tarif', 'tarif', 'status', 'penanggung_jawab_id'];
    }

    public function labelAudit(): ?string
    {
        return $this->nama;
    }

    public function penanggungJawab(): BelongsTo
    {
        return $this->belongsTo(User::class, 'penanggung_jawab_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /**
     * Pemesanan yang masih memblokir ruangan ini pada masa depan.
     *
     * Dipakai untuk menolak penghapusan ruangan yang masih terjadwal.
     * Pemesanan yang sudah lewat sengaja tidak dihitung: menahan penghapusan
     * ruangan gara-gara jadwal tahun lalu hanya membuat master data tidak
     * pernah bisa dirapikan.
     */
    public function bookingsAktif(): HasMany
    {
        return $this->bookings()
            ->whereNotIn('status', Booking::STATUS_TIDAK_MEMBLOKIR)
            ->where('selesai', '>', now());
    }

    /**
     * Ruangan dibatasi gedung yang diampu pengguna.
     */
    protected static function terapkanCakupan(Builder $query, User $pengguna): Builder
    {
        $gedung = static::gedungPengguna($pengguna);

        return $gedung === [] ? $query : $query->whereIn('gedung', $gedung);
    }
}
