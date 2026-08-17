<?php

namespace App\Console\Commands;

use App\Models\BmnKodeBarang;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Impor master kode barang BMN dari berkas CSV.
 *
 * Perintah ini sengaja permisif terhadap BENTUK berkas dan ketat terhadap ISI.
 * Alasannya: berkas referensi datang dari banyak sumber — hasil ekspor SAKTI,
 * salinan Excel, lampiran PDF yang disalin ulang — dengan pemisah, nama kolom,
 * dan penulisan kode yang berbeda-beda. Menolak berkas hanya karena judul
 * kolomnya "Kode Barang" dan bukan "kode" akan membuat orang menyunting berkas
 * resmi secara manual, dan di situlah salah ketik masuk.
 *
 * Sebaliknya, isinya diperiksa keras: kode yang tidak berpola 10 digit ditolak
 * dan dilaporkan beserta nomor barisnya, bukan diperbaiki diam-diam.
 */
class ImporKodeBarangBmn extends Command
{
    protected $signature = 'bmn:impor-kode-barang
        {berkas : Lokasi berkas CSV yang akan diimpor}
        {--pemisah= : Pemisah kolom (otomatis bila tidak diisi)}
        {--kolom-kode= : Nama atau nomor kolom kode barang}
        {--kolom-uraian= : Nama atau nomor kolom uraian barang}
        {--kolom-masa-manfaat= : Nama atau nomor kolom masa manfaat}
        {--tanpa-header : Berkas tidak memiliki baris judul}
        {--uji-coba : Hanya melaporkan, tidak menulis apa pun}';

    protected $description = 'Impor master kode barang BMN dari berkas CSV referensi resmi';

    /** Nama kolom yang dikenali, huruf kecil tanpa spasi ganda. */
    private const ALIAS = [
        'kode' => ['kode', 'kode barang', 'kode_barang', 'kodebarang', 'kd_brg', 'kdbrg', 'kd barang'],
        'uraian' => ['uraian', 'uraian barang', 'uraian_barang', 'nama', 'nama barang', 'nm_brg', 'nmbrg', 'keterangan'],
        'masa_manfaat' => ['masa manfaat', 'masa_manfaat', 'masamanfaat', 'mm', 'umur', 'umur ekonomis'],
    ];

    public function handle(): int
    {
        $berkas = (string) $this->argument('berkas');

        if (! is_readable($berkas)) {
            $this->error("Berkas tidak dapat dibaca: {$berkas}");

            return self::FAILURE;
        }

        $baris = $this->bacaCsv($berkas);

        if ($baris === null) {
            return self::FAILURE;
        }

        [$petaKolom, $isi] = $baris;

        $sah = [];
        $galat = [];
        $kembarDiBerkas = [];

        foreach ($isi as $nomor => $kolom) {
            $kode = $this->normalkanKode((string) ($kolom[$petaKolom['kode']] ?? ''));
            $uraian = trim((string) ($kolom[$petaKolom['uraian']] ?? ''));

            if ($kode === null) {
                $mentah = trim((string) ($kolom[$petaKolom['kode']] ?? ''));
                $galat[] = "baris {$nomor}: kode tidak berpola 10 digit — \"{$mentah}\"";

                continue;
            }

            if ($uraian === '') {
                $galat[] = "baris {$nomor}: uraian barang kosong untuk kode {$kode}";

                continue;
            }

            if (isset($sah[$kode])) {
                $kembarDiBerkas[] = "baris {$nomor}: kode {$kode} muncul lebih dari sekali";
            }

            $mm = $petaKolom['masa_manfaat'] !== null
                ? (int) preg_replace('/\D/', '', (string) ($kolom[$petaKolom['masa_manfaat']] ?? '0'))
                : 0;

            $sah[$kode] = [
                'kode' => $kode,
                'uraian' => $uraian,
                'masa_manfaat' => max(0, min(100, $mm)),
            ];
        }

        return $this->laporkanDanSimpan($sah, $galat, $kembarDiBerkas);
    }

    /**
     * @return array{0: array{kode:int, uraian:int, masa_manfaat:int|null}, 1: array<int, list<string>>}|null
     */
    private function bacaCsv(string $berkas): ?array
    {
        $isiBerkas = file_get_contents($berkas);

        if ($isiBerkas === false) {
            $this->error('Berkas gagal dibaca.');

            return null;
        }

        // Excel menyimpan CSV UTF-8 dengan BOM. Bila tidak dibuang, judul kolom
        // pertama menjadi "\u{FEFF}kode" dan tidak pernah cocok dengan alias.
        $isiBerkas = preg_replace('/^\x{FEFF}/u', '', $isiBerkas) ?? $isiBerkas;

        $pemisah = $this->option('pemisah') ?: $this->tebakPemisah($isiBerkas);
        $this->line('Pemisah kolom: <comment>'.($pemisah === "\t" ? '\\t' : $pemisah).'</comment>');

        $baris = [];
        $nomor = 0;

        foreach (preg_split('/\R/', $isiBerkas) ?: [] as $teks) {
            $nomor++;

            if (trim($teks) === '') {
                continue;
            }

            $baris[$nomor] = str_getcsv($teks, $pemisah, '"', '\\');
        }

        if ($baris === []) {
            $this->error('Berkas kosong.');

            return null;
        }

        if ($this->option('tanpa-header')) {
            $peta = $this->petaDariOpsi(null);
        } else {
            $judul = array_shift($baris);
            $peta = $this->petaDariOpsi($judul);
        }

        if ($peta === null) {
            return null;
        }

        return [$peta, $baris];
    }

    /**
     * Tentukan kolom mana yang dipakai: dari opsi bila diberikan, selebihnya
     * dicocokkan dengan judul kolom.
     *
     * @param  list<string>|null  $judul
     * @return array{kode:int, uraian:int, masa_manfaat:int|null}|null
     */
    private function petaDariOpsi(?array $judul): ?array
    {
        $cari = function (string $peran) use ($judul): ?int {
            // Nama opsi memakai tanda hubung (`--kolom-masa-manfaat`), sedangkan
            // kunci perannya memakai garis bawah. Tanpa penyeragaman ini,
            // Symfony melempar "option does not exist" untuk masa_manfaat.
            $opsi = $this->option('kolom-'.str_replace('_', '-', $peran));

            if ($opsi !== null && $opsi !== '') {
                // Angka berarti nomor kolom (mulai dari 1), selain itu nama kolom.
                if (is_numeric($opsi)) {
                    return ((int) $opsi) - 1;
                }

                $indeks = $judul ? array_search(mb_strtolower(trim($opsi)), array_map(
                    fn ($j) => mb_strtolower(trim((string) $j)), $judul
                ), true) : false;

                return $indeks === false ? null : (int) $indeks;
            }

            if ($judul === null) {
                return null;
            }

            foreach ($judul as $i => $namaKolom) {
                $bersih = preg_replace('/\s+/', ' ', mb_strtolower(trim((string) $namaKolom))) ?? '';

                if (in_array($bersih, self::ALIAS[$peran], true)) {
                    return (int) $i;
                }
            }

            return null;
        };

        $kode = $cari('kode');
        $uraian = $cari('uraian');
        $mm = $cari('masa_manfaat');

        if ($kode === null || $uraian === null) {
            $this->error('Kolom kode dan/atau uraian tidak dikenali.');
            $this->line('');
            $this->line('Judul kolom yang terbaca: <comment>'.($judul ? implode(' | ', $judul) : '(tanpa header)').'</comment>');
            $this->line('');
            $this->line('Tentukan sendiri dengan opsi, misalnya:');
            $this->line('  <info>--kolom-kode="Kode Barang" --kolom-uraian="Uraian Barang"</info>');
            $this->line('  <info>--kolom-kode=1 --kolom-uraian=2</info>   (nomor kolom, mulai dari 1)');

            return null;
        }

        return ['kode' => $kode, 'uraian' => $uraian, 'masa_manfaat' => $mm];
    }

    /**
     * Pemisah ditebak dari baris pertama: yang paling sering muncul menang.
     * Ekspor SAKTI dan Excel Indonesia lazim memakai titik koma, bukan koma.
     */
    private function tebakPemisah(string $isi): string
    {
        $barisPertama = strtok($isi, "\r\n") ?: '';

        $jumlah = [
            ';' => substr_count($barisPertama, ';'),
            ',' => substr_count($barisPertama, ','),
            "\t" => substr_count($barisPertama, "\t"),
            '|' => substr_count($barisPertama, '|'),
        ];

        arsort($jumlah);
        $teratas = array_key_first($jumlah);

        return $jumlah[$teratas] > 0 ? (string) $teratas : ',';
    }

    /**
     * Kode dirapikan ke bentuk baku X.XX.XX.XX.XXX.
     *
     * Sumber resmi menuliskannya bermacam-macam: "3.08.01.03.001",
     * "3080103001", atau "3 08 01 03 001". Ketiganya sama, jadi angkanya yang
     * dipakai. Yang jumlah digitnya bukan 10 ditolak — bukan ditambal nol,
     * karena menebak digit yang hilang berarti mengarang kode barang.
     */
    private function normalkanKode(string $mentah): ?string
    {
        $digit = preg_replace('/\D/', '', $mentah) ?? '';

        if (strlen($digit) !== 10 || $digit[0] === '0' || $digit[0] === '9') {
            return null;
        }

        return sprintf(
            '%s.%s.%s.%s.%s',
            substr($digit, 0, 1),
            substr($digit, 1, 2),
            substr($digit, 3, 2),
            substr($digit, 5, 2),
            substr($digit, 7, 3),
        );
    }

    /**
     * @param  array<string, array{kode:string, uraian:string, masa_manfaat:int}>  $sah
     * @param  list<string>  $galat
     * @param  list<string>  $kembar
     */
    private function laporkanDanSimpan(array $sah, array $galat, array $kembar): int
    {
        $this->newLine();

        if ($kembar !== []) {
            $this->warn('Kode kembar di dalam berkas (yang terakhir dipakai):');
            foreach (array_slice($kembar, 0, 10) as $pesan) {
                $this->line("  · {$pesan}");
            }
            if (count($kembar) > 10) {
                $this->line('  · … dan '.(count($kembar) - 10).' lainnya');
            }
            $this->newLine();
        }

        if ($galat !== []) {
            $this->warn('Baris yang dilewati:');
            foreach (array_slice($galat, 0, 15) as $pesan) {
                $this->line("  · {$pesan}");
            }
            if (count($galat) > 15) {
                $this->line('  · … dan '.(count($galat) - 15).' lainnya');
            }
            $this->newLine();
        }

        if ($sah === []) {
            $this->error('Tidak ada baris yang sah untuk diimpor.');

            return self::FAILURE;
        }

        // Bandingkan dengan isi basis data supaya laporannya menyebutkan apa
        // yang benar-benar berubah, bukan sekadar "sekian baris diproses".
        $lama = BmnKodeBarang::whereIn('kode', array_keys($sah))
            ->get(['kode', 'uraian', 'masa_manfaat'])
            ->keyBy('kode');

        $baru = 0;
        $berubah = 0;
        $tetap = 0;

        foreach ($sah as $kode => $data) {
            $ada = $lama->get($kode);

            if (! $ada) {
                $baru++;
            } elseif ($ada->uraian !== $data['uraian'] || $ada->masa_manfaat !== $data['masa_manfaat']) {
                $berubah++;
            } else {
                $tetap++;
            }
        }

        $this->table(
            ['Dibaca', 'Baru', 'Diperbarui', 'Tidak berubah', 'Dilewati'],
            [[count($sah) + count($galat), $baru, $berubah, $tetap, count($galat)]],
        );

        if ($this->option('uji-coba')) {
            $this->info('Uji coba — tidak ada yang ditulis ke basis data.');

            return self::SUCCESS;
        }

        // Satu transaksi: bila sebagian gagal, master tidak tertinggal separuh
        // terisi, yang jauh lebih berbahaya daripada tidak terisi sama sekali.
        DB::transaction(function () use ($sah) {
            foreach (array_chunk($sah, 500, preserve_keys: true) as $potongan) {
                foreach ($potongan as $data) {
                    // updateOrCreate, bukan upsert massal, karena hook `saving`
                    // pada model yang mengisi jenjang golongan/bidang/kelompok
                    // tidak berjalan pada upsert.
                    BmnKodeBarang::updateOrCreate(['kode' => $data['kode']], $data);
                }
            }
        });

        $this->info('Impor selesai: '.count($sah).' kode barang tersimpan.');

        if ($berubah > 0 || $baru > 0) {
            $this->newLine();
            $this->line('Bila baru saja mengimpor data aset lama, jalankan juga:');
            $this->line('  <info>php artisan bmn:selaraskan-nup</info>');
        }

        return self::SUCCESS;
    }
}
