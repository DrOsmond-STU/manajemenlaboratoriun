<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sasaran strategis: pengelompokan indikator kinerja di dalam satu
 * perspektif BSC. Tidak berbobot sendiri — lihat migrasinya.
 */
class BscObjective extends Model
{
    use HasFactory;

    protected $table = 'bsc_objectives';

    protected $fillable = ['perspektif', 'periode', 'nama', 'urutan'];

    protected function casts(): array
    {
        return ['urutan' => 'integer'];
    }

    public function indikator(): HasMany
    {
        return $this->hasMany(BscIndikator::class)->orderBy('urutan');
    }

    public function scopePeriode(Builder $query, string $periode): Builder
    {
        return $query->where('periode', $periode);
    }
}
