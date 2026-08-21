<?php

namespace App\Services;

use App\Mail\PengingatJadwal;
use App\Models\AssetMaintenance;
use App\Models\Booking;
use App\Models\ChecklistAssignment;
use App\Models\EquipmentLoan;
use App\Models\NotificationLog;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

/**
 * Pengingat jadwal ke surel penanggung jawab.
 *
 * Memindai lima sumber jadwal, menentukan siapa penanggung jawabnya,
 * menghormati preferensi masing-masing, lalu mengirim — sekali saja.
 *
 * KEUNIKAN DIJAGA BASIS DATA, BUKAN PEMERIKSAAN DI SINI.
 *
 * Pola yang dipakai: catat dulu, kirim kemudian. Baris catatan ditulis lebih
 * dahulu; bila indeks unik menolaknya, artinya pengingat itu sudah pernah
 * dikirim dan prosesnya berhenti tanpa mengirim apa pun.
 *
 * Urutan itu penting. Bila surel dikirim lebih dulu lalu dicatat, dua proses
 * penjadwal yang berjalan bersamaan akan sama-sama lolos pemeriksaan dan
 * sama-sama mengirim — persis celah balapan yang sama seperti pada pemesanan
 * ruangan, hanya akibatnya berupa surel ganda alih-alih jadwal ganda.
 *
 * Pencatatannya memakai `insertOrIgnore`, BUKAN menangkap galat keunikan.
 * Pada PostgreSQL, pernyataan yang gagal meracuni seluruh transaksi: setiap
 * perintah sesudahnya ditolak sampai rollback. Menangkap galatnya karena itu
 * hanya bekerja bila kebetulan tidak ada transaksi yang membungkus — dan
 * ketergantungan sehalus itu akan patah pada pemanggil pertama yang
 * membungkusnya.
 */
class NotifikasiJadwalService
{
    /**
     * Pindai seluruh sumber dan kirim pengingat yang jatuh tempo.
     *
     * @return array{diperiksa:int, terkirim:int, dilewati:int, gagal:int}
     */
    public function jalankan(?Carbon $per = null): array
    {
        $per = $per ?? now();
        $hitung = ['diperiksa' => 0, 'terkirim' => 0, 'dilewati' => 0, 'gagal' => 0];

        foreach ($this->kumpulkanJadwal($per) as $jadwal) {
            $hitung['diperiksa']++;

            $hasil = $this->kirimSekali($jadwal, $per);
            $hitung[$hasil]++;
        }

        return $hitung;
    }

    /**
     * Seluruh jadwal yang perlu diingatkan, dari lima sumber.
     *
     * @return \Generator<int, array<string,mixed>>
     */
    private function kumpulkanJadwal(Carbon $per): \Generator
    {
        yield from $this->dariBooking($per);
        yield from $this->dariPeminjaman($per);
        yield from $this->dariPemeliharaan($per);
        yield from $this->dariChecklist($per);
    }

    /**
     * @return \Generator<int, array<string,mixed>>
     */
    private function dariBooking(Carbon $per): \Generator
    {
        $batas = $per->copy()->addDays(7);

        $daftar = Booking::query()
            ->with(['room:id,kode,nama,gedung', 'user:id,name,email'])
            ->aktif()
            ->whereBetween('mulai', [$per->copy()->startOfDay(), $batas])
            ->get();

        foreach ($daftar as $b) {
            if ($b->user === null) {
                continue;
            }

            yield [
                'penerima' => $b->user,
                'kategori' => 'booking',
                'sumber_tipe' => 'booking',
                'sumber_id' => $b->id,
                'tanggal' => $b->mulai,
                'judul' => 'Pemesanan ruangan: '.$b->keperluan,
                'tindakan' => 'Pastikan ruangan siap dan hadir sesuai jadwal.',
                'rincian' => array_filter([
                    'Ruangan' => $b->room?->nama,
                    'Gedung' => $b->room?->gedung,
                    'Waktu' => $b->mulai->timezone(config('app.timezone'))->format('d/m/Y H:i')
                        .'–'.$b->selesai->timezone(config('app.timezone'))->format('H:i'),
                    'Status' => $b->status,
                ]),
            ];
        }
    }

    /**
     * @return \Generator<int, array<string,mixed>>
     */
    private function dariPeminjaman(Carbon $per): \Generator
    {
        $daftar = EquipmentLoan::query()
            ->with(['asset:id,nama,kode_internal', 'user:id,name,email'])
            ->menahan()
            ->where(fn ($q) => $q
                ->whereBetween('mulai', [$per->copy()->startOfDay(), $per->copy()->addDays(7)])
                // Yang sudah lewat batas dan belum kembali juga diingatkan.
                ->orWhere(fn ($t) => $t->where('status', 'dipinjam')->where('selesai', '<', $per)))
            ->get();

        foreach ($daftar as $p) {
            if ($p->user === null) {
                continue;
            }

            $terlambat = $p->terlambat();

            yield [
                'penerima' => $p->user,
                'kategori' => 'peminjaman',
                'sumber_tipe' => $terlambat ? 'peminjaman_terlambat' : 'peminjaman',
                'sumber_id' => $p->id,
                'tanggal' => $terlambat ? $p->selesai : $p->mulai,
                'judul' => $terlambat
                    ? 'Alat belum dikembalikan: '.($p->asset?->nama ?? 'alat')
                    : 'Peminjaman alat: '.($p->asset?->nama ?? 'alat'),
                'tindakan' => $terlambat
                    ? 'Kembalikan alat ke pengelola, atau ajukan perpanjangan.'
                    : 'Ambil alat sesuai jadwal dan periksa kondisinya saat serah terima.',
                'rincian' => array_filter([
                    'Alat' => $p->asset?->nama,
                    'Kode internal' => $p->asset?->kode_internal,
                    'Keperluan' => $p->keperluan,
                    'Batas kembali' => $p->selesai->timezone(config('app.timezone'))->format('d/m/Y H:i'),
                ]),
            ];
        }
    }

    /**
     * @return \Generator<int, array<string,mixed>>
     */
    private function dariPemeliharaan(Carbon $per): \Generator
    {
        $daftar = AssetMaintenance::query()
            ->with(['asset:id,nama,kode_internal,penanggung_jawab_id', 'asset.penanggungJawab:id,name,email', 'petugas:id,name,email'])
            ->whereIn('status', ['dijadwalkan', 'berjalan'])
            ->whereDate('jadwal', '<=', $per->copy()->addDays(14))
            ->get();

        foreach ($daftar as $m) {
            // Penanggung jawab pekerjaan: petugas bila ditunjuk, selain itu
            // penanggung jawab alatnya. Tanpa keduanya, tidak ada yang dapat
            // diingatkan — dan itu sendiri patut terlihat pada laporan.
            $penerima = $m->petugas ?? $m->asset?->penanggungJawab;

            if ($penerima === null) {
                continue;
            }

            $kategori = $m->jenis === AssetMaintenance::JENIS_KALIBRASI ? 'kalibrasi' : 'pemeliharaan';

            yield [
                'penerima' => $penerima,
                'kategori' => $kategori,
                'sumber_tipe' => 'pemeliharaan',
                'sumber_id' => $m->id,
                'tanggal' => $m->jadwal,
                'judul' => $m->jenisNama().': '.($m->asset?->nama ?? 'alat'),
                'tindakan' => $kategori === 'kalibrasi'
                    ? 'Kirim alat ke lembaga kalibrasi dan catat nomor sertifikat serta masa berlakunya.'
                    : 'Kerjakan pemeliharaan sesuai jadwal, lalu catat hasilnya.',
                'rincian' => array_filter([
                    'Alat' => $m->asset?->nama,
                    'Kode internal' => $m->asset?->kode_internal,
                    'Jadwal' => $m->jadwal->format('d/m/Y'),
                    'Pelaksana' => $m->pelaksana,
                ]),
            ];
        }
    }

    /**
     * @return \Generator<int, array<string,mixed>>
     */
    private function dariChecklist(Carbon $per): \Generator
    {
        $daftar = ChecklistAssignment::query()
            ->with(['template', 'user:id,name,email', 'room:id,nama', 'laboratory:id,nama', 'asset:id,nama'])
            ->aktif()
            ->whereIn('periode', ['harian', 'mingguan'])
            ->get();

        foreach ($daftar as $t) {
            if ($t->user === null || $t->template === null || ! $t->template->aktif) {
                continue;
            }

            $sumber = $t->sumberDayaRingkas();

            yield [
                'penerima' => $t->user,
                'kategori' => 'checklist',
                'sumber_tipe' => 'checklist_'.$t->periode,
                'sumber_id' => $t->id,
                'tanggal' => $per->copy()->startOfDay(),
                'judul' => 'Checklist '.strtolower($t->template->jenisNama()).': '.($sumber['nama'] ?? '—'),
                'tindakan' => 'Kerjakan checklist dan isi seluruh butir wajibnya.',
                'rincian' => array_filter([
                    'Templat' => $t->template->nama,
                    'Sumber daya' => $sumber ? ucfirst($sumber['jenis']).' — '.$sumber['nama'] : null,
                    'Periode' => $t->periode,
                ]),
            ];
        }
    }

    /**
     * Kirim satu pengingat, sekali saja.
     *
     * @param  array<string,mixed>  $jadwal
     * @return 'terkirim'|'dilewati'|'gagal'
     */
    private function kirimSekali(array $jadwal, Carbon $per): string
    {
        /** @var User $penerima */
        $penerima = $jadwal['penerima'];
        $tanggal = Carbon::parse($jadwal['tanggal']);

        $preferensi = $this->preferensi($penerima, $jadwal['kategori']);

        if (! $preferensi['aktif']) {
            return 'dilewati';
        }

        $sisaHari = $per->copy()->startOfDay()->diffInDays($tanggal->copy()->startOfDay(), false);

        // Belum waktunya diingatkan.
        if ($sisaHari > $preferensi['h_min']) {
            return 'dilewati';
        }

        $sisaWaktu = match (true) {
            $sisaHari < 0 => 'terlambat',
            $sisaHari === 0 => 'hari-ini',
            default => 'akan-datang',
        };

        $kunci = [
            'user_id' => $penerima->id,
            'kategori' => $jadwal['kategori'],
            'sumber_tipe' => $jadwal['sumber_tipe'],
            'sumber_id' => $jadwal['sumber_id'],
            'tanggal_acuan' => $tanggal->toDateString(),
        ];

        // Catat DULU. `insertOrIgnore` mengembalikan 0 bila indeks unik
        // menolaknya — artinya pengingat ini sudah pernah dikirim, dan tidak
        // ada surel kedua yang terlanjur keluar.
        $tersimpan = DB::table('notification_logs')->insertOrIgnore([
            ...$kunci,
            'email' => $penerima->email,
            'perihal' => mb_substr($jadwal['judul'], 0, 200),
            'status' => 'terkirim',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($tersimpan === 0) {
            return 'dilewati';
        }

        $catatan = NotificationLog::where($kunci)->firstOrFail();

        try {
            Mail::to($penerima->email)->send(new PengingatJadwal(
                namaPenerima: $penerima->name,
                kategori: NotificationPreference::KATEGORI[$jadwal['kategori']] ?? $jadwal['kategori'],
                judul: $jadwal['judul'],
                tanggal: $tanggal->format('d/m/Y'),
                tindakan: $jadwal['tindakan'],
                rincian: $jadwal['rincian'] ?? [],
                sisaWaktu: $sisaWaktu,
            ));

            $catatan->update(['dikirim_pada' => now()]);

            return 'terkirim';
        } catch (\Throwable $e) {
            // Catatannya sengaja TIDAK dihapus. Menghapusnya berarti percobaan
            // berikutnya mengirim ulang ke alamat yang mungkin memang bermasalah,
            // berulang kali. Statusnya ditandai gagal supaya terlihat pada
            // laporan dan dapat ditangani manusia.
            $catatan->update(['status' => 'gagal', 'galat' => mb_substr($e->getMessage(), 0, 500)]);

            return 'gagal';
        }
    }

    /**
     * @return array{aktif:bool, h_min:int}
     */
    private function preferensi(User $pengguna, string $kategori): array
    {
        $p = NotificationPreference::where('user_id', $pengguna->id)
            ->where('kategori', $kategori)
            ->first();

        return [
            'aktif' => $p?->email_aktif ?? NotificationPreference::BAWAAN_AKTIF,
            'h_min' => $p?->ingatkan_h_min ?? NotificationPreference::BAWAAN_H_MIN,
        ];
    }
}
