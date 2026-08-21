<?php

namespace App\Models;

use App\Support\RegistriWidget;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DashboardWidget extends Model
{
    use HasFactory;

    protected $fillable = [
        'dashboard_id', 'widget', 'judul', 'bentuk', 'opsi',
        'kolom', 'baris', 'lebar', 'tinggi',
    ];

    protected function casts(): array
    {
        return [
            'opsi' => 'array',
            'kolom' => 'integer', 'baris' => 'integer',
            'lebar' => 'integer', 'tinggi' => 'integer',
        ];
    }

    public function dashboard(): BelongsTo
    {
        return $this->belongsTo(Dashboard::class);
    }

    /** Judul pilihan pengguna bila ada, selebihnya bawaan registri. */
    public function judulTampil(): string
    {
        return $this->judul
            ?: (RegistriWidget::keterangan($this->widget)['judul'] ?? $this->widget);
    }

    public function bentukTampil(): string
    {
        return $this->bentuk
            ?: (RegistriWidget::keterangan($this->widget)['bentuk'] ?? 'angka');
    }
}
