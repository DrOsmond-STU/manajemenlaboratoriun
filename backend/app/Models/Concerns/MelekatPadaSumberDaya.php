<?php

namespace App\Models\Concerns;

use App\Models\Asset;
use App\Models\Laboratory;
use App\Models\Room;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Melekat pada tepat satu dari: ruangan, laboratorium, atau aset.
 *
 * Dipakai penugasan dan pelaksanaan checklist. Bentuknya tiga kunci asing
 * yang boleh kosong dengan batasan `num_nonnulls(...) = 1` di basis data —
 * bukan relasi polimorfik — supaya integritas acuannya tetap utuh. Lihat
 * migrasi checklist untuk alasan lengkapnya.
 */
trait MelekatPadaSumberDaya
{
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function laboratory(): BelongsTo
    {
        return $this->belongsTo(Laboratory::class);
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    /** Sumber daya yang dilekati, apa pun jenisnya. */
    public function sumberDaya(): Room|Laboratory|Asset|null
    {
        return $this->room ?? $this->laboratory ?? $this->asset;
    }

    /** @return array{jenis: string, id: int, nama: string}|null */
    public function sumberDayaRingkas(): ?array
    {
        return match (true) {
            $this->room_id !== null => ['jenis' => 'ruangan', 'id' => $this->room_id, 'nama' => $this->room?->nama ?? '—'],
            $this->laboratory_id !== null => ['jenis' => 'laboratorium', 'id' => $this->laboratory_id, 'nama' => $this->laboratory?->nama ?? '—'],
            $this->asset_id !== null => ['jenis' => 'aset', 'id' => $this->asset_id, 'nama' => $this->asset?->nama ?? '—'],
            default => null,
        };
    }

    public function scopeUntukSumberDaya(Builder $query, string $jenis, int $id): Builder
    {
        return $query->where(match ($jenis) {
            'ruangan' => 'room_id',
            'laboratorium' => 'laboratory_id',
            default => 'asset_id',
        }, $id);
    }
}
