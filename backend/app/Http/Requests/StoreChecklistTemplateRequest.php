<?php

namespace App\Http\Requests;

use App\Models\ChecklistItem;
use App\Models\ChecklistTemplate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Templat checklist beserta butirnya, dibuat dalam satu permintaan.
 *
 * Butir disertakan sekaligus, bukan lewat endpoint terpisah, karena templat
 * tanpa butir tidak berguna sama sekali — memisahkannya hanya membuka peluang
 * templat setengah jadi tersimpan dan terlupakan.
 */
class StoreChecklistTemplateRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'nama' => ['required', 'string', 'max:150'],
            'jenis' => ['required', Rule::in(array_keys(ChecklistTemplate::JENIS))],
            'deskripsi' => ['nullable', 'string', 'max:2000'],
            'aktif' => ['nullable', 'boolean'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.teks' => ['required', 'string', 'max:300'],
            'items.*.tipe' => ['nullable', Rule::in(array_keys(ChecklistItem::TIPE))],
            'items.*.wajib' => ['nullable', 'boolean'],
            'items.*.satuan' => ['nullable', 'string', 'max:20'],
            'items.*.petunjuk' => ['nullable', 'string', 'max:500'],
            'items.*.pilihan' => ['nullable', 'array', 'max:20'],
            'items.*.pilihan.*' => ['string', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'Templat harus memiliki minimal satu butir.',
            'items.min' => 'Templat harus memiliki minimal satu butir.',
        ];
    }
}
