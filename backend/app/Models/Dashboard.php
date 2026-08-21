<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dashboard extends Model
{
    use HasFactory;

    public const JENIS = [
        'operasional' => 'Operasional',
        'analitik' => 'Analitik',
        'bsc' => 'Balanced Scorecard',
    ];

    protected $fillable = ['nama', 'user_id', 'jenis', 'utama'];

    protected function casts(): array
    {
        return ['utama' => 'boolean'];
    }

    public function widgets(): HasMany
    {
        return $this->hasMany(DashboardWidget::class)->orderBy('baris')->orderBy('kolom');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bersama(): bool
    {
        return $this->user_id === null;
    }

    /**
     * Dashboard yang boleh dilihat seseorang: miliknya sendiri, ditambah
     * dashboard bersama.
     *
     * Dashboard pribadi orang lain tidak pernah masuk. Susunan dashboard
     * seseorang memperlihatkan apa yang sedang diawasinya — itu bukan
     * informasi yang perlu dibagi.
     */
    public function scopeTerlihatOleh(Builder $query, User $pengguna): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->whereNull('user_id')
            ->orWhere('user_id', $pengguna->id));
    }
}
