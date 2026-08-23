<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVendorRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $id = $this->route('vendor')?->id;

        return [
            'kode' => ['sometimes', 'string', 'max:32', Rule::unique('vendors', 'kode')->ignore($id)],
            'nama' => ['sometimes', 'string', 'max:200'],
            'kategori' => ['sometimes', 'string', 'max:100'],
            'pic_nama' => ['nullable', 'string', 'max:150'],
            'pic_telepon' => ['nullable', 'string', 'max:32'],
            'pic_email' => ['nullable', 'email', 'max:150'],
            'rating' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'kontrak_berlaku_sampai' => ['nullable', 'date'],
            'aktif' => ['sometimes', 'boolean'],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'pic_nama' => 'nama PIC',
            'pic_telepon' => 'telepon PIC',
            'pic_email' => 'email PIC',
            'kontrak_berlaku_sampai' => 'kontrak berlaku sampai',
        ];
    }
}
