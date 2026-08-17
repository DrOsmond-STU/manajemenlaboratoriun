<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Perpindahan aset antar ruangan.
 *
 * `room_id` boleh `null` — barang yang ditarik dari ruangan, misalnya sedang
 * diperbaiki di luar atau menunggu penghapusan, tetap perlu tercatat
 * perpindahannya. Karena itu `present`, bukan `required`: kuncinya wajib ada,
 * isinya boleh kosong, sehingga "tidak mengirim apa-apa" tidak diam-diam
 * diartikan sebagai "keluarkan dari ruangan".
 */
class MutasiAssetRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'room_id' => ['present', 'nullable', 'integer', 'exists:rooms,id'],
            'catatan' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'room_id.present' => 'Ruangan tujuan harus disertakan (boleh kosong bila aset ditarik dari ruangan).',
            'room_id.exists' => 'Ruangan tujuan tidak ditemukan.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['room_id' => 'ruangan tujuan'];
    }
}
