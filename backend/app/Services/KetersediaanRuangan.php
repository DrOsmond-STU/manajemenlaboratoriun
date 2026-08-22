<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Ruangan mana yang bebas pada sebuah rentang waktu.
 *
 * DIHITUNG SERVER, DAN ITU BUKAN SOAL KENYAMANAN.
 *
 * Antarmuka dapat saja menghitungnya sendiri dari daftar pemesanan yang sudah
 * dimuatnya. Tetapi daftar itu berumur beberapa detik sampai beberapa menit,
 * dan dalam rentang itu orang lain sudah dapat memesan. Yang terjadi bukan
 * sekadar layar usang: pengguna melihat ruangan bertanda "tersedia", mengisi
 * seluruh formulir, lalu ditolak pada langkah terakhir — dan ia tidak punya
 * cara tahu mengapa, karena layarnya baru saja mengatakan sebaliknya.
 *
 * Jawaban dari sini pun tetap perkiraan: antara pemeriksaan dan penyimpanan
 * selalu ada jeda. Jaminannya tetap pemicu basis data; ini hanya membuat
 * penolakannya jarang, bukan mustahil.
 */
class KetersediaanRuangan
{
    /**
     * @return array<int, array<string,mixed>>
     */
    public function untukRentang(?User $pengguna, Carbon $mulai, Carbon $selesai, ?int $kapasitasMin = null): array
    {
        $ruangan = Room::query()
            ->dalamCakupan($pengguna)
            ->when($kapasitasMin, fn ($q) => $q->where('kapasitas', '>=', $kapasitasMin))
            ->orderBy('kode')
            ->get();

        // Satu kueri untuk seluruh ruangan, bukan satu kueri per ruangan:
        // daftar ketersediaan dipanggil setiap kali pengguna menggeser jam,
        // dan N+1 di sini berarti puluhan kueri per ketikan.
        $bentrok = Booking::query()
            ->whereIn('room_id', $ruangan->pluck('id'))
            ->aktif()
            // Rentang setengah terbuka [mulai, selesai) — sama persis dengan
            // batasan pada basis data. Pemakaian berurutan 08–12 dan 12–14
            // BUKAN bentrok, dan aturan itu tidak boleh berbeda antara
            // pemeriksaan dan penyimpanan.
            ->where('mulai', '<', $selesai)
            ->where('selesai', '>', $mulai)
            ->get(['id', 'room_id', 'keperluan', 'mulai', 'selesai', 'status'])
            ->groupBy('room_id');

        return $ruangan->map(function (Room $r) use ($bentrok) {
            $tabrakan = $bentrok->get($r->id, collect());

            return [
                'id' => $r->id,
                'kode' => $r->kode,
                'nama' => $r->nama,
                'jenis' => $r->jenis,
                'gedung' => $r->gedung,
                'lantai' => $r->lantai,
                'kapasitas' => $r->kapasitas,
                'status_ruangan' => [
                    'kode' => $r->status,
                    'nama' => Room::STATUS[$r->status] ?? $r->status,
                ],
                'tarif' => [
                    'skema' => $r->skema_tarif,
                    'skema_nama' => Room::SKEMA_TARIF[$r->skema_tarif] ?? $r->skema_tarif,
                    'nilai' => $r->tarif,
                ],
                'fasilitas' => $r->fasilitas ?? [],
                'tata_letak' => $r->tata_letak ?? [],
                'perlu_persetujuan' => $r->perlu_persetujuan,

                // Ruangan dalam pemeliharaan ikut ditandai tidak tersedia.
                // Slotnya memang kosong, tetapi memesannya tetap keliru — dan
                // menyembunyikan ruangannya sama sekali membuat pemesan
                // bertanya-tanya ke mana perginya.
                'tersedia' => $tabrakan->isEmpty() && $r->status === 'tersedia',
                'alasan' => $tabrakan->isNotEmpty()
                    ? 'Bentrok dengan pemesanan lain'
                    : ($r->status !== 'tersedia' ? (Room::STATUS[$r->status] ?? $r->status) : null),

                'bentrok' => $tabrakan->map(fn (Booking $b) => [
                    'id' => $b->id,
                    'keperluan' => $b->keperluan,
                    'mulai' => $b->mulai->toIso8601String(),
                    'selesai' => $b->selesai->toIso8601String(),
                    'status' => $b->status,
                ])->values()->all(),
            ];
        })->values()->all();
    }
}
