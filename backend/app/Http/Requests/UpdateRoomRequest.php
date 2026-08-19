<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRoomRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $id = $this->route('room')?->id;

        return [
            'kode' => ['sometimes', 'string', 'max:32', Rule::unique('rooms', 'kode')->ignore($id)->withoutTrashed()],
            'nama' => ['sometimes', 'string', 'max:150'],
            'gedung' => ['nullable', 'string', 'max:100'],
            'lantai' => ['nullable', 'string', 'max:20'],
            'kapasitas' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'status' => ['sometimes', Rule::in(['tersedia', 'pemeliharaan', 'tidak_aktif'])],
            'perlu_persetujuan' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'kode.unique' => 'Kode ruangan sudah dipakai ruangan lain.',
        ];
    }
}
