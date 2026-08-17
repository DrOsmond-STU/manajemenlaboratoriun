<?php

namespace App\Services;

use App\Models\Asset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Pembentuk kode internal — penomoran kedua, milik satuan kerja sendiri.
 *
 * Polanya ditentukan pengguna lewat Pengaturan Sistem, misalnya:
 *
 *     STU/{LAB}/{KATEGORI}/{TAHUN}/{URUT}   →   STU/KIM-01/KROM/2022/0012
 *
 * Token yang dikenali:
 *
 *     {SATKER}    singkatan satuan kerja
 *     {LAB}       kode laboratorium/ruangan tempat barang ditempatkan
 *     {KATEGORI}  singkatan kategori alat
 *     {GEDUNG}    kode gedung
 *     {TAHUN}     tahun perolehan (4 digit)
 *     {BULAN}     bulan perolehan (2 digit)
 *     {URUT}      nomor urut internal (4 digit)
 *     {NUP}       NUP dari BMN (5 digit)
 *
 * Token yang tidak dikenali dibiarkan apa adanya, bukan dibuang diam-diam,
 * supaya salah ketik pada pola terlihat pada hasilnya dan bukan menghasilkan
 * kode yang tampak benar padahal kehilangan satu unsur.
 */
class KodeInternalGenerator
{
    public function __construct(private readonly NupAllocator $nup) {}

    /**
     * @param  array<string,string|int|null>  $nilai  Nilai untuk token, kunci tanpa kurung kurawal.
     */
    public function buat(string $pola, array $nilai): string
    {
        $urut = $nilai['URUT'] ?? $this->urutBerikutnya((string) $pola);

        $peta = [
            '{SATKER}' => (string) ($nilai['SATKER'] ?? ''),
            '{LAB}' => (string) ($nilai['LAB'] ?? ''),
            '{KATEGORI}' => (string) ($nilai['KATEGORI'] ?? ''),
            '{GEDUNG}' => (string) ($nilai['GEDUNG'] ?? ''),
            '{TAHUN}' => (string) ($nilai['TAHUN'] ?? ''),
            '{BULAN}' => str_pad((string) ($nilai['BULAN'] ?? ''), 2, '0', STR_PAD_LEFT),
            '{URUT}' => str_pad((string) $urut, 4, '0', STR_PAD_LEFT),
            '{NUP}' => str_pad((string) ($nilai['NUP'] ?? ''), 5, '0', STR_PAD_LEFT),
        ];

        $kode = strtr($pola, $peta);

        // Ruas kosong menyisakan garis miring berganda — misalnya barang yang
        // belum ditempatkan di ruangan mana pun. Dirapikan agar kode tetap
        // terbaca dan tetap dapat dipindai sebagai barcode.
        $kode = preg_replace('#/{2,}#', '/', $kode) ?? $kode;

        return trim($kode, '/ ');
    }

    /**
     * Nomor urut internal berikutnya, memakai pencatat yang sama dengan NUP.
     *
     * Dipakai bila pemanggil tidak menentukan {URUT} sendiri. Aman terhadap
     * balapan karena bersandar pada pernyataan atomik NupAllocator; kunci
     * pencatatnya diberi awalan `internal:` agar tidak bercampur dengan
     * pencatat NUP milik BMN.
     */
    private function urutBerikutnya(string $pola): int
    {
        return $this->nup->berikutnya('internal', Str::limit(md5($pola), 15, ''));
    }

    /**
     * Pastikan kode belum terpakai; bila sudah, tambahkan akhiran urut.
     *
     * Ini hanya kenyamanan agar pengguna tidak terhalang saat polanya belum
     * cukup membedakan. Jaminan sesungguhnya tetap indeks unik pada kolom
     * `kode_internal`.
     */
    public function pastikanUnik(string $kode): string
    {
        if (! $this->terpakai($kode)) {
            return $kode;
        }

        for ($i = 2; $i <= 999; $i++) {
            $calon = "{$kode}-{$i}";

            if (! $this->terpakai($calon)) {
                return $calon;
            }
        }

        // Sengaja tidak melempar: biarkan basis data yang menolak, agar pesan
        // galatnya seragam dengan jalur penyimpanan lain.
        return $kode;
    }

    private function terpakai(string $kode): bool
    {
        return DB::table('assets')->where('kode_internal', $kode)->exists()
            || Asset::onlyTrashed()->where('kode_internal', $kode)->exists();
    }
}
