<?php

namespace App\Http\Requests;

use App\Models\AssetMaintenance;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaintenanceRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'jenis' => ['required', Rule::in(array_keys(AssetMaintenance::JENIS))],
            'jadwal' => ['required', 'date'],
            'pelaksana' => ['nullable', 'string', 'max:150'],
            'petugas_id' => ['nullable', 'integer', 'exists:users,id'],
            'lembaga_kalibrasi' => ['nullable', 'string', 'max:150'],
            'biaya' => ['nullable', 'integer', 'min:0', 'max:999999999999'],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'asset_id' => 'alat',
            'lembaga_kalibrasi' => 'lembaga kalibrasi',
        ];
    }
}
