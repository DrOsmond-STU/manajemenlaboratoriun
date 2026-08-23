<?php

namespace App\Http\Requests;

use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetAuditScanRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'kode' => ['required', 'string', 'max:150'],
            'lokasi_ditemukan' => ['nullable', 'string', 'max:200'],
            'kondisi_ditemukan' => ['nullable', 'string', Rule::in(array_keys(Asset::KONDISI))],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'lokasi_ditemukan' => 'lokasi ditemukan',
            'kondisi_ditemukan' => 'kondisi ditemukan',
        ];
    }
}
