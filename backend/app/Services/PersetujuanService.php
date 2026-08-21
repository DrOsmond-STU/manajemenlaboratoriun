<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\EquipmentLoan;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

/**
 * Persetujuan pemesanan ruangan dan peminjaman alat.
 *
 * Satu layanan untuk dua modul, karena aturannya identik: hanya pengajuan
 * yang masih menunggu yang dapat diputus, penolakan wajib beralasan, dan
 * tidak seorang pun boleh menyetujui pengajuannya sendiri.
 *
 * Menuliskannya dua kali berarti dua tempat yang harus diperbaiki setiap kali
 * aturannya berubah — dan yang terlupa akan diam-diam mengizinkan hal yang
 * sudah dilarang di tempat lain.
 */
class PersetujuanService
{
    /** Status yang masih dapat diputus. */
    private const DAPAT_DIPUTUS = ['menunggu'];

    /**
     * Setujui pengajuan.
     *
     * @param  Booking|EquipmentLoan  $pengajuan
     *
     * @throws ValidationException
     */
    public function setujui(Model $pengajuan, User $penyetuju, ?string $catatan = null): Model
    {
        $this->pastikanMasihMenunggu($pengajuan);
        $this->pastikanBukanPengajuanSendiri($pengajuan, $penyetuju);

        // Tidak ada penanganan bentrok di sini, dan itu disengaja.
        //
        // Pengajuan berstatus `menunggu` SUDAH menahan slotnya — pemicu
        // anti-bentrok memperlakukannya sama seperti yang sudah disetujui.
        // Akibatnya dua pengajuan tumpang tindih tidak pernah dapat hidup
        // berdampingan, dan menyetujui salah satunya tidak mungkin
        // memunculkan bentrok baru.
        //
        // Penanganan galat untuk keadaan yang tidak dapat terjadi lebih buruk
        // daripada tidak ada: ia tidak pernah teruji, memberi kesan keliru
        // bahwa keadaan itu mungkin, dan menyamarkan galat sungguhan yang
        // kebetulan mirip. Bila kelak `menunggu` diputuskan tidak lagi
        // menahan slot, penanganannya ditambahkan bersama ujinya.
        $pengajuan->update([
            'status' => 'disetujui',
            'disetujui_oleh' => $penyetuju->id,
            'disetujui_pada' => now(),
            'catatan' => $catatan ?? $pengajuan->catatan,
        ]);

        return $pengajuan->refresh();
    }

    /**
     * Tolak pengajuan.
     *
     * Alasan WAJIB. Penolakan tanpa alasan membuat pemohon tidak tahu apa yang
     * harus diperbaiki, dan berujung pengajuan ulang yang sama persis.
     *
     * @param  Booking|EquipmentLoan  $pengajuan
     *
     * @throws ValidationException
     */
    public function tolak(Model $pengajuan, User $penolak, string $alasan): Model
    {
        $this->pastikanMasihMenunggu($pengajuan);
        $this->pastikanBukanPengajuanSendiri($pengajuan, $penolak);

        if (trim($alasan) === '') {
            throw ValidationException::withMessages([
                'alasan' => 'Alasan penolakan wajib diisi agar pemohon dapat memperbaiki pengajuannya.',
            ]);
        }

        $pengajuan->update([
            'status' => 'ditolak',
            'disetujui_oleh' => $penolak->id,
            'disetujui_pada' => now(),
            'alasan_penolakan' => trim($alasan),
        ]);

        return $pengajuan->refresh();
    }

    /**
     * @throws ValidationException
     */
    private function pastikanMasihMenunggu(Model $pengajuan): void
    {
        if (! in_array($pengajuan->status, self::DAPAT_DIPUTUS, true)) {
            throw ValidationException::withMessages([
                'status' => "Pengajuan berstatus {$pengajuan->status} tidak dapat diputus lagi. "
                    .'Hanya pengajuan yang masih menunggu yang dapat disetujui atau ditolak.',
            ]);
        }
    }

    /**
     * @throws ValidationException
     */
    private function pastikanBukanPengajuanSendiri(Model $pengajuan, User $pemutus): void
    {
        if ((int) $pengajuan->user_id === $pemutus->id) {
            throw ValidationException::withMessages([
                'disetujui_oleh' => 'Anda tidak dapat memutus pengajuan Anda sendiri, '
                    .'meskipun peran Anda mengizinkan persetujuan. '
                    .'Mintalah pemutus lain.',
            ]);
        }
    }
}
