<?php

namespace App\Services;

use App\Models\BscIndikator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class Scorecard
{
    /**
     * Menyimpan satu perspektif secara utuh.
     *
     * Perspektif ditulis ulang seluruhnya dalam SATU transaksi, karena bobot
     * hanya boleh berjumlah 100 pada akhir transaksi. Menyunting indikator
     * satu per satu lewat permintaan terpisah mustahil: menghapus satu
     * indikator saja sudah membuat jumlahnya kurang dari 100, dan tidak ada
     * urutan langkah yang membuatnya sah di setiap titik.
     *
     * Realisasi yang sudah ada dipertahankan berdasarkan NAMA indikator —
     * bukan id, yang berubah tiap tulis ulang. Kalau tidak, mengubah bobot
     * satu indikator akan menghapus seluruh angka realisasi yang sudah
     * dikumpulkan sepanjang tahun.
     *
     * Jejaknya dicatat sebagai SATU entri berisi keadaan perspektif sebelum
     * dan sesudah, bukan satu entri per baris. Penulisan ulang menghasilkan
     * baris-baris baru, dan mencatatnya per baris akan tampak seolah
     * indikator baru ditambahkan padahal yang berubah hanya bobotnya —
     * sementara indikator yang dihapus tidak tercatat sama sekali, karena
     * penghapusan massal tidak melepas peristiwa model.
     *
     * @param  list<array<string,mixed>>  $indikator
     * @return Collection<int, BscIndikator>
     */
    public function simpanPerspektif(string $periode, string $perspektif, array $indikator): Collection
    {
        return DB::transaction(function () use ($periode, $perspektif, $indikator) {
            $sebelum = $this->ringkas(BscIndikator::query()
                ->periode($periode)->where('perspektif', $perspektif)
                ->orderBy('urutan')->get());

            $lama = BscIndikator::query()
                ->periode($periode)->where('perspektif', $perspektif)
                ->get()
                ->keyBy(fn (BscIndikator $i) => mb_strtolower($i->nama));

            BscIndikator::query()
                ->periode($periode)->where('perspektif', $perspektif)
                ->delete();

            // Peristiwa model dimatikan selama penulisan ulang: entri per
            // baris di sini justru merusak jejak auditnya, bukan
            // memperkayanya. Penggantinya satu entri di bawah.
            BscIndikator::withoutEvents(function () use ($indikator, $periode, $perspektif, $lama) {
                foreach ($indikator as $urutan => $i) {
                    $kunci = mb_strtolower($i['nama']);

                    BscIndikator::create([
                        'periode' => $periode,
                        'perspektif' => $perspektif,
                        'nama' => $i['nama'],
                        'satuan' => $i['satuan'] ?? null,
                        'polaritas' => $i['polaritas'],
                        'target' => $i['target'],
                        'bobot' => $i['bobot'],
                        'urutan' => $urutan,
                        'catatan' => $i['catatan'] ?? null,
                        'realisasi' => array_key_exists('realisasi', $i)
                            ? $i['realisasi']
                            : $lama[$kunci]?->realisasi ?? null,
                    ]);
                }
            });

            $hasil = BscIndikator::query()
                ->periode($periode)->where('perspektif', $perspektif)
                ->orderBy('urutan')->get();

            $sesudah = $this->ringkas($hasil);

            if ($sebelum !== $sesudah) {
                AuditService::catatPeristiwa(
                    peristiwa: $sebelum === [] ? 'dibuat' : ($sesudah === [] ? 'dihapus' : 'diubah'),
                    model: 'BscPerspektif',
                    label: (BscIndikator::PERSPEKTIF[$perspektif] ?? $perspektif).' · '.$periode,
                    sebelum: $sebelum === [] ? [] : ['indikator' => $sebelum],
                    sesudah: $sesudah === [] ? [] : ['indikator' => $sesudah],
                );
            }

            return $hasil;
        });
    }

    /**
     * Ringkasan perspektif untuk jejak audit.
     *
     * Hanya yang menentukan penilaian: nama, arah, target, bobot, realisasi.
     * Id tidak ikut — id berubah pada setiap penulisan ulang, dan
     * memasukkannya akan membuat setiap penyimpanan tampak sebagai perubahan
     * meski tidak ada satu angka pun yang berbeda.
     *
     * @param  Collection<int, BscIndikator>  $daftar
     * @return list<array<string,mixed>>
     */
    private function ringkas(Collection $daftar): array
    {
        return $daftar->map(fn (BscIndikator $i) => [
            'nama' => $i->nama,
            'polaritas' => $i->polaritas,
            'target' => $i->target,
            'bobot' => $i->bobot,
            'realisasi' => $i->realisasi,
        ])->values()->all();
    }

    /**
     * Kartu skor satu periode.
     *
     * @return array<string,mixed>
     */
    public function kartu(string $periode): array
    {
        $semua = BscIndikator::query()->periode($periode)
            ->orderBy('urutan')->orderBy('id')->get()
            ->groupBy('perspektif');

        $perspektif = [];

        // Ditelusuri dari daftar perspektif yang sah, bukan dari hasil kueri:
        // perspektif yang belum digarap tetap harus muncul sebagai kosong.
        // Menghilangkannya membuat kartu skor tampak lengkap padahal seperempat
        // kerangkanya tidak pernah disentuh — dan itu justru temuan yang
        // paling perlu terlihat.
        foreach (BscIndikator::PERSPEKTIF as $kode => $nama) {
            $daftar = $semua[$kode] ?? collect();

            $perspektif[] = [
                'kode' => $kode,
                'nama' => $nama,
                'bobot_total' => round((float) $daftar->sum('bobot'), 2),
                'skor' => $this->skorPerspektif($daftar),
                'indikator' => $daftar->map(fn (BscIndikator $i) => [
                    'id' => $i->id,
                    'nama' => $i->nama,
                    'satuan' => $i->satuan,
                    'polaritas' => [
                        'kode' => $i->polaritas,
                        'nama' => BscIndikator::POLARITAS[$i->polaritas] ?? $i->polaritas,
                    ],
                    'target' => $i->target,
                    'realisasi' => $i->realisasi,
                    'bobot' => $i->bobot,
                    'capaian' => $i->capaian(),
                    'catatan' => $i->catatan,
                ])->values()->all(),
            ];
        }

        return [
            'periode' => $periode,
            'perspektif' => $perspektif,
            'skor' => $this->skorTotal($perspektif),
        ];
    }

    /**
     * Skor satu perspektif: rata-rata capaian tertimbang bobotnya.
     *
     * Indikator yang realisasinya BELUM diisi dikeluarkan dari pembagi, bukan
     * dihitung nol. Menghitungnya nol membuat kartu skor bulan Januari selalu
     * tampak merah padahal datanya memang belum masuk — dan orang berhenti
     * mempercayai angkanya sebelum tahunnya berjalan.
     *
     * @param  Collection<int, BscIndikator>  $daftar
     */
    private function skorPerspektif(Collection $daftar): ?float
    {
        $terisi = $daftar->filter(fn (BscIndikator $i) => $i->realisasi !== null);

        $bobot = (float) $terisi->sum('bobot');

        if ($bobot <= 0.0) {
            return null;
        }

        $jumlah = $terisi->sum(fn (BscIndikator $i) => $i->capaianTerbatas() * $i->bobot);

        return round($jumlah / $bobot, 2);
    }

    /**
     * Skor gabungan: rata-rata skor perspektif yang sudah punya angka.
     *
     * Keempat perspektif berbobot sama. Kaplan & Norton tidak menetapkan
     * pembobotan antarperspektif, dan memberi bobot berbeda diam-diam adalah
     * keputusan manajemen yang harus diambil sadar — bukan disembunyikan di
     * dalam kode.
     *
     * @param  list<array<string,mixed>>  $perspektif
     */
    private function skorTotal(array $perspektif): ?float
    {
        $skor = array_values(array_filter(
            array_column($perspektif, 'skor'),
            fn (?float $s) => $s !== null,
        ));

        return $skor === [] ? null : round(array_sum($skor) / count($skor), 2);
    }
}
