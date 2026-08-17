<?php

namespace App\Console\Commands;

use App\Services\NupAllocator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Selaraskan pencatat NUP dengan aset yang sudah ada.
 *
 * Wajib dijalankan setelah impor data aset lama. Impor massal menulis baris
 * `assets` langsung tanpa melewati NupAllocator, sehingga pencatatnya masih
 * nol sementara NUP 1..41 sudah terpakai. Tanpa penyelarasan, pendaftaran
 * berikutnya akan mengklaim NUP 1 dan ditolak indeks unik — pengguna melihat
 * galat yang tidak jelas asal-usulnya.
 */
class SelaraskanNup extends Command
{
    protected $signature = 'bmn:selaraskan-nup {--uji-coba : Hanya melaporkan, tidak menulis apa pun}';

    protected $description = 'Selaraskan pencatat NUP dengan NUP tertinggi yang sudah terpakai';

    public function handle(NupAllocator $allocator): int
    {
        // Termasuk aset yang sudah dihapus lunak: NUP-nya tetap tidak boleh
        // dipakai ulang, karena nomor itu sudah beredar di dokumen dan label.
        $pasangan = DB::table('assets')
            ->select('kode_lokasi', 'kode_barang')
            ->selectRaw('MAX(nup) as nup_tertinggi')
            ->groupBy('kode_lokasi', 'kode_barang')
            ->orderBy('kode_lokasi')
            ->orderBy('kode_barang')
            ->get();

        if ($pasangan->isEmpty()) {
            $this->info('Belum ada aset. Tidak ada yang perlu diselaraskan.');

            return self::SUCCESS;
        }

        $sebelum = DB::table('bmn_nup_counters')
            ->get()
            ->keyBy(fn ($b) => $b->kode_lokasi.'|'.$b->kode_barang);

        $perluUbah = [];

        foreach ($pasangan as $p) {
            $kunci = $p->kode_lokasi.'|'.$p->kode_barang;
            $tercatat = (int) ($sebelum->get($kunci)->nup_terakhir ?? 0);

            if ($tercatat < (int) $p->nup_tertinggi) {
                $perluUbah[] = [
                    $p->kode_barang,
                    $tercatat,
                    (int) $p->nup_tertinggi,
                    $p->kode_lokasi,
                ];
            }
        }

        if ($perluUbah === []) {
            $this->info('Seluruh pencatat NUP sudah selaras ('.$pasangan->count().' kombinasi diperiksa).');

            return self::SUCCESS;
        }

        $this->table(['Kode barang', 'Tercatat', 'Seharusnya', 'Kode lokasi'], $perluUbah);

        if ($this->option('uji-coba')) {
            $this->info('Uji coba — tidak ada yang ditulis.');

            return self::SUCCESS;
        }

        foreach ($perluUbah as [$kodeBarang, , , $kodeLokasi]) {
            $allocator->selaraskan($kodeLokasi, $kodeBarang);
        }

        $this->info(count($perluUbah).' pencatat NUP diselaraskan.');

        return self::SUCCESS;
    }
}
