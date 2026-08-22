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

    /**
     * `tarif` — melekat pada satu fasilitas (ruangan/lab/aset), dipakai
     * otomatis saat penyewaan ditagihkan.
     * `addon` — layanan tambahan lepas dari fasilitas tertentu (operator,
     * keamanan, sound system).
     * `paket` — gabungan bertarif tunggal, dengan deskripsi apa yang
     * termasuk dan kapasitas pesertanya.
     */
    public const JENIS = ['tarif' => 'Tarif fasilitas', 'addon' => 'Add-on', 'paket' => 'Paket layanan'];

    protected $fillable = [
        'nama', 'jenis', 'room_id', 'laboratory_id', 'asset_id',
        'satuan_waktu', 'harga', 'segmen', 'deskripsi', 'kapasitas', 'aktif',
    ];

    protected function casts(): array
    {
        return ['harga' => 'integer', 'aktif' => 'boolean', 'kapasitas' => 'integer'];
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

    public function scopeJenis(Builder $query, string $jenis): Builder
    {
        return $query->where('jenis', $jenis);
    }

    /** Fasilitas yang dilekati — kosong untuk add-on dan paket. */
    public function sumberDayaRingkas(): ?array
    {
        return match (true) {
            $this->room_id !== null => ['jenis' => 'ruangan', 'id' => $this->room_id, 'nama' => $this->room?->nama ?? '—'],
            $this->laboratory_id !== null => ['jenis' => 'laboratorium', 'id' => $this->laboratory_id, 'nama' => $this->laboratory?->nama ?? '—'],
            default => null,
        };
    }
}
