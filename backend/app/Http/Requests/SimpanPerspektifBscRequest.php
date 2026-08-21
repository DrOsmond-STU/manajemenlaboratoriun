<?php

namespace App\Http\Requests;

use App\Models\BscIndikator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SimpanPerspektifBscRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'periode' => ['required', 'string', 'regex:/^\d{4}(-Q[1-4])?$/'],
            'perspektif' => ['required', Rule::in(array_keys(BscIndikator::PERSPEKTIF))],

            'indikator' => ['present', 'array', 'max:20'],
            'indikator.*.nama' => ['required', 'string', 'max:200'],
            'indikator.*.satuan' => ['nullable', 'string', 'max:30'],

            // Tanpa nilai bawaan. Bawaan apa pun akan benar untuk sebagian
            // indikator dan diam-diam salah untuk sisanya — dan yang salah
            // menghasilkan penghargaan bagi orang yang keliru.
            'indikator.*.polaritas' => ['required', Rule::in(array_keys(BscIndikator::POLARITAS))],

            'indikator.*.target' => ['required', 'numeric', 'not_in:0'],
            'indikator.*.realisasi' => ['nullable', 'numeric'],
            'indikator.*.bobot' => ['required', 'numeric', 'gt:0', 'max:100'],
            'indikator.*.catatan' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($v) {
            $indikator = (array) $this->input('indikator', []);

            if ($indikator === []) {
                return;
            }

            // Diperiksa di sini untuk pesan yang terbaca, dan DITEGAKKAN LAGI
            // oleh pemicu batasan tertunda di basis data — yang berlaku pada
            // jalur mana pun, termasuk seeder, impor, dan perbaikan manual
            // lewat psql.
            $jumlah = round(array_sum(array_map(
                fn ($i) => (float) ($i['bobot'] ?? 0),
                $indikator,
            )), 2);

            if ($jumlah !== 100.0) {
                $v->errors()->add(
                    'indikator',
                    'Bobot indikator dalam satu perspektif harus berjumlah 100, saat ini '.$jumlah.'.'
                );
            }

            $nama = array_map(fn ($i) => mb_strtolower(trim((string) ($i['nama'] ?? ''))), $indikator);

            if (count($nama) !== count(array_unique($nama))) {
                $v->errors()->add('indikator', 'Nama indikator tidak boleh kembar dalam satu perspektif.');
            }
        });
    }
}
