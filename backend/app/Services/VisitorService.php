<?php

namespace App\Services;

use App\Models\Visitor;
use Illuminate\Validation\ValidationException;

/**
 * Registrasi, check-in, dan check-out pengunjung.
 */
class VisitorService
{
    /**
     * @param  array<string,mixed>  $data
     */
    public function daftarkan(array $data, ?int $pendaftarId): Visitor
    {
        return Visitor::create([
            ...$data,
            'status' => 'terjadwal',
            'dibuat_oleh' => $pendaftarId,
        ]);
    }

    /**
     * @param  array<string,mixed>  $data
     *
     * @throws ValidationException
     */
    public function checkIn(Visitor $tamu, array $data): Visitor
    {
        if ($tamu->status !== 'terjadwal') {
            throw ValidationException::withMessages([
                'status' => "Tamu ini sudah berstatus {$tamu->status} dan tidak dapat check-in lagi.",
            ]);
        }

        $tamu->update([
            'status' => 'di_dalam',
            'masuk_pada' => now(),
            'badge' => $data['badge'] ?? null,
        ]);

        return $tamu;
    }

    /**
     * @throws ValidationException
     */
    public function checkOut(Visitor $tamu): Visitor
    {
        if ($tamu->status !== 'di_dalam') {
            throw ValidationException::withMessages([
                'status' => 'Tamu ini belum check-in atau sudah check-out sebelumnya.',
            ]);
        }

        $tamu->update(['status' => 'selesai', 'keluar_pada' => now()]);

        return $tamu;
    }
}
