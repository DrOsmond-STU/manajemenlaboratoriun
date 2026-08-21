<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\Booking;
use App\Models\ChecklistAssignment;
use App\Models\DashboardWidget;
use App\Models\EquipmentLoan;
use App\Models\Invoice;
use App\Models\User;
use App\Support\RegistriWidget;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * Menghitung isi setiap widget.
 *
 * Dua aturan berlaku untuk SELURUH widget di berkas ini, tanpa kecuali:
 *
 *   1. Izin diperiksa di sini, saat data diambil — bukan saat widget dipasang.
 *      Peran berubah seiring waktu. Orang yang kehilangan peran Finance tidak
 *      boleh terus melihat angka piutang hanya karena widgetnya sudah
 *      tersimpan di tata letaknya sejak sebelum perannya dicabut. Widget yang
 *      tidak berizin mengembalikan penanda, bukan angka — dan bukan pula
 *      galat, karena satu widget usang tidak boleh menumbangkan seluruh
 *      halaman.
 *
 *   2. Setiap kueri melewati ->dalamCakupan(). Angka ringkasan membocorkan
 *      keberadaan data sama seperti daftar rincinya: "42 aset" bagi orang
 *      yang seharusnya hanya melihat gedungnya sendiri sudah memberi tahu
 *      ada sesuatu di luar sana. Model yang tidak punya cakupan sendiri
 *      dibatasi lewat relasinya ke aset.
 */
class DataWidget
{
    private const BATAS_DAFTAR = 8;

    private const HARI_BAWAAN = 30;

    /**
     * @return array<string,mixed>
     */
    public function untuk(DashboardWidget $widget, User $pengguna): array
    {
        $kunci = $widget->widget;

        if (! RegistriWidget::ada($kunci)) {
            // Kunci asing hanya mungkin masuk lewat penyuntingan langsung
            // basis data, karena validasi menolaknya. Ditandai, bukan
            // didiamkan — tata letak yang menampilkan kotak kosong tanpa
            // sebab lebih membingungkan daripada yang menyebutkan masalahnya.
            return $this->kosong('Widget tidak dikenal.');
        }

        $izin = RegistriWidget::izin($kunci);

        if ($izin !== null && ! Gate::forUser($pengguna)->allows($izin)) {
            return $this->kosong('Tidak berwenang melihat data ini.');
        }

        try {
            return $this->hitung($kunci, $widget, $pengguna);
        } catch (\Throwable $e) {
            // Satu widget rusak tidak boleh menjatuhkan seluruh halaman.
            // Dashboard adalah tampilan pertama setiap kali orang masuk;
            // galat 500 di sana membuat aplikasi tampak mati padahal yang
            // salah hanya satu kotak.
            //
            // TIDAK ditelan diam-diam: report() meneruskannya ke penangan
            // galat seperti biasa, sehingga tetap masuk log dan tetap
            // diperbaiki. Yang ditahan hanya dampaknya ke pengguna.
            report($e);

            return $this->kosong('Data widget gagal dimuat.');
        }
    }

    /**
     * @return array<string,mixed>
     */
    private function hitung(string $kunci, DashboardWidget $widget, User $pengguna): array
    {
        // Opsi penyajian pilihan pengguna. Dibaca lewat pembantu berbatas,
        // bukan dipakai apa adanya: `opsi` adalah jsonb yang isinya pernah
        // ditulis peramban, dan nilai seperti batas 100000 akan menarik
        // seluruh tabel ke memori pada setiap pemuatan dashboard.
        $batas = $this->batas($widget);
        $hari = $this->angkaOpsi($widget, 'hari', self::HARI_BAWAAN, 1, 365);

        return match ($kunci) {
            'aset.jumlah' => $this->angka(Asset::query()->dalamCakupan($pengguna)->count()),
            'aset.kondisi' => $this->asetKondisi($pengguna),
            'aset.nilai-perolehan' => $this->angka(
                (int) Asset::query()->dalamCakupan($pengguna)->sum('nilai_perolehan')
            ),
            'aset.tanpa-penanggung-jawab' => $this->angka(
                Asset::query()->dalamCakupan($pengguna)->whereNull('penanggung_jawab_id')->count()
            ),

            'booking.hari-ini' => $this->bookingHariIni($pengguna, $batas),
            'booking.menunggu' => $this->angka(
                Booking::query()->dalamCakupan($pengguna)->where('status', 'menunggu')->count()
            ),

            'peminjaman.aktif' => $this->angka(
                EquipmentLoan::query()->dalamCakupan($pengguna)->where('status', 'dipinjam')->count()
            ),
            'peminjaman.terlambat' => $this->peminjamanTerlambat($pengguna, $batas),

            'kalibrasi.kedaluwarsa' => $this->kalibrasiKedaluwarsa($pengguna, $batas),
            'pemeliharaan.terjadwal' => $this->pemeliharaanTerjadwal($pengguna, $batas, $hari),

            'checklist.tugas-saya' => $this->tugasSaya($pengguna, $batas),

            'tagihan.piutang' => $this->piutang(),
            'tagihan.jatuh-tempo' => $this->tagihanJatuhTempo($batas),

            // Kunci ada di registri tetapi belum ada hitungannya. Tidak
            // mungkin terjadi selama registri dan berkas ini dijaga sejalan;
            // ditangkap di sini supaya kalau toh terjadi, yang muncul adalah
            // kotak bertanda, bukan galat 500 di seluruh dashboard.
            default => $this->kosong('Perhitungan widget belum tersedia.'),
        };
    }

    // --- Bentuk keluaran -----------------------------------------------------

    /** @return array<string,mixed> */
    private function angka(int $nilai): array
    {
        return ['nilai' => $nilai];
    }

    /** @return array<string,mixed> */
    private function kosong(string $pesan): array
    {
        return ['nilai' => null, 'pesan' => $pesan];
    }

    // --- Aset ----------------------------------------------------------------

    /** @return array<string,mixed> */
    private function asetKondisi(User $pengguna): array
    {
        $hitung = Asset::query()->dalamCakupan($pengguna)
            ->selectRaw('kondisi, count(*) as jumlah')
            ->groupBy('kondisi')
            ->pluck('jumlah', 'kondisi');

        $bagian = [];

        // Ditelusuri dari daftar kondisi yang sah, bukan dari hasil kueri.
        // Kondisi yang jumlahnya nol tetap harus muncul sebagai nol —
        // menghilangkannya membuat grafik berubah bentuk dari waktu ke waktu
        // dan menyembunyikan kabar baik ("tidak ada yang rusak berat").
        foreach (Asset::KONDISI as $kode => $nama) {
            $bagian[] = ['kode' => $kode, 'nama' => $nama, 'jumlah' => (int) ($hitung[$kode] ?? 0)];
        }

        return ['bagian' => $bagian, 'nilai' => array_sum(array_column($bagian, 'jumlah'))];
    }

    // --- Booking -------------------------------------------------------------

    /** @return array<string,mixed> */
    private function bookingHariIni(User $pengguna, int $batas): array
    {
        $baris = Booking::query()->dalamCakupan($pengguna)
            ->aktif()
            ->whereDate('mulai', today())
            ->with('room:id,kode,nama')
            ->orderBy('mulai')
            ->limit($batas)
            ->get()
            ->map(fn (Booking $b) => [
                'id' => $b->id,
                'judul' => $b->room?->nama ?? '—',
                'keterangan' => $b->mulai->format('H:i').'–'.$b->selesai->format('H:i').' · '.$b->keperluan,
                'status' => $b->status,
            ]);

        return $this->daftar($baris, Booking::query()->dalamCakupan($pengguna)
            ->aktif()->whereDate('mulai', today())->count());
    }

    // --- Peminjaman ----------------------------------------------------------

    /** @return array<string,mixed> */
    private function peminjamanTerlambat(User $pengguna, int $batas): array
    {
        $kueri = fn () => EquipmentLoan::query()->dalamCakupan($pengguna)
            ->where('status', 'dipinjam')
            ->where('selesai', '<', now());

        $baris = $kueri()->with('asset:id,nama', 'user:id,name')
            ->orderBy('selesai')
            ->limit($batas)
            ->get()
            ->map(fn (EquipmentLoan $p) => [
                'id' => $p->id,
                'judul' => $p->asset?->nama ?? '—',
                'keterangan' => ($p->user?->name ?? '—')
                    .' · jatuh tempo '.$p->selesai->translatedFormat('j M Y'),
                'status' => 'terlambat',
            ]);

        return $this->daftar($baris, $kueri()->count());
    }

    // --- Kalibrasi & pemeliharaan --------------------------------------------

    /** @return array<string,mixed> */
    private function kalibrasiKedaluwarsa(User $pengguna, int $batas): array
    {
        // Ditelusuri dari sisi ASET, bukan dari sisi kalibrasi, karena alat
        // yang BELUM PERNAH dikalibrasi sama sekali tidak punya baris
        // kalibrasi — dan justru itu kasus terburuknya. Bertolak dari tabel
        // kalibrasi akan melewatkannya diam-diam.
        $kueri = fn () => Asset::query()->dalamCakupan($pengguna)
            ->where('wajib_kalibrasi', true)
            ->whereDoesntHave('maintenances', fn ($q) => $q
                ->kalibrasi()
                ->where('status', 'selesai')
                ->whereNotNull('berlaku_sampai')
                ->whereDate('berlaku_sampai', '>=', today()));

        $baris = $kueri()->with('room:id,nama')
            ->orderBy('nama')
            ->limit($batas)
            ->get()
            ->map(function (Asset $a) {
                $terakhir = $a->kalibrasiTerakhir();

                return [
                    'id' => $a->id,
                    'judul' => $a->nama,
                    'keterangan' => $terakhir?->berlaku_sampai
                        ? 'kedaluwarsa '.$terakhir->berlaku_sampai->translatedFormat('j M Y')
                        : 'belum pernah dikalibrasi',
                    'status' => 'kedaluwarsa',
                ];
            });

        return $this->daftar($baris, $kueri()->count());
    }

    /** @return array<string,mixed> */
    private function pemeliharaanTerjadwal(User $pengguna, int $batas, int $hari): array
    {
        $kueri = fn () => AssetMaintenance::query()
            ->jatuhTempo($hari)
            ->whereHas('asset', fn ($q) => $q->dalamCakupan($pengguna));

        $baris = $kueri()->with('asset:id,nama')
            ->orderBy('jadwal')
            ->limit($batas)
            ->get()
            ->map(fn (AssetMaintenance $m) => [
                'id' => $m->id,
                'judul' => $m->asset?->nama ?? '—',
                'keterangan' => $m->jadwal?->translatedFormat('j M Y').' · '.$m->jenis,
                'status' => $m->status,
            ]);

        return $this->daftar($baris, $kueri()->count());
    }

    // --- Checklist -----------------------------------------------------------

    /** @return array<string,mixed> */
    private function tugasSaya(User $pengguna, int $batas): array
    {
        $kueri = fn () => ChecklistAssignment::query()->aktif()->where('user_id', $pengguna->id);

        $baris = $kueri()->with('template:id,nama,jenis')
            ->limit($batas)
            ->get()
            ->map(fn (ChecklistAssignment $t) => [
                'id' => $t->id,
                'judul' => $t->template?->nama ?? '—',
                'keterangan' => $t->periode,
                'status' => 'aktif',
            ]);

        return $this->daftar($baris, $kueri()->count());
    }

    // --- Penagihan -----------------------------------------------------------

    /**
     * Piutang: sisa seluruh tagihan yang belum lunas.
     *
     * Dihitung dari model, bukan dari kolom tersimpan, karena nilai tagihan
     * memang tidak disimpan di mana pun — ia diturunkan dari baris rincian
     * dan pembayarannya. Menyalinnya ke kolom akan menyimpang begitu ada satu
     * pembayaran yang masuk lewat jalur lain, dan angka piutang yang
     * menyimpang adalah kesalahan laporan keuangan.
     *
     * BATASNYA: seluruh tagihan belum lunas ditarik ke memori. Untuk satuan
     * kerja laboratorium — puluhan sampai ratusan tagihan terbuka — ini murah
     * dan jelas. Bila kelak jumlahnya ribuan, penggantinya adalah satu kueri
     * agregat, bukan menyimpan totalnya ke kolom.
     *
     * @return array<string,mixed>
     */
    private function piutang(): array
    {
        $jumlah = Invoice::query()->belumLunas()
            ->with(['lines', 'payments'])
            ->get()
            ->sum(fn (Invoice $t) => $t->sisa());

        return $this->angka((int) $jumlah);
    }

    /** @return array<string,mixed> */
    private function tagihanJatuhTempo(int $batas): array
    {
        $kueri = fn () => Invoice::query()->belumLunas()->whereDate('jatuh_tempo', '<', today());

        $baris = $kueri()->with(['lines', 'payments', 'rental'])
            ->orderBy('jatuh_tempo')
            ->limit($batas)
            ->get()
            ->map(fn (Invoice $t) => [
                'id' => $t->id,
                'judul' => $t->nomor,
                'keterangan' => 'sisa Rp'.number_format($t->sisa(), 0, ',', '.')
                    .' · tempo '.$t->jatuh_tempo->translatedFormat('j M Y'),
                'status' => $t->status,
            ]);

        return $this->daftar($baris, $kueri()->count());
    }

    // --- Pembantu ------------------------------------------------------------

    private function batas(DashboardWidget $widget): int
    {
        return $this->angkaOpsi($widget, 'batas', self::BATAS_DAFTAR, 1, 50);
    }

    /**
     * Membaca satu opsi angka dengan batas atas dan bawah yang tegas.
     *
     * Nilai di luar rentang dikembalikan ke bawaannya, bukan ditolak dengan
     * galat: opsi ini berasal dari tata letak yang sudah tersimpan, dan
     * menolaknya berarti dashboard yang dulu sah tiba-tiba tidak dapat dibuka
     * sama sekali setelah rentangnya diperketat.
     */
    private function angkaOpsi(DashboardWidget $widget, string $kunci, int $bawaan, int $min, int $maks): int
    {
        $nilai = $widget->opsi[$kunci] ?? null;

        if (! is_int($nilai) && ! (is_string($nilai) && ctype_digit($nilai))) {
            return $bawaan;
        }

        $nilai = (int) $nilai;

        return ($nilai >= $min && $nilai <= $maks) ? $nilai : $bawaan;
    }

    /**
     * @param  Collection<int, array<string,mixed>>  $baris
     * @return array<string,mixed>
     */
    private function daftar(Collection $baris, int $total): array
    {
        return [
            // `nilai` selalu total sebenarnya, bukan jumlah baris yang
            // ditampilkan. Widget daftar yang memotong di baris kedelapan
            // tetapi menampilkan "8" sebagai angkanya akan menenangkan orang
            // secara keliru saat yang terlambat sebenarnya 80.
            'nilai' => $total,
            'baris' => $baris->all(),
            'terpotong' => $total > $baris->count(),
        ];
    }
}
