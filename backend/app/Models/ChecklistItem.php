<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChecklistItem extends Model
{
    use HasFactory;

    public const TIPE = [
        'ya_tidak' => 'Ya / Tidak',
        'angka' => 'Angka',
        'teks' => 'Teks bebas',
        'pilihan' => 'Pilihan',
    ];

    protected $fillable = [
        'checklist_template_id', 'urutan', 'teks', 'tipe', 'wajib', 'pilihan', 'satuan', 'petunjuk',
    ];

    protected function casts(): array
    {
        return [
            'wajib' => 'boolean',
            'urutan' => 'integer',
            'pilihan' => 'array',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'checklist_template_id');
    }

    /**
     * Apakah jawaban ini dianggap lulus.
     *
     * Hanya butir ya_tidak yang punya makna lulus/gagal. Butir angka dan teks
     * bersifat mencatat, bukan menilai — memaksakan penilaian padanya akan
     * membuat skor kehilangan arti.
     */
    public function menilaiLulus(?string $nilai): ?bool
    {
        if ($this->tipe !== 'ya_tidak' || $nilai === null) {
            return null;
        }

        return in_array(mb_strtolower($nilai), ['ya', 'true', '1', 'ok', 'sesuai'], true);
    }
}
