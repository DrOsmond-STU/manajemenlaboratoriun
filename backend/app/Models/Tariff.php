<?php

namespace App\Models;

use App\Models\Concerns\Diaudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Tariff extends Model
{
    // Seluruh kolom diaudit. Tarif menentukan berapa uang yang ditagihkan
    // kepada pihak luar, dan setiap kolomnya — termasuk `aktif` dan `segmen`
    // — mengubah angka yang muncul pada tagihan.
    use Diaudit, HasFactory;

    public const SATUAN = ['jam' => 'Per jam', 'hari' => 'Per hari', 'paket' => 'Per paket'];

    public const SEGMEN = ['internal' => 'Internal', 'umum' => 'Umum', 'pemerintah' => 'Pemerintah'];

    protected $fillable = [
        'nama', 'room_id', 'laboratory_id', 'asset_id',
        'satuan_waktu', 'harga', 'segmen', 'aktif',
    ];

    protected function casts(): array
    {
        return ['harga' => 'integer', 'aktif' => 'boolean'];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function laboratory(): BelongsTo
    {
        return $this->belongsTo(Laboratory::class);
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->where('aktif', true);
    }
}
