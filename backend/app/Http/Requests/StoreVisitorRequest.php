<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreVisitorRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'nama' => ['required', 'string', 'max:150'],
            'instansi' => ['nullable', 'string', 'max:150'],
            'tujuan' => ['nullable', 'string', 'max:255'],
            'host_id' => ['nullable', 'integer', 'exists:users,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'tanggal' => ['required', 'date'],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'host_id' => 'host / PIC',
            'room_id' => 'ruangan',
        ];
    }
}
