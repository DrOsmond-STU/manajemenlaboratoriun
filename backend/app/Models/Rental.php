<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Rental extends Model
{
    use HasFactory;

    public const STATUS = [
        'draf' => 'Draf',
        'dikonfirmasi' => 'Dikonfirmasi',
        'berjalan' => 'Berjalan',
        'selesai' => 'Selesai',
        'dibatalkan' => 'Dibatalkan',
    ];

    protected $fillable = [
        'penyewa', 'instansi', 'kontak', 'email', 'npwp',
        'room_id', 'laboratory_id', 'mulai', 'selesai',
        'segmen', 'status', 'keperluan', 'dibuat_oleh',
    ];

    protected function casts(): array
    {
        return [
            'mulai' => 'immutable_datetime',
            'selesai' => 'immutable_datetime',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function laboratory(): BelongsTo
    {
        return $this->belongsTo(Laboratory::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    /** Lama sewa dalam jam, dibulatkan ke atas. */
    public function durasiJam(): int
    {
        return (int) ceil($this->mulai->diffInMinutes($this->selesai) / 60);
    }

    /** Lama sewa dalam hari, dibulatkan ke atas. */
    public function durasiHari(): int
    {
        return (int) max(1, ceil($this->durasiJam() / 24));
    }
}
