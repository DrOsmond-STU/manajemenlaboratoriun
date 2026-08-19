<?php

namespace App\Http\Requests;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Permintaan masuk.
 *
 * Tiga hal yang wajib benar di sini, dan ketiganya mudah terlewat karena
 * kegagalannya tidak terlihat saat dicoba manual:
 *
 *   1. PESAN GALAT SERAGAM. "Surel tidak terdaftar" dan "sandi salah" harus
 *      menghasilkan pesan yang sama persis. Membedakannya mengubah borang
 *      masuk menjadi alat pemeriksa keanggotaan: siapa pun dapat menebak-nebak
 *      surel dan mengetahui mana yang terdaftar.
 *
 *   2. PEMBATASAN PERCOBAAN. Tanpa itu, sandi dapat ditebak sebanyak-banyaknya
 *      tanpa hambatan. Dibatasi per kombinasi surel + alamat IP, sehingga satu
 *      penyerang tidak dapat mengunci akun orang lain hanya dengan
 *      menggagalkan percobaan berulang kali dari IP-nya sendiri.
 *
 *   3. PEMBERSIHAN PEMBATAS SETELAH BERHASIL. Bila tidak, pengguna yang sempat
 *      salah ketik beberapa kali akan tetap terhitung mendekati batas.
 */
class LoginRequest extends FormRequest
{
    /** Percobaan gagal yang diizinkan sebelum ditahan. */
    private const BATAS_PERCOBAAN = 5;

    /** Lama penahanan, dalam detik. */
    private const LAMA_TAHAN = 60;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * @throws ValidationException
     */
    public function autentikasi(): void
    {
        $this->pastikanBelumDitahan();

        if (! Auth::attempt($this->only('email', 'password'), $this->boolean('ingat'))) {
            RateLimiter::hit($this->kunciPembatas(), self::LAMA_TAHAN);

            // Pesan sengaja tidak menyebut mana yang salah.
            throw ValidationException::withMessages([
                'email' => 'Surel atau kata sandi tidak cocok.',
            ]);
        }

        RateLimiter::clear($this->kunciPembatas());
    }

    /**
     * @throws ValidationException
     */
    private function pastikanBelumDitahan(): void
    {
        if (! RateLimiter::tooManyAttempts($this->kunciPembatas(), self::BATAS_PERCOBAAN)) {
            return;
        }

        Event::dispatch(new Lockout($this));

        $detik = RateLimiter::availableIn($this->kunciPembatas());

        throw ValidationException::withMessages([
            'email' => "Terlalu banyak percobaan masuk. Coba lagi dalam {$detik} detik.",
        ]);
    }

    private function kunciPembatas(): string
    {
        return 'masuk:'.Str::transliterate(Str::lower($this->string('email')).'|'.$this->ip());
    }
}
