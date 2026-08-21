<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class MulaiChecklistRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'checklist_template_id' => ['required', 'integer', 'exists:checklist_templates,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'laboratory_id' => ['nullable', 'integer', 'exists:laboratories,id'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
        ];
    }

    /**
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
                        'Pelaksanaan harus menyebut TEPAT SATU sumber daya yang diperiksa.',
                    );
                }
            },
        ];
    }

    /**
     * @return array<string,int>
     */
    public function sumberDaya(): array
    {
        return collect(['room_id', 'laboratory_id', 'asset_id'])
            ->filter(fn ($k) => filled($this->input($k)))
            ->mapWithKeys(fn ($k) => [$k => (int) $this->input($k)])
            ->all();
    }
}
