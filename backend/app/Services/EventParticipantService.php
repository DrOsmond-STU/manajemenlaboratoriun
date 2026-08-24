<?php

namespace App\Services;

use App\Models\Event;
use App\Models\EventParticipant;
use Illuminate\Validation\ValidationException;

class EventParticipantService
{
    public function daftarkan(Event $event, array $data): EventParticipant
    {
        return $event->participants()->create([
            ...$data,
            'status' => 'terdaftar',
        ]);
    }

    public function tandaiHadir(EventParticipant $peserta): EventParticipant
    {
        if ($peserta->status !== 'terdaftar') {
            throw ValidationException::withMessages([
                'status' => "Peserta ini sudah berstatus {$peserta->status} dan tidak dapat ditandai hadir lagi.",
            ]);
        }

        $peserta->update(['status' => 'hadir', 'hadir_pada' => now()]);

        return $peserta;
    }

    public function tandaiTidakHadir(EventParticipant $peserta): EventParticipant
    {
        if ($peserta->status !== 'terdaftar') {
            throw ValidationException::withMessages([
                'status' => "Peserta ini sudah berstatus {$peserta->status} dan tidak dapat diputuskan ulang.",
            ]);
        }

        $peserta->update(['status' => 'tidak_hadir']);

        return $peserta;
    }
}
