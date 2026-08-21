<?php

namespace App\Console\Commands;

use App\Services\NotifikasiJadwalService;
use Illuminate\Console\Command;

/**
 * Kirim pengingat jadwal ke surel penanggung jawab.
 *
 * Dijalankan penjadwal sekali sehari. Aman dijalankan berulang: keunikan
 * pengingat dijaga indeks unik di basis data, bukan oleh ketepatan jadwal
 * cron.
 */
class KirimPengingatJadwal extends Command
{
    protected $signature = 'flms:kirim-pengingat {--uji-coba : Tampilkan yang akan dikirim tanpa mengirim}';

    protected $description = 'Kirim pengingat jadwal ke surel masing-masing penanggung jawab';

    public function handle(NotifikasiJadwalService $notifikasi): int
    {
        if ($this->option('uji-coba')) {
            $this->warn('Mode uji coba belum tersedia; jalankan tanpa --uji-coba.');

            return self::FAILURE;
        }

        $hasil = $notifikasi->jalankan();

        $this->table(
            ['Diperiksa', 'Terkirim', 'Dilewati', 'Gagal'],
            [[$hasil['diperiksa'], $hasil['terkirim'], $hasil['dilewati'], $hasil['gagal']]],
        );

        if ($hasil['gagal'] > 0) {
            $this->warn($hasil['gagal'].' pengingat gagal terkirim — periksa tabel notification_logs.');
        }

        return self::SUCCESS;
    }
}
