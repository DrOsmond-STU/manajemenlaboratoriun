<?php

namespace App\Http\Requests;

use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Pengembalian alat.
 *
 * `kondisi` sengaja opsional: petugas yang belum sempat memeriksa lebih baik
 * mengembalikan tanpa menyebut kondisi daripada asal memilih "Baik" supaya
 * borangnya lolos. Kondisi yang dikarang lebih berbahaya daripada kondisi
 * yang belum diisi.
 */
class KembalikanPinjamanRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'kondisi' => ['nullable', Rule::in(array_keys(Asset::KONDISI))],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
