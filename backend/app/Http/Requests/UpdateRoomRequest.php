<?php

namespace App\Http\Requests;

use App\Models\Room;
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
            'jenis' => ['nullable', 'string', 'max:40'],
            'gedung' => ['nullable', 'string', 'max:100'],
            'lantai' => ['nullable', 'string', 'max:20'],
            'luas_m2' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'kapasitas' => ['sometimes', 'integer', 'min:0', 'max:100000'],

            'skema_tarif' => ['sometimes', Rule::in(array_keys(Room::SKEMA_TARIF))],
            'tarif' => ['nullable', 'integer', 'min:0', 'max:1000000000000',
                'required_if:skema_tarif,berbayar'],

            'status' => ['sometimes', Rule::in(array_keys(Room::STATUS))],
            'perlu_persetujuan' => ['sometimes', 'boolean'],
            'penanggung_jawab_id' => ['nullable', 'integer', 'exists:users,id'],

            'tata_letak' => ['nullable', 'array', 'max:12'],
            'tata_letak.*' => ['string', 'max:40'],
            'fasilitas' => ['nullable', 'array', 'max:40'],
            'fasilitas.*' => ['string', 'max:60'],

            'keterangan' => ['nullable', 'string', 'max:2000'],
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
