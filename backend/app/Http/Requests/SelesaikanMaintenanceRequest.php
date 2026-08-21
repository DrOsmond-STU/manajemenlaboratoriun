<?php

namespace App\Http\Requests;

use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Penyelesaian pemeliharaan/kalibrasi.
 *
 * Kelengkapan khusus kalibrasi — nomor sertifikat dan masa berlaku —
 * ditegakkan di MaintenanceService, bukan di sini, karena bergantung pada
 * jenis pekerjaan yang sudah tersimpan dan bukan pada isi permintaan.
 */
class SelesaikanMaintenanceRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'dikerjakan_pada' => ['nullable', 'date', 'before_or_equal:today'],
            'hasil' => ['nullable', 'string', 'max:2000'],
            'biaya' => ['nullable', 'integer', 'min:0', 'max:999999999999'],
            'pelaksana' => ['nullable', 'string', 'max:150'],
            'kondisi_setelah' => ['nullable', Rule::in(array_keys(Asset::KONDISI))],

            'no_sertifikat' => ['nullable', 'string', 'max:100'],
            'lembaga_kalibrasi' => ['nullable', 'string', 'max:150'],
            'berlaku_sampai' => ['nullable', 'date', 'after:today'],

            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'berlaku_sampai.after' => 'Masa berlaku kalibrasi harus di masa depan.',
            'dikerjakan_pada.before_or_equal' => 'Tanggal pengerjaan tidak boleh di masa depan.',
        ];
    }
}
