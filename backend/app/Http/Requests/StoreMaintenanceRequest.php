<?php

namespace App\Http\Requests;

use App\Models\AssetMaintenance;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreMaintenanceRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'laboratory_id' => ['nullable', 'integer', 'exists:laboratories,id'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],

            'jenis' => ['required', Rule::in(array_keys(AssetMaintenance::JENIS))],
            'jadwal' => ['required', 'date'],
            'pelaksana' => ['nullable', 'string', 'max:150'],
            'petugas_id' => ['nullable', 'integer', 'exists:users,id'],
            'lembaga_kalibrasi' => ['nullable', 'string', 'max:150'],
            'biaya' => ['nullable', 'integer', 'min:0', 'max:999999999999'],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($v) {
            $terisi = collect(['room_id', 'laboratory_id', 'asset_id'])
                ->filter(fn ($k) => $this->filled($k));

            if ($terisi->count() !== 1) {
                $v->errors()->add('asset_id', 'Pilih tepat satu: ruangan, laboratorium, atau alat.');

                return;
            }

            // Ditegakkan lagi oleh batasan CHECK di basis data — di sini
            // supaya pesannya terbaca, bukan berupa galat SQL.
            if ($this->input('jenis') === AssetMaintenance::JENIS_KALIBRASI && ! $this->filled('asset_id')) {
                $v->errors()->add('asset_id', 'Kalibrasi hanya berlaku untuk alat, bukan ruangan atau laboratorium.');
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'asset_id' => 'alat',
            'room_id' => 'ruangan',
            'laboratory_id' => 'laboratorium',
            'lembaga_kalibrasi' => 'lembaga kalibrasi',
        ];
    }
}
