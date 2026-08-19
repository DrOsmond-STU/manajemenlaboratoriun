<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * Ganti kata sandi sendiri.
 *
 * `current_password` wajib: tanpa itu, siapa pun yang menemukan perangkat
 * dalam keadaan masih masuk dapat mengunci pemilik aslinya dari akunnya
 * sendiri hanya dengan mengganti sandi.
 */
class UbahSandiRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'sandi_sekarang' => ['required', 'current_password'],
            'sandi_baru' => [
                'required', 'confirmed', 'different:sandi_sekarang',
                Password::defaults(),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'sandi_sekarang.current_password' => 'Kata sandi sekarang tidak cocok.',
            'sandi_baru.different' => 'Kata sandi baru harus berbeda dari yang sekarang.',
            'sandi_baru.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'sandi_sekarang' => 'kata sandi sekarang',
            'sandi_baru' => 'kata sandi baru',
        ];
    }
}
