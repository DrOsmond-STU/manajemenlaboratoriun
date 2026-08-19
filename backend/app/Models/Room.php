<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Room extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'kode', 'nama', 'gedung', 'lantai', 'kapasitas', 'status', 'perlu_persetujuan',
    ];

    protected function casts(): array
    {
        return [
            'kapasitas' => 'integer',
            'perlu_persetujuan' => 'boolean',
        ];
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
}
