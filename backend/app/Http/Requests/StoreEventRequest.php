<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEventRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'nama' => ['required', 'string', 'max:200'],
            'jenis' => ['nullable', 'string', 'max:100'],
            'organizer' => ['nullable', 'string', 'max:150'],
            'pic_id' => ['nullable', 'integer', 'exists:users,id'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'tanggal' => ['required', 'date'],
            'jumlah_peserta' => ['nullable', 'integer', 'min:0'],
            'anggaran' => ['nullable', 'integer', 'min:0'],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'pic_id' => 'PIC',
            'room_id' => 'venue / ruangan',
            'jumlah_peserta' => 'jumlah peserta',
        ];
    }
}
