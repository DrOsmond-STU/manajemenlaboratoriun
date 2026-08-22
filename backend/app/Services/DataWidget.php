<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\Booking;
use App\Models\ChecklistAssignment;
use App\Models\ChecklistRun;
use App\Models\ChecklistTemplate;
use App\Models\DashboardWidget;
use App\Models\EquipmentLoan;
use App\Models\Invoice;
use App\Models\Laboratory;
use App\Models\NotificationLog;
use App\Models\Payment;
use App\Models\Rental;
use App\Models\Room;
use App\Models\User;
use App\Support\RegistriWidget;
use Illuminate\Database\Eloquent\Builder;
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
 *
 *      Pengecualian yang SUDAH ADA sebelum perluasan ini, dan dipertahankan
 *      apa adanya: widget penagihan (Invoice/Payment/Rental) tidak menerapkan
 *      cakupan gedung sama sekali. Modul Penyewaan & Penagihan memang belum
 *      punya sumbu cakupan gedung di mana pun — lihat SECURITY.md §4.2 dan
 *      docs/BACKEND.md §8.1. Widget baru pada domain itu mengikuti perilaku
 *      yang sudah berjalan, bukan diam-diam memperbaikinya di sini.
 *
 * ASUMSI UTILISASI RUANGAN, DINYATAKAN TEGAS: jam operasional 08.00–18.00
 * (10 jam), Senin–Sabtu dihitung hari kerja. Tidak ada satu pun tempat di
 * sistem ini yang menyimpan jam operasional fasilitas sesungguhnya — angka
 * ini karenanya PERKIRAAN, bukan fakta tercatat, dan perlu dipastikan ke
 * satuan kerja sebelum dijadikan dasar keputusan (lihat docs/BACKEND.md).
 */
class DataWidget
{
    private const BATAS_DAFTAR = 8;

    private const HARI_BAWAAN = 30;

    private const JAM_OPERASIONAL_PER_HARI = 10;

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
            'aset.nilai-buku' => $this->nilaiMentah(
                app(RingkasanAset::class)->untuk($pengguna)['nilai_buku'] ?? 0
            ),

            'ruangan.jumlah' => $this->angka(Room::query()->dalamCakupan($pengguna)->count()),
            'ruangan.status' => $this->sebaranDari(
                Room::query()->dalamCakupan($pengguna)
                    ->selectRaw('status, count(*) as jumlah')->groupBy('status')->pluck('jumlah', 'status'),
                Room::STATUS
            ),
            'ruangan.utilisasi' => $this->ruanganUtilisasi($pengguna),
            'ruangan.tren-utilisasi' => $this->ruanganTrenUtilisasi($pengguna),
            'ruangan.heatmap-okupansi' => $this->heatmapOkupansi($pengguna),

            'booking.hari-ini' => $this->bookingHariIni($pengguna, $batas),
            'booking.mendatang' => $this->bookingMendatang($pengguna, $batas),
            'booking.menunggu' => $this->angka(
                Booking::query()->dalamCakupan($pengguna)->where('status', 'menunggu')->count()
            ),
            'booking.status' => $this->sebaranDari(
                Booking::query()->dalamCakupan($pengguna)
                    ->selectRaw('status, count(*) as jumlah')->groupBy('status')->pluck('jumlah', 'status'),
                Booking::STATUS
            ),

            'peminjaman.aktif' => $this->angka(
                EquipmentLoan::query()->dalamCakupan($pengguna)->where('status', 'dipinjam')->count()
            ),
            'peminjaman.terlambat' => $this->peminjamanTerlambat($pengguna, $batas),
            'peminjaman.status' => $this->sebaranDari(
                EquipmentLoan::query()->dalamCakupan($pengguna)
                    ->selectRaw('status, count(*) as jumlah')->groupBy('status')->pluck('jumlah', 'status'),
                EquipmentLoan::STATUS
            ),

            'laboratorium.jumlah' => $this->angka(Laboratory::query()->dalamCakupan($pengguna)->count()),
            'laboratorium.status' => $this->sebaranDari(
                Laboratory::query()->dalamCakupan($pengguna)
                    ->selectRaw('status, count(*) as jumlah')->groupBy('status')->pluck('jumlah', 'status'),
                Laboratory::STATUS
            ),
            'laboratorium.tanpa-penanggung-jawab' => $this->angka(
                Laboratory::query()->dalamCakupan($pengguna)->whereNull('penanggung_jawab_id')->count()
            ),

            'kalibrasi.kedaluwarsa' => $this->kalibrasiKedaluwarsa($pengguna, $batas),
            'pemeliharaan.terjadwal' => $this->pemeliharaanTerjadwal($pengguna, $batas, $hari),
            'pemeliharaan.aktif' => $this->angka(
                $this->pemeliharaanDalamCakupan(
                    AssetMaintenance::query()->whereIn('status', ['dijadwalkan', 'berjalan']), $pengguna
                )->count()
            ),
            'pemeliharaan.jenis' => $this->sebaranDari(
                $this->pemeliharaanDalamCakupan(AssetMaintenance::query(), $pengguna)
                    ->selectRaw('jenis, count(*) as jumlah')->groupBy('jenis')->pluck('jumlah', 'jenis'),
                AssetMaintenance::JENIS
            ),
            'pemeliharaan.biaya-ytd' => $this->angka((int) $this->pemeliharaanDalamCakupan(
                AssetMaintenance::query()->where('status', 'selesai')->whereYear('dikerjakan_pada', now()->year),
                $pengguna
            )->sum('biaya')),
            'pemeliharaan.tren-biaya' => $this->pemeliharaanTrenBiaya($pengguna),

            'checklist.tugas-saya' => $this->tugasSaya($pengguna, $batas),
            'checklist.jatuh-tempo' => $this->checklistJatuhTempo($batas),
            'checklist.per-jenis' => $this->checklistPerJenis(),

            'tagihan.piutang' => $this->piutang(),
            'tagihan.jatuh-tempo' => $this->tagihanJatuhTempo($batas),
            'tagihan.status' => $this->sebaranDari(
                Invoice::query()->selectRaw('status, count(*) as jumlah')->groupBy('status')->pluck('jumlah', 'status'),
                Invoice::STATUS
            ),
            'penyewaan.jumlah-aktif' => $this->angka(
                Rental::query()->whereIn('status', ['dikonfirmasi', 'berjalan'])->count()
            ),
            'penyewaan.pendapatan-ytd' => $this->angka(
                (int) Payment::query()->whereYear('tanggal', now()->year)->sum('jumlah')
            ),
            'penyewaan.tren-pendapatan' => $this->penyewaanTrenPendapatan(),

            'notifikasi.terkirim-hari-ini' => $this->angka(
                NotificationLog::query()->where('status', 'terkirim')->whereDate('dikirim_pada', today())->count()
            ),
            'notifikasi.gagal' => $this->angka(
                NotificationLog::query()->where('status', 'gagal')->count()
            ),

            'bsc.skor' => $this->nilaiMentah(app(Scorecard::class)->kartu((string) now()->year)['skor']),
            'bsc.per-perspektif' => $this->bscPerPerspektif(),
            'bsc.tren-skor' => $this->bscTrenSkor(),
            'bsc.kartu' => app(Scorecard::class)->kartu((string) now()->year),

            'sistem.peringatan' => $this->sistemPeringatan($pengguna, $batas),
            'catatan.bebas' => ['nilai' => null],

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

    /**
     * Seperti angka(), tapi menerima desimal dan null — dipakai widget yang
     * nilainya sungguhan pecahan (skor BSC, persentase utilisasi) atau bisa
     * benar-benar tidak terdefinisi (belum ada data sama sekali).
     *
     * @return array<string,mixed>
     */
    private function nilaiMentah(int|float|null $nilai): array
    {
        return ['nilai' => $nilai];
    }

    /** @return array<string,mixed> */
    private function kosong(string $pesan): array
    {
        return ['nilai' => null, 'pesan' => $pesan];
    }

    /**
     * Sebaran per kategori, ditelusuri dari daftar kode yang SAH — bukan
     * dari hasil kueri — supaya kategori yang jumlahnya nol tetap tampil.
     * Menghilangkannya membuat grafik berubah bentuk dari waktu ke waktu dan
     * menyembunyikan kabar baik ("tidak ada yang rusak berat").
     *
     * @param  Collection<string,int>  $hitung  kode => jumlah
     * @param  array<string,string>  $namaPerKode
     * @return array<string,mixed>
     */
    private function sebaranDari(Collection $hitung, array $namaPerKode): array
    {
        $bagian = [];
        foreach ($namaPerKode as $kode => $nama) {
            $bagian[] = ['kode' => $kode, 'nama' => $nama, 'jumlah' => (int) ($hitung[$kode] ?? 0)];
        }

        return ['bagian' => $bagian, 'nilai' => array_sum(array_column($bagian, 'jumlah'))];
    }

    // --- Aset ----------------------------------------------------------------

    /** @return array<string,mixed> */
    private function asetKondisi(User $pengguna): array
    {
        $hitung = Asset::query()->dalamCakupan($pengguna)
            ->selectRaw('kondisi, count(*) as jumlah')
            ->groupBy('kondisi')
            ->pluck('jumlah', 'kondisi');

        return $this->sebaranDari($hitung, Asset::KONDISI);
    }

    // --- Ruangan & utilisasi ---------------------------------------------------

    /** @return array<string,mixed> */
    private function ruanganUtilisasi(User $pengguna): array
    {
        $jumlahRuangan = Room::query()->dalamCakupan($pengguna)->count();

        if ($jumlahRuangan === 0) {
            return $this->nilaiMentah(null);
        }

        $awal = now()->startOfMonth();
        $akhir = now()->min(now()->copy()->endOfMonth());

        return $this->nilaiMentah($this->persenUtilisasi($pengguna, $jumlahRuangan, $awal, $akhir));
    }

    /** @return array<string,mixed> */
    private function ruanganTrenUtilisasi(User $pengguna): array
    {
        $jumlahRuangan = Room::query()->dalamCakupan($pengguna)->count();
        $titik = [];

        for ($i = 5; $i >= 0; $i--) {
            $bulan = now()->subMonthsNoOverflow($i);
            $awal = $bulan->copy()->startOfMonth();
            $akhir = $bulan->copy()->endOfMonth()->min(now());

            $titik[] = [
                'label' => $bulan->translatedFormat('M Y'),
                'nilai' => $jumlahRuangan > 0 ? $this->persenUtilisasi($pengguna, $jumlahRuangan, $awal, $akhir) : null,
            ];
        }

        return ['titik' => $titik, 'satuan' => '%'];
    }

    private function persenUtilisasi(User $pengguna, int $jumlahRuangan, $awal, $akhir): ?float
    {
        $jamTerpakai = (float) Booking::query()->dalamCakupan($pengguna)
            ->whereNotIn('status', Booking::STATUS_TIDAK_MEMBLOKIR)
            ->whereBetween('mulai', [$awal, $akhir])
            ->get(['mulai', 'selesai'])
            ->sum(fn (Booking $b) => $b->mulai->diffInMinutes($b->selesai) / 60);

        $kapasitasJam = $jumlahRuangan * self::JAM_OPERASIONAL_PER_HARI * $this->hariKerja($awal, $akhir);

        return $kapasitasJam > 0 ? round(min(100, $jamTerpakai / $kapasitasJam * 100), 1) : null;
    }

    /** Senin–Sabtu dihitung hari kerja fasilitas; Minggu tidak. */
    private function hariKerja($awal, $akhir): int
    {
        $n = 0;
        for ($d = $awal->copy()->startOfDay(); $d->lte($akhir); $d->addDay()) {
            if (! $d->isSunday()) {
                $n++;
            }
        }

        return $n;
    }

    /**
     * Heatmap okupansi 90 hari terakhir: hari (Senin–Minggu) × jam.
     * Dinormalkan terhadap sel tersibuk supaya tetap terbaca lintas satuan
     * kerja — sel tersibuk selalu 100, bukan angka mentah yang mustahil
     * dibandingkan tanpa konteks berapa jam operasionalnya.
     *
     * @return array<string,mixed>
     */
    private function heatmapOkupansi(User $pengguna): array
    {
        $kolomJam = ['07', '09', '10', '11', '13', '14', '15', '16', '17'];
        $baris = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        $sel = array_fill(0, count($baris), array_fill(0, count($kolomJam), 0));

        $bookings = Booking::query()->dalamCakupan($pengguna)
            ->whereNotIn('status', Booking::STATUS_TIDAK_MEMBLOKIR)
            ->where('mulai', '>=', now()->subDays(90))
            ->get(['mulai', 'selesai']);

        foreach ($bookings as $b) {
            $baris_ = $b->mulai->isoWeekday() - 1; // 0=Senin .. 6=Minggu
            $j = $b->mulai;
            while ($j->lt($b->selesai)) {
                $idx = array_search($j->format('H'), $kolomJam, true);
                if ($idx !== false) {
                    $sel[$baris_][$idx]++;
                }
                $j = $j->addHour();
            }
        }

        $maks = max(1, max(array_map('max', $sel)));
        $ternormal = array_map(
            fn (array $b) => array_map(fn (int $v) => (int) round($v / $maks * 100), $b),
            $sel
        );

        return ['baris' => $baris, 'kolom' => $kolomJam, 'sel' => $ternormal];
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

    /** @return array<string,mixed> */
    private function bookingMendatang(User $pengguna, int $batas): array
    {
        $kueri = fn () => Booking::query()->dalamCakupan($pengguna)
            ->aktif()
            ->where('mulai', '>', now());

        $baris = $kueri()->with('room:id,kode,nama')
            ->orderBy('mulai')
            ->limit($batas)
            ->get()
            ->map(fn (Booking $b) => [
                'id' => $b->id,
                'judul' => $b->room?->nama ?? '—',
                'keterangan' => $b->mulai->translatedFormat('j M, H:i').' · '.$b->keperluan,
                'status' => $b->status,
            ]);

        return $this->daftar($baris, $kueri()->count());
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
        $kueri = fn () => $this->pemeliharaanDalamCakupan(
            AssetMaintenance::query()->jatuhTempo($hari), $pengguna
        );

        $baris = $kueri()->with(['asset:id,nama', 'room:id,nama', 'laboratory:id,nama'])
            ->orderBy('jadwal')
            ->limit($batas)
            ->get()
            ->map(fn (AssetMaintenance $m) => [
                'id' => $m->id,
                'judul' => $m->sumberDayaRingkas()['nama'] ?? '—',
                'keterangan' => $m->jadwal?->translatedFormat('j M Y').' · '.$m->jenisNama(),
                'status' => $m->status,
            ]);

        return $this->daftar($baris, $kueri()->count());
    }

    /** @return array<string,mixed> */
    private function pemeliharaanTrenBiaya(User $pengguna): array
    {
        $titik = [];

        for ($i = 5; $i >= 0; $i--) {
            $bulan = now()->subMonthsNoOverflow($i);

            $jumlah = $this->pemeliharaanDalamCakupan(
                AssetMaintenance::query()
                    ->where('status', 'selesai')
                    ->whereYear('dikerjakan_pada', $bulan->year)
                    ->whereMonth('dikerjakan_pada', $bulan->month),
                $pengguna
            )->sum('biaya');

            $titik[] = ['label' => $bulan->translatedFormat('M Y'), 'nilai' => (int) $jumlah];
        }

        return ['titik' => $titik, 'satuan' => 'rupiah'];
    }

    /**
     * Cakupan gedung untuk pemeliharaan berlaku lintas ketiga kemungkinan
     * targetnya — ruangan, laboratorium, ATAU alat — bukan hanya alat.
     * whereHas('asset', ...) sendirian akan mengecualikan seluruh pekerjaan
     * yang melekat pada ruangan/laboratorium, karena asset_id-nya memang
     * kosong pada baris itu.
     */
    private function pemeliharaanDalamCakupan(Builder $query, User $pengguna): Builder
    {
        return $query->where(fn ($q) => $q
            ->whereHas('asset', fn ($qq) => $qq->dalamCakupan($pengguna))
            ->orWhereHas('room', fn ($qq) => $qq->dalamCakupan($pengguna))
            ->orWhereHas('laboratory', fn ($qq) => $qq->dalamCakupan($pengguna)));
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

    /**
     * Penugasan aktif yang belum ada pelaksanaan SELESAI dalam jendela
     * periodenya sendiri — harian belum ada yang selesai hari ini, mingguan
     * belum ada yang selesai pekan ini, dan seterusnya. Insidental tidak
     * pernah "jatuh tempo": tidak ada jadwal baku untuknya.
     *
     * @return array<string,mixed>
     */
    private function checklistJatuhTempo(int $batas): array
    {
        $sekarang = now();

        $semua = ChecklistAssignment::query()->aktif()
            ->where('periode', '!=', 'insidental')
            ->with('template:id,nama')
            ->get();

        $jatuhTempo = $semua->filter(function (ChecklistAssignment $a) use ($sekarang) {
            $mulaiPeriode = match ($a->periode) {
                'harian' => $sekarang->copy()->startOfDay(),
                'mingguan' => $sekarang->copy()->startOfWeek(),
                'bulanan' => $sekarang->copy()->startOfMonth(),
                'triwulanan' => $sekarang->copy()->startOfQuarter(),
                'tahunan' => $sekarang->copy()->startOfYear(),
                default => null,
            };

            if ($mulaiPeriode === null) {
                return false;
            }

            return ! ChecklistRun::query()
                ->where('checklist_template_id', $a->checklist_template_id)
                ->where('room_id', $a->room_id)
                ->where('laboratory_id', $a->laboratory_id)
                ->where('asset_id', $a->asset_id)
                ->where('status', 'selesai')
                ->where('selesai_pada', '>=', $mulaiPeriode)
                ->exists();
        })->values();

        $baris = $jatuhTempo->take($batas)->map(fn (ChecklistAssignment $a) => [
            'id' => $a->id,
            'judul' => $a->template?->nama ?? '—',
            'keterangan' => (ChecklistAssignment::PERIODE[$a->periode] ?? $a->periode)
                .' · '.($a->sumberDayaRingkas()['nama'] ?? '—'),
            'status' => 'jatuh tempo',
        ]);

        return $this->daftar($baris, $jatuhTempo->count());
    }

    /** @return array<string,mixed> */
    private function checklistPerJenis(): array
    {
        $hitung = ChecklistRun::query()
            ->join('checklist_templates', 'checklist_templates.id', '=', 'checklist_runs.checklist_template_id')
            ->selectRaw('checklist_templates.jenis as jenis, count(*) as jumlah')
            ->groupBy('checklist_templates.jenis')
            ->pluck('jumlah', 'jenis');

        return $this->sebaranDari($hitung, ChecklistTemplate::JENIS);
    }

    // --- Penagihan & penyewaan -------------------------------------------------

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

    /** @return array<string,mixed> */
    private function penyewaanTrenPendapatan(): array
    {
        $titik = [];

        for ($i = 5; $i >= 0; $i--) {
            $bulan = now()->subMonthsNoOverflow($i);

            $jumlah = Payment::query()
                ->whereYear('tanggal', $bulan->year)
                ->whereMonth('tanggal', $bulan->month)
                ->sum('jumlah');

            $titik[] = ['label' => $bulan->translatedFormat('M Y'), 'nilai' => (int) $jumlah];
        }

        return ['titik' => $titik, 'satuan' => 'rupiah'];
    }

    // --- Balanced Scorecard ------------------------------------------------------

    /** @return array<string,mixed> */
    private function bscPerPerspektif(): array
    {
        $kartu = app(Scorecard::class)->kartu((string) now()->year);

        // Memakai bentuk sebaran yang sama dengan widget kategori lain, tapi
        // `jumlah` di sini menyimpan SKOR, bukan cacahan — pembacanya
        // (bentuk `sebaran` untuk widget BSC) tahu ini dari kuncinya
        // (bsc.per-perspektif), sama seperti daftar kondisi/status lainnya
        // tahu kuncinya dari konteks widget masing-masing.
        $bagian = array_map(
            fn (array $p) => ['kode' => $p['kode'], 'nama' => $p['nama'], 'jumlah' => $p['skor']],
            $kartu['perspektif']
        );

        return ['bagian' => $bagian, 'nilai' => $kartu['skor']];
    }

    /** @return array<string,mixed> */
    private function bscTrenSkor(): array
    {
        $titik = array_map(
            fn (array $t) => ['label' => $t['periode'], 'nilai' => $t['skor']],
            app(Scorecard::class)->tren()
        );

        return ['titik' => $titik, 'satuan' => '%'];
    }

    // --- Lintas modul --------------------------------------------------------

    /**
     * Menggabungkan kondisi mendesak dari beberapa domain berbeda ke satu
     * panel. Widget ini sendiri tidak punya izin tunggal (lihat
     * RegistriWidget) — setiap butir di dalamnya diperiksa izinnya masing-
     * masing di sini, sehingga orang yang tidak berwenang atas kalibrasi
     * tetap dapat memasang panel ini tanpa pernah melihat butir kalibrasinya.
     *
     * @return array<string,mixed>
     */
    private function sistemPeringatan(User $pengguna, int $batas): array
    {
        $butir = collect();

        if (Gate::forUser($pengguna)->allows('kalibrasi.lihat')) {
            $n = Asset::query()->dalamCakupan($pengguna)->where('wajib_kalibrasi', true)
                ->whereDoesntHave('maintenances', fn ($q) => $q->kalibrasi()->where('status', 'selesai')
                    ->whereNotNull('berlaku_sampai')->whereDate('berlaku_sampai', '>=', today()))
                ->count();

            if ($n > 0) {
                $butir->push([
                    'id' => 'kalibrasi', 'judul' => "{$n} alat kalibrasinya kedaluwarsa",
                    'keterangan' => 'Alat otomatis diblokir dari reservasi.', 'status' => 'kedaluwarsa',
                ]);
            }
        }

        if (Gate::forUser($pengguna)->allows('pemeliharaan.lihat')) {
            $n = $this->pemeliharaanDalamCakupan(AssetMaintenance::query()->terlambat(), $pengguna)->count();

            if ($n > 0) {
                $butir->push([
                    'id' => 'pemeliharaan', 'judul' => "{$n} pekerjaan pemeliharaan terlambat",
                    'keterangan' => 'Melewati jadwal yang direncanakan.', 'status' => 'terlambat',
                ]);
            }
        }

        if (Gate::forUser($pengguna)->allows('checklist.lihat')) {
            $n = $this->checklistJatuhTempo(0)['nilai'];

            if ($n > 0) {
                $butir->push([
                    'id' => 'checklist', 'judul' => "{$n} checklist jatuh tempo",
                    'keterangan' => 'Belum diselesaikan sesuai periodenya.', 'status' => 'jatuh tempo',
                ]);
            }
        }

        if (Gate::forUser($pengguna)->allows('penyewaan.lihat')) {
            $n = Invoice::query()->belumLunas()->whereDate('jatuh_tempo', '<', today())->count();

            if ($n > 0) {
                $butir->push([
                    'id' => 'tagihan', 'judul' => "{$n} tagihan lewat jatuh tempo",
                    'keterangan' => 'Belum lunas melewati tanggal jatuh tempo.', 'status' => 'jatuh tempo',
                ]);
            }
        }

        return $this->daftar($butir->take($batas), $butir->count());
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
