<?php

namespace App\Models;

use App\Models\Concerns\Diaudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu indikator kinerja dalam Balanced Scorecard.
 *
 * Realisasinya disimpan pada barisnya sendiri, bukan pada tabel riwayat
 * terpisah — riwayat "siapa mengubah realisasi dari berapa menjadi berapa"
 * sudah dipikul jejak audit, yang tidak dapat disunting siapa pun. Tabel
 * riwayat buatan sendiri justru lebih lemah: ia dapat disunting.
 */
class BscIndikator extends Model
{
    use Diaudit, HasFactory;

    protected $table = 'bsc_indikator';

    public const PERSPEKTIF = [
        'keuangan' => 'Keuangan',
        'pelanggan' => 'Pelanggan',
        'proses-internal' => 'Proses Bisnis Internal',
        'pembelajaran' => 'Pembelajaran & Pertumbuhan',
    ];

    public const POLARITAS = [
        'naik-baik' => 'Semakin tinggi semakin baik',
        'turun-baik' => 'Semakin rendah semakin baik',
    ];

    protected $fillable = [
        'perspektif', 'periode', 'bsc_objective_id', 'nama', 'satuan', 'polaritas',
        'target', 'realisasi', 'bobot', 'urutan', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'target' => 'float',
            'realisasi' => 'float',
            'bobot' => 'float',
            'urutan' => 'integer',
        ];
    }

    /** @return list<string> */
    public function kolomDiaudit(): array
    {
        // Target dan bobot menentukan bagaimana kinerja dinilai; realisasi
        // adalah angka yang dinilai. Ketiganya adalah yang akan dipersoalkan
        // orang bila skornya diragukan.
        return ['perspektif', 'periode', 'nama', 'polaritas', 'target', 'realisasi', 'bobot'];
    }

    public function labelAudit(): ?string
    {
        return $this->nama;
    }

    /**
     * Capaian dalam persen, dengan arah indikator diperhitungkan.
     *
     * Indikator turun-baik — jumlah keluhan, waktu henti alat, temuan audit —
     * dinilai terbalik. Rumus yang selalu realisasi/target akan menilai
     * penurunan keluhan sebagai kegagalan dan kenaikan keluhan sebagai
     * prestasi, lalu memberi penghargaan kepada orang yang salah.
     */
    public function capaian(): ?float
    {
        if ($this->realisasi === null) {
            return null;
        }

        // Target nol ditolak batasan basis data, jadi pembagiannya aman.
        $rasio = $this->polaritas === 'turun-baik'
            ? ($this->realisasi == 0.0 ? null : $this->target / $this->realisasi)
            : $this->realisasi / $this->target;

        // Realisasi nol pada indikator turun-baik berarti sempurna: nol
        // keluhan tidak boleh menjadi "tidak terdefinisi".
        $rasio ??= $this->polaritas === 'turun-baik' ? 1.0 : 0.0;

        return round($rasio * 100, 2);
    }

    /**
     * Capaian yang dibatasi untuk perhitungan skor.
     *
     * Dibatasi di 120%, bukan dibiarkan bebas: satu indikator yang tercapai
     * 900% — biasanya karena targetnya salah tulis, bukan karena kinerja
     * sembilan kali lipat — akan menutupi seluruh perspektif yang gagal.
     * Angka aslinya tetap dilaporkan apa adanya lewat capaian().
     */
    public function capaianTerbatas(): ?float
    {
        $capaian = $this->capaian();

        return $capaian === null ? null : min($capaian, 120.0);
    }

    public function scopePeriode(Builder $query, string $periode): Builder
    {
        return $query->where('periode', $periode);
    }

    public function objective(): BelongsTo
    {
        return $this->belongsTo(BscObjective::class, 'bsc_objective_id');
    }
}
