<?php

namespace App\Http\Requests;

use App\Models\Room;
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
            'jenis' => ['nullable', 'string', 'max:40'],
            'gedung' => ['nullable', 'string', 'max:100'],
            'lantai' => ['nullable', 'string', 'max:20'],
            'luas_m2' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'kapasitas' => ['nullable', 'integer', 'min:0', 'max:100000'],

            'skema_tarif' => ['nullable', Rule::in(array_keys(Room::SKEMA_TARIF))],
            // Ruangan berbayar tanpa tarif adalah ruangan yang akan
            // ditagihkan dengan angka yang belum ada. Ditolak di sini untuk
            // pesan yang terbaca, dan ditegakkan lagi oleh batasan CHECK di
            // basis data — yang berlaku juga bagi jalur yang tidak lewat sini.
            'tarif' => ['nullable', 'integer', 'min:0', 'max:1000000000000',
                'required_if:skema_tarif,berbayar'],

            'status' => ['nullable', Rule::in(array_keys(Room::STATUS))],
            'perlu_persetujuan' => ['nullable', 'boolean'],
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
            'status.in' => 'Status ruangan harus tersedia, pemeliharaan, atau tidak_aktif.',
        ];
    }
}
