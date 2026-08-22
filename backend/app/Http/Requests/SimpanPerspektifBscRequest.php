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

            // Sasaran strategis: pengelompokan indikator, tanpa bobotnya
            // sendiri (lihat migrasi bsc_objectives).
            'objectives' => ['present', 'array', 'max:10'],
            'objectives.*.nama' => ['required', 'string', 'max:200'],

            'objectives.*.indikator' => ['present', 'array', 'max:20'],
            'objectives.*.indikator.*.nama' => ['required', 'string', 'max:200'],
            'objectives.*.indikator.*.satuan' => ['nullable', 'string', 'max:30'],

            // Tanpa nilai bawaan. Bawaan apa pun akan benar untuk sebagian
            // indikator dan diam-diam salah untuk sisanya — dan yang salah
            // menghasilkan penghargaan bagi orang yang keliru.
            'objectives.*.indikator.*.polaritas' => ['required', Rule::in(array_keys(BscIndikator::POLARITAS))],

            'objectives.*.indikator.*.target' => ['required', 'numeric', 'not_in:0'],
            'objectives.*.indikator.*.realisasi' => ['nullable', 'numeric'],
            'objectives.*.indikator.*.bobot' => ['required', 'numeric', 'gt:0', 'max:100'],
            'objectives.*.indikator.*.catatan' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($v) {
            $objectives = (array) $this->input('objectives', []);

            // Bobot dijumlahkan lintas SELURUH sasaran dalam perspektif ini —
            // sasaran murni pengelompokan tampilan, bukan sub-kartu skor
            // sendiri. Aturannya sama persis dengan yang ditegakkan lagi oleh
            // pemicu batasan tertunda di basis data: 100 per perspektif,
            // bukan 100 per sasaran.
            $indikator = collect($objectives)->flatMap(fn ($o) => (array) ($o['indikator'] ?? []));

            if ($indikator->isEmpty()) {
                if (collect($objectives)->contains(fn ($o) => ($o['nama'] ?? '') !== '' && empty($o['indikator']))) {
                    $v->errors()->add('objectives', 'Sasaran strategis tanpa indikator tidak dapat disimpan.');
                }

                return;
            }

            $jumlah = round((float) $indikator->sum(fn ($i) => (float) ($i['bobot'] ?? 0)), 2);

            if ($jumlah !== 100.0) {
                $v->errors()->add(
                    'objectives',
                    'Bobot indikator dalam satu perspektif harus berjumlah 100, saat ini '.$jumlah.'.'
                );
            }

            $namaIndikator = $indikator->map(fn ($i) => mb_strtolower(trim((string) ($i['nama'] ?? ''))));

            if ($namaIndikator->count() !== $namaIndikator->unique()->count()) {
                $v->errors()->add('objectives', 'Nama indikator tidak boleh kembar dalam satu perspektif.');
            }

            $namaSasaran = collect($objectives)->map(fn ($o) => mb_strtolower(trim((string) ($o['nama'] ?? ''))));

            if ($namaSasaran->count() !== $namaSasaran->unique()->count()) {
                $v->errors()->add('objectives', 'Nama sasaran strategis tidak boleh kembar dalam satu perspektif.');
            }
        });
    }
}
