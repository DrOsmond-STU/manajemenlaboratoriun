<?php

namespace App\Services;

use App\Models\Dashboard;
use App\Models\User;
use App\Support\RegistriWidget;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class SusunanDashboard
{
    /** Lebar bawaan tiap bentuk widget pada kisi 12 kolom. */
    private const LEBAR_BAWAAN = ['angka' => 3, 'sebaran' => 4, 'daftar' => 6];

    /**
     * Menyimpan seluruh susunan sekaligus.
     *
     * Widget lama dihapus lalu ditulis ulang di dalam SATU transaksi. Alasannya
     * bukan kesederhanaan: menyunting per baris menuntut mencocokkan id dari
     * peramban dengan baris basis data, dan id yang dikirim peramban tidak
     * dapat dipercaya — pengirim dapat menyebut id widget milik dashboard orang
     * lain, lalu memindahkannya. Menulis ulang menghilangkan seluruh kelas
     * masalah itu, karena tidak ada satu pun id dari luar yang dipakai.
     *
     * @param  array<string,mixed>  $data
     */
    public function simpan(Dashboard $dashboard, array $data): Dashboard
    {
        return DB::transaction(function () use ($dashboard, $data) {
            $dashboard->fill([
                'nama' => $data['nama'],
                'jenis' => $data['jenis'] ?? $dashboard->jenis ?? 'operasional',
            ]);

            if (array_key_exists('utama', $data)) {
                // Satu dashboard utama per pengguna dijaga indeks unik parsial.
                // Yang lama diturunkan lebih dahulu supaya penyimpanan tidak
                // gagal hanya karena pengguna menandai dashboard kedua.
                if ($data['utama']) {
                    Dashboard::query()
                        ->where('user_id', $dashboard->user_id)
                        ->whereKeyNot($dashboard->id ?? 0)
                        ->update(['utama' => false]);
                }

                $dashboard->utama = (bool) $data['utama'];
            }

            $dashboard->save();

            $dashboard->widgets()->delete();

            foreach ($data['widgets'] as $w) {
                $dashboard->widgets()->create([
                    'widget' => $w['widget'],
                    'judul' => $w['judul'] ?? null,
                    'bentuk' => $w['bentuk'] ?? null,
                    // Hanya kunci opsi yang dikenal yang disimpan. Menyimpan
                    // apa adanya membuat jsonb menjadi tempat penampungan
                    // data sembarang yang dikirim balik ke peramban lain.
                    'opsi' => $this->opsiDikenal($w['opsi'] ?? null),
                    'kolom' => $w['kolom'], 'baris' => $w['baris'],
                    'lebar' => $w['lebar'], 'tinggi' => $w['tinggi'],
                ]);
            }

            return $dashboard->fresh();
        });
    }

    /**
     * Dashboard utama pengguna, dibuatkan bawaan bila belum ada.
     */
    public function utamaUntuk(User $pengguna): Dashboard
    {
        $ada = Dashboard::query()
            ->where('user_id', $pengguna->id)
            ->orderByDesc('utama')->orderBy('id')
            ->first();

        return $ada ?? $this->buatBawaan($pengguna);
    }

    /**
     * Susunan awal dari widget yang boleh dilihat pengguna ini.
     *
     * Teknisi lab dan petugas keuangan berakhir dengan dashboard yang berbeda
     * tanpa ada yang perlu mengaturnya — dan tidak ada satu pun kotak
     * "tidak berwenang" pada tampilan pertama, yang akan membuat aplikasi
     * terasa rusak sejak menit pertama.
     */
    public function buatBawaan(User $pengguna): Dashboard
    {
        $widgets = [];
        $kolom = 0;
        $baris = 0;

        foreach (RegistriWidget::BAWAAN as $kunci) {
            $ket = RegistriWidget::keterangan($kunci);

            if ($ket['izin'] !== null && ! Gate::forUser($pengguna)->allows($ket['izin'])) {
                continue;
            }

            $lebar = self::LEBAR_BAWAAN[$ket['bentuk']] ?? 4;

            // Pindah baris begitu sisa kolom tidak cukup — batasan CHECK di
            // basis data menolak widget yang menjorok keluar kisi.
            if ($kolom + $lebar > 12) {
                $kolom = 0;
                $baris++;
            }

            $widgets[] = [
                'widget' => $kunci,
                'kolom' => $kolom, 'baris' => $baris,
                'lebar' => $lebar, 'tinggi' => $ket['bentuk'] === 'daftar' ? 3 : 2,
            ];

            $kolom += $lebar;
        }

        return $this->simpan(
            new Dashboard(['user_id' => $pengguna->id]),
            ['nama' => 'Dashboard Saya', 'jenis' => 'operasional', 'utama' => true, 'widgets' => $widgets],
        );
    }

    /**
     * @param  array<string,mixed>|null  $opsi
     * @return array<string,mixed>|null
     */
    private function opsiDikenal(?array $opsi): ?array
    {
        if ($opsi === null) {
            return null;
        }

        $bersih = array_intersect_key($opsi, array_flip(['hari', 'batas', 'catatan']));

        return $bersih === [] ? null : $bersih;
    }
}
