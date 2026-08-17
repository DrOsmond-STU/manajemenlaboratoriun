<?php

namespace App\Http\Requests;

use App\Models\Booking;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreBookingRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'room_id' => ['required', 'integer', 'exists:rooms,id'],
            'keperluan' => ['required', 'string', 'max:200'],
            'jumlah_peserta' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'mulai' => ['required', 'date'],
            'selesai' => ['required', 'date', 'after:mulai'],
            'catatan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Validasi ketersediaan di sini hanya untuk memberi pesan lebih cepat dan
     * lebih ramah. Jaminan sesungguhnya tetap batasan eksklusi di basis data —
     * pemeriksaan ini punya celah balapan dan tidak boleh diandalkan sendiri.
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $bentrok = Booking::query()
                    ->where('room_id', $this->integer('room_id'))
                    ->aktif()
                    ->bersinggungan($this->string('mulai'), $this->string('selesai'))
                    ->exists();

                if ($bentrok) {
                    $validator->errors()->add('mulai', 'Ruangan sudah dipakai pada rentang waktu tersebut.');
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
            'room_id' => 'ruangan',
            'mulai' => 'waktu mulai',
            'selesai' => 'waktu selesai',
            'jumlah_peserta' => 'jumlah peserta',
        ];
    }
}
