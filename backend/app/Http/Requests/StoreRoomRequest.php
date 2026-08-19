<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoomRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'kode' => ['required', 'string', 'max:32', Rule::unique('rooms', 'kode')->withoutTrashed()],
            'nama' => ['required', 'string', 'max:150'],
            'gedung' => ['nullable', 'string', 'max:100'],
            'lantai' => ['nullable', 'string', 'max:20'],
            'kapasitas' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'status' => ['nullable', Rule::in(['tersedia', 'pemeliharaan', 'tidak_aktif'])],
            'perlu_persetujuan' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'kode.unique' => 'Kode ruangan sudah dipakai ruangan lain.',
            'status.in' => 'Status ruangan harus tersedia, pemeliharaan, atau tidak_aktif.',
        ];
    }
}
