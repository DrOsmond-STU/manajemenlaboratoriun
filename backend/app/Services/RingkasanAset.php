<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\User;

/**
 * Angka ringkasan Register BMN.
 *
 * HARUS DIHITUNG SERVER, ATAS SELURUH ASET DALAM CAKUPAN — bukan atas
 * halaman yang sedang tampil. Daftar aset berhalaman 25 baris; ringkasan yang
 * dihitung antarmuka dari halaman pertama akan melaporkan nilai perolehan
 * seperempat miliar untuk satuan kerja yang asetnya bernilai puluhan miliar.
 * Angka itu tidak tampak salah — ia hanya kecil — dan justru karena itu tidak
 * ada yang mempertanyakannya.
 */
class RingkasanAset
{
    /**
     * @return array<string,mixed>
     */
    public function untuk(?User $pengguna, array $tapis = []): array
    {
        $query = Asset::query()->dalamCakupan($pengguna);

        if (! empty($tapis['kode_barang'])) {
            $query->where('kode_barang', 'like', $tapis['kode_barang'].'%');
        }

        if (! empty($tapis['kondisi'])) {
            $query->where('kondisi', $tapis['kondisi']);
        }

        if (! empty($tapis['room_id'])) {
            $query->where('room_id', $tapis['room_id']);
        }

        if (! empty($tapis['laboratory_id'])) {
            $query->where('laboratory_id', $tapis['laboratory_id']);
        }

        // Kolom yang dibutuhkan saja. Penyusutan dihitung PHP lewat kelas
        // Penyusutan, bukan diulang sebagai rumus SQL: rumus yang ditulis dua
        // kali akan menyimpang, dan yang menyimpang di sini adalah angka
        // laporan keuangan.
        //
        // BATASNYA: seluruh aset dalam cakupan ditarik ke memori. Untuk satuan
        // kerja laboratorium — ratusan sampai beberapa ribu aset dengan tujuh
        // kolom — ini murah. Bila kelak puluhan ribu, penggantinya adalah
        // kolom penyusutan yang dihitung terjadwal, bukan rumus SQL kedua.
        $baris = $query->with('kodeBarang:kode,uraian')->get([
            'id', 'kode_barang', 'kondisi', 'status_penggunaan',
            'nilai_perolehan', 'masa_manfaat', 'tgl_perolehan', 'garansi_berakhir',
        ]);

        $perolehan = 0;
        $akumulasi = 0;
        $buku = 0;
        $perKondisi = array_fill_keys(array_keys(Asset::KONDISI), 0);
        $garansiAkanBerakhir = 0;
        $sekarang = now()->startOfDay();
        $batasGaransi = $sekarang->copy()->addDays(90);
        $disposalJumlah = 0;
        $disposalNilaiBuku = 0;
        $perKodeBarang = [];

        foreach ($baris as $aset) {
            $p = $aset->penyusutan;

            $perolehan += $p->nilaiPerolehan;
            $akumulasi += $p->akumulasi;
            $buku += $p->nilaiBuku;

            if (array_key_exists($aset->kondisi, $perKondisi)) {
                $perKondisi[$aset->kondisi]++;
            }

            // Sudah berakhir TIDAK dihitung "akan berakhir" — bedanya penting
            // bagi asset manager: yang sudah lewat butuh tindakan lain
            // (klaim sudah tertutup), bukan sekadar diperpanjang.
            if ($aset->garansi_berakhir
                && $aset->garansi_berakhir->greaterThanOrEqualTo($sekarang)
                && $aset->garansi_berakhir->lessThanOrEqualTo($batasGaransi)) {
                $garansiAkanBerakhir++;
            }

            // 'Dihapuskan' adalah satu-satunya nilai baku status_penggunaan
            // dalam kode ini sendiri (lihat AssetService::hapus()) — kolom
            // ini bebas teks di luar itu, sehingga hanya nilai baku inilah
            // yang dapat dihitung dengan pasti sebagai "sudah dihapuskan".
            if ($aset->status_penggunaan === 'Dihapuskan') {
                $disposalJumlah++;
                $disposalNilaiBuku += $p->nilaiBuku;
            }

            $kb = $aset->kode_barang;
            if (! isset($perKodeBarang[$kb])) {
                $perKodeBarang[$kb] = [
                    'kode_barang' => $kb,
                    'uraian' => $aset->kodeBarang?->uraian ?? $kb,
                    'jumlah' => 0,
                    'nilai_perolehan' => 0,
                    'nilai_buku' => 0,
                ];
            }
            $perKodeBarang[$kb]['jumlah']++;
            $perKodeBarang[$kb]['nilai_perolehan'] += $p->nilaiPerolehan;
            $perKodeBarang[$kb]['nilai_buku'] += $p->nilaiBuku;
        }

        // Sepuluh kode barang terbanyak — cukup untuk gambaran komposisi
        // tanpa menenggelamkan layar bila satuan kerja punya ratusan kode
        // barang berbeda. Diurutkan dari yang paling banyak, bukan abjad,
        // karena itulah yang pertama ingin dilihat pengelola aset.
        $komposisi = collect($perKodeBarang)->sortByDesc('jumlah')->take(10)->values()->all();

        return [
            'jumlah' => $baris->count(),
            'nilai_perolehan' => $perolehan,
            'akumulasi_penyusutan' => $akumulasi,
            'nilai_buku' => $buku,
            'garansi_akan_berakhir' => $garansiAkanBerakhir,
            'disposal' => ['jumlah' => $disposalJumlah, 'nilai_buku' => $disposalNilaiBuku],
            'per_kode_barang' => $komposisi,
            'kondisi' => collect(Asset::KONDISI)->map(fn ($nama, $kode) => [
                'kode' => $kode,
                'nama' => $nama,
                'jumlah' => $perKondisi[$kode],
            ])->values()->all(),
        ];
    }
}
