<?php

namespace App\Http\Requests;

use App\Models\Dashboard;
use App\Support\RegistriWidget;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Menyimpan susunan dashboard secara utuh.
 *
 * Seluruh daftar widget dikirim sekaligus, bukan satu per satu, karena
 * seret-lepas memindahkan banyak widget dalam satu gerakan. Menyimpannya
 * satu-satu berarti tata letak sempat berada dalam keadaan setengah jadi bila
 * jaringan putus di tengah — dan yang dilihat pengguna berikutnya adalah
 * susunan yang tidak pernah dimaksudkan siapa pun.
 */
class SimpanDashboardRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'nama' => ['required', 'string', 'max:120'],
            'jenis' => ['sometimes', Rule::in(array_keys(Dashboard::JENIS))],
            'utama' => ['sometimes', 'boolean'],

            'widgets' => ['present', 'array', 'max:40'],

            // Daftar putih, bukan teks bebas. Alasan lengkapnya ada di
            // RegistriWidget: kunci bebas berarti kueri bebas, dan kueri
            // bebas menembus pembatasan cakupan data seluruh aplikasi.
            'widgets.*.widget' => ['required', 'string', Rule::in(RegistriWidget::kunci())],

            'widgets.*.judul' => ['nullable', 'string', 'max:120'],
            'widgets.*.bentuk' => ['nullable', Rule::in(RegistriWidget::BENTUK)],

            // Opsi penyajian saja, dan hanya yang dikenal. Kunci lain
            // dibuang diam-diam oleh controller — bukan ditolak — supaya
            // versi antarmuka yang lebih baru tidak menumbangkan penyimpanan.
            'widgets.*.opsi' => ['nullable', 'array'],
            'widgets.*.opsi.hari' => ['nullable', 'integer', 'between:1,365'],
            'widgets.*.opsi.batas' => ['nullable', 'integer', 'between:1,50'],

            // Geometri divalidasi di sini untuk pesan yang terbaca, dan
            // ditegakkan lagi oleh batasan CHECK di basis data — yang berlaku
            // juga bagi jalur yang tidak lewat sini sama sekali.
            'widgets.*.kolom' => ['required', 'integer', 'between:0,11'],
            'widgets.*.baris' => ['required', 'integer', 'between:0,200'],
            'widgets.*.lebar' => ['required', 'integer', 'between:1,12'],
            'widgets.*.tinggi' => ['required', 'integer', 'between:1,12'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($v) {
            foreach ((array) $this->input('widgets', []) as $i => $w) {
                $kolom = (int) ($w['kolom'] ?? 0);
                $lebar = (int) ($w['lebar'] ?? 0);

                if ($kolom + $lebar > 12) {
                    $v->errors()->add(
                        "widgets.{$i}.lebar",
                        'Widget menjorok keluar kisi 12 kolom (kolom '.$kolom.' + lebar '.$lebar.').'
                    );
                }
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'widgets.*.widget.in' => 'Widget tidak dikenal. Widget hanya dapat dipilih dari daftar yang tersedia.',
        ];
    }
}
