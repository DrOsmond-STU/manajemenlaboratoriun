<?php

namespace App\Services;

use App\Models\Booking;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingService
{
    /**
     * SQLSTATE PostgreSQL untuk pelanggaran batasan eksklusi.
     * Dipakai untuk membedakan bentrok jadwal dari galat basis data lain,
     * sehingga galat sesungguhnya tidak ikut tersamarkan menjadi pesan bentrok.
     */
    private const SQLSTATE_EXCLUSION_VIOLATION = '23P01';

    /**
     * Simpan pemesanan. Bentrok jadwal dikembalikan sebagai galat validasi biasa
     * agar antarmuka tidak perlu menangani galat basis data.
     *
     * @param  array<string,mixed>  $data
     *
     * @throws ValidationException bila slot sudah terisi
     */
    public function buat(array $data): Booking
    {
        try {
            return DB::transaction(fn () => Booking::create($data));
        } catch (QueryException $e) {
            throw $this->terjemahkanBentrok($e, $data);
        }
    }

    /**
     * @param  array<string,mixed>  $data
     *
     * @throws ValidationException bila slot sudah terisi
     */
    public function ubahJadwal(Booking $booking, array $data): Booking
    {
        try {
            return DB::transaction(function () use ($booking, $data) {
                $booking->update($data);

                return $booking->refresh();
            });
        } catch (QueryException $e) {
            throw $this->terjemahkanBentrok($e, $data);
        }
    }

    /**
     * Ubah pelanggaran batasan eksklusi menjadi ValidationException berbahasa
     * pengguna; galat lain diteruskan apa adanya.
     *
     * @param  array<string,mixed>  $data
     */
    private function terjemahkanBentrok(QueryException $e, array $data): \Throwable
    {
        if (($e->getCode() !== self::SQLSTATE_EXCLUSION_VIOLATION)
            && ! str_contains($e->getMessage(), 'bookings_no_overlap')) {
            return $e;
        }

        $bentrok = isset($data['room_id'], $data['mulai'], $data['selesai'])
            ? $this->cariBentrok((int) $data['room_id'], (string) $data['mulai'], (string) $data['selesai'])
            : null;

        $pesan = $bentrok
            ? sprintf(
                'Ruangan sudah dipakai %s–%s untuk “%s”. Silakan pilih waktu atau ruangan lain.',
                $bentrok->mulai->timezone(config('app.timezone'))->format('d/m/Y H:i'),
                $bentrok->selesai->timezone(config('app.timezone'))->format('H:i'),
                $bentrok->keperluan,
            )
            : 'Ruangan sudah dipakai pada rentang waktu tersebut. Silakan pilih waktu atau ruangan lain.';

        return ValidationException::withMessages(['mulai' => $pesan]);
    }

    /**
     * Ambil pemesanan yang menyebabkan bentrok, untuk pesan yang menjelaskan.
     * Dijalankan setelah penulisan gagal, jadi tidak menambah celah balapan.
     */
    private function cariBentrok(int $roomId, string $mulai, string $selesai): ?Booking
    {
        return Booking::query()
            ->where('room_id', $roomId)
            ->aktif()
            ->bersinggungan($mulai, $selesai)
            ->orderBy('mulai')
            ->first();
    }
}
