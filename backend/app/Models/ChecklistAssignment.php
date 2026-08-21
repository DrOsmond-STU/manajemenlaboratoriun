<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Penugasan checklist: templat × sumber daya × penanggung jawab.
 *
 * Inilah yang membuat seseorang tahu apa yang harus dikerjakannya hari ini —
 * "checklist melekat pada user" pada dokumen fitur.
 */
class ChecklistAssignment extends Model
{
    use Concerns\MelekatPadaSumberDaya, HasFactory;

    public const PERIODE = [
        'harian' => 'Harian',
        'mingguan' => 'Mingguan',
        'bulanan' => 'Bulanan',
        'triwulanan' => 'Triwulanan',
        'tahunan' => 'Tahunan',
        'insidental' => 'Insidental',
    ];

    protected $fillable = [
        'checklist_template_id', 'room_id', 'laboratory_id', 'asset_id',
        'user_id', 'periode', 'aktif',
    ];

    protected function casts(): array
    {
        return ['aktif' => 'boolean'];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'checklist_template_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->where('aktif', true);
    }
}
