<?php

namespace App\Http\Requests;

use App\Models\EquipmentLoan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreEquipmentLoanRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'keperluan' => ['required', 'string', 'max:200'],
            'lokasi_pemakaian' => ['nullable', 'string', 'max:150'],
            'mulai' => ['required', 'date'],
            'selesai' => ['required', 'date', 'after:mulai'],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Pemeriksaan ketersediaan di sini hanya untuk memberi pesan lebih cepat.
     * Jaminan sesungguhnya tetap pemicu basis data — pemeriksaan ini punya
     * celah balapan dan tidak boleh diandalkan sendiri.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $bentrok = EquipmentLoan::query()
                    ->where('asset_id', $this->integer('asset_id'))
                    ->menahan()
                    ->bersinggungan($this->string('mulai'), $this->string('selesai'))
                    ->exists();

                if ($bentrok) {
                    $validator->errors()->add('mulai', 'Alat sudah dipinjam pada rentang waktu tersebut.');
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'asset_id' => 'alat',
            'mulai' => 'waktu mulai',
            'selesai' => 'waktu selesai',
            'lokasi_pemakaian' => 'lokasi pemakaian',
        ];
    }
}
