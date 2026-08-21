<?php

namespace App\Http\Requests;

use App\Models\Laboratory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLaboratoryRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'kode' => ['required', 'string', 'max:32', Rule::unique('laboratories', 'kode')->withoutTrashed()],
            'nama' => ['required', 'string', 'max:150'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'jenis' => ['nullable', 'string', 'max:50'],
            'unit_kerja' => ['nullable', 'string', 'max:100'],
            'luas_m2' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'kapasitas' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'jam_layanan' => ['nullable', 'string', 'max:60'],
            'akreditasi' => ['nullable', 'string', 'max:100'],

            'fasilitas' => ['nullable', 'array', 'max:40'],
            'fasilitas.*' => ['string', 'max:60'],

            // Daftar teknisi dikirim utuh, bukan ditambah/dikurangi satu per
            // satu. Penugasan adalah keadaan sekarang, bukan riwayat: mengirim
            // daftar lengkap membuat "siapa saja teknisinya" selalu punya satu
            // jawaban, sementara operasi tambah/hapus terpisah dapat berselisih
            // bila dua orang menyunting bersamaan.
            'teknisi_ids' => ['nullable', 'array', 'max:30'],
            'teknisi_ids.*' => ['integer', 'distinct', 'exists:users,id'],
            'status' => ['nullable', Rule::in(array_keys(Laboratory::STATUS))],
            'penanggung_jawab_id' => ['nullable', 'integer', 'exists:users,id'],
            'supervisor_id' => ['nullable', 'integer', 'exists:users,id'],
            'keterangan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'kode.unique' => 'Kode laboratorium sudah dipakai laboratorium lain.',
        ];
    }
}
