<?php

namespace App\Http\Requests;

use App\Models\ChecklistAssignment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Penugasan checklist kepada seorang pengguna atas satu sumber daya.
 */
class StoreChecklistAssignmentRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'checklist_template_id' => ['required', 'integer', 'exists:checklist_templates,id'],
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'laboratory_id' => ['nullable', 'integer', 'exists:laboratories,id'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
            'periode' => ['nullable', Rule::in(array_keys(ChecklistAssignment::PERIODE))],
            'aktif' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Tepat satu sumber daya — diperiksa di sini agar pesannya terbaca
     * pengguna, dan tetap dijaga batasan basis data sebagai benteng terakhir.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $terisi = collect(['room_id', 'laboratory_id', 'asset_id'])
                    ->filter(fn ($k) => filled($this->input($k)))
                    ->count();

                if ($terisi !== 1) {
                    $validator->errors()->add(
                        'room_id',
                        'Checklist harus melekat pada TEPAT SATU sumber daya: ruangan, laboratorium, atau aset.',
                    );
                }
            },
        ];
    }
}
