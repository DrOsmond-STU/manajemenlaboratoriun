<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChecklistAnswer extends Model
{
    protected $fillable = ['checklist_run_id', 'checklist_item_id', 'nilai', 'lulus', 'catatan'];

    protected function casts(): array
    {
        return ['lulus' => 'boolean'];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(ChecklistRun::class, 'checklist_run_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(ChecklistItem::class, 'checklist_item_id');
    }
}
