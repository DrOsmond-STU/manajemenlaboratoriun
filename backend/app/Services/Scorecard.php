<?php

namespace App\Services;

use App\Models\BscIndikator;
use App\Models\BscObjective;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class Scorecard
{
    /**
     * Menyimpan satu perspektif secara utuh: sasaran strategisnya sekaligus
     * indikator di dalam tiap sasaran.
     *
     * Sasaran dan indikator ditulis ulang seluruhnya dalam SATU transaksi,
     * karena bobot indikator hanya boleh berjumlah 100 pada akhir transaksi.
     * Menyunting satu per satu lewat permintaan terpisah mustahil: menghapus
     * satu indikator saja sudah membuat jumlahnya kurang dari 100, dan tidak
     * ada urutan langkah yang membuatnya sah di setiap titik. Sasaran ikut
     * ditulis ulang karena `bsc_objective_id` pada indikator wajib menunjuk
     * ke sasaran yang benar-benar ada — sasaran lama dihapus lewat
     * cascadeOnDelete begitu tidak dipakai lagi.
     *
     * Realisasi yang sudah ada dipertahankan berdasarkan NAMA indikator —
     * bukan id, yang berubah tiap tulis ulang — dan tidak bergantung pada
     * sasaran mana indikator itu berada, karena namanya tetap unik dalam satu
     * perspektif walau dipindah ke sasaran lain. Kalau tidak, memindahkan
     * satu indikator ke sasaran yang berbeda akan menghapus seluruh angka
     * realisasi yang sudah dikumpulkan sepanjang tahun.
     *
     * @param  list<array{nama: string, urutan?: int, indikator: list<array<string,mixed>>}>  $objectives
     * @return Collection<int, BscObjective>
     */
    public function simpanPerspektif(string $periode, string $perspektif, array $objectives): Collection
    {
        return DB::transaction(function () use ($periode, $perspektif, $objectives) {
            $sebelum = $this->ringkas($this->muatSasaran($periode, $perspektif));

            $lama = BscIndikator::query()
                ->periode($periode)->where('perspektif', $perspektif)
                ->get()
                ->keyBy(fn (BscIndikator $i) => mb_strtolower($i->nama));

            // Menghapus sasarannya cukup — cascadeOnDelete membawa serta
            // seluruh indikator di dalamnya.
            BscObjective::query()->periode($periode)->where('perspektif', $perspektif)->delete();

            // Peristiwa model dimatikan selama penulisan ulang: entri per
            // baris di sini justru merusak jejak auditnya, bukan
            // memperkayanya. Penggantinya satu entri di bawah.
            BscIndikator::withoutEvents(function () use ($objectives, $periode, $perspektif, $lama) {
                foreach ($objectives as $urutanSasaran => $sasaran) {
                    $objective = BscObjective::create([
                        'periode' => $periode,
                        'perspektif' => $perspektif,
                        'nama' => $sasaran['nama'],
                        'urutan' => $urutanSasaran,
                    ]);

                    foreach ($sasaran['indikator'] as $urutan => $i) {
                        $kunci = mb_strtolower($i['nama']);

                        BscIndikator::create([
                            'periode' => $periode,
                            'perspektif' => $perspektif,
                            'bsc_objective_id' => $objective->id,
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
                }
            });

            $hasil = $this->muatSasaran($periode, $perspektif);
            $sesudah = $this->ringkas($hasil);

            if ($sebelum !== $sesudah) {
                AuditService::catatPeristiwa(
                    peristiwa: $sebelum === [] ? 'dibuat' : ($sesudah === [] ? 'dihapus' : 'diubah'),
                    model: 'BscPerspektif',
                    label: (BscIndikator::PERSPEKTIF[$perspektif] ?? $perspektif).' · '.$periode,
                    sebelum: $sebelum === [] ? [] : ['sasaran' => $sebelum],
                    sesudah: $sesudah === [] ? [] : ['sasaran' => $sesudah],
                );
            }

            return $hasil;
        });
    }

    /**
     * @return Collection<int, BscObjective>
     */
    private function muatSasaran(string $periode, string $perspektif): Collection
    {
        return BscObjective::query()
            ->periode($periode)->where('perspektif', $perspektif)
            ->orderBy('urutan')
            ->with('indikator')
            ->get();
    }

    /**
     * Ringkasan sasaran + indikator untuk jejak audit.
     *
     * Hanya yang menentukan penilaian: nama sasaran, dan per indikator nama,
     * arah, target, bobot, realisasi. Id tidak ikut — id berubah pada setiap
     * penulisan ulang, dan memasukkannya akan membuat setiap penyimpanan
     * tampak sebagai perubahan meski tidak ada satu angka pun yang berbeda.
     *
     * @param  Collection<int, BscObjective>  $sasaran
     * @return list<array<string,mixed>>
     */
    private function ringkas(Collection $sasaran): array
    {
        return $sasaran->map(fn (BscObjective $o) => [
            'nama' => $o->nama,
            'indikator' => $o->indikator->map(fn (BscIndikator $i) => [
                'nama' => $i->nama,
                'polaritas' => $i->polaritas,
                'target' => $i->target,
                'bobot' => $i->bobot,
                'realisasi' => $i->realisasi,
            ])->values()->all(),
        ])->values()->all();
    }

    /**
     * Kartu skor satu periode.
     *
     * @return array<string,mixed>
     */
    public function kartu(string $periode): array
    {
        $sasaran = BscObjective::query()->periode($periode)
            ->orderBy('urutan')->orderBy('id')
            ->with(['indikator' => fn ($q) => $q->orderBy('urutan')->orderBy('id')])
            ->get()
            ->groupBy('perspektif');

        $perspektif = [];

        // Ditelusuri dari daftar perspektif yang sah, bukan dari hasil kueri:
        // perspektif yang belum digarap tetap harus muncul sebagai kosong.
        // Menghilangkannya membuat kartu skor tampak lengkap padahal seperempat
        // kerangkanya tidak pernah disentuh — dan itu justru temuan yang
        // paling perlu terlihat.
        foreach (BscIndikator::PERSPEKTIF as $kode => $nama) {
            $daftarSasaran = $sasaran[$kode] ?? collect();
            $seluruhIndikator = $daftarSasaran->flatMap(fn (BscObjective $o) => $o->indikator);

            $perspektif[] = [
                'kode' => $kode,
                'nama' => $nama,
                'bobot_total' => round((float) $seluruhIndikator->sum('bobot'), 2),
                'skor' => $this->skorPerspektif($seluruhIndikator),
                'sasaran' => $daftarSasaran->map(fn (BscObjective $o) => [
                    'id' => $o->id,
                    'nama' => $o->nama,
                    'indikator' => $o->indikator->map(fn (BscIndikator $i) => $this->indikatorUntukKartu($i))->values()->all(),
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
     * @return array<string,mixed>
     */
    private function indikatorUntukKartu(BscIndikator $i): array
    {
        return [
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

    /**
     * Skor total tiap periode yang pernah tercatat, terurut waktu.
     *
     * Dipakai sebagai tren skor BSC. Purwarupa mengasumsikan riwayat
     * bulanan, tetapi periode BSC di sini tahunan atau triwulanan
     * (lihat validasi periode) — tidak ada satu pun tempat yang menyimpan
     * "skor bulan Maret" secara terpisah, dan mengarang angka bulanan dari
     * data yang sama sekali tidak berbutir bulan akan menjadi tren yang
     * kelihatan meyakinkan tapi dikarang. Karena itu trennya mengikuti
     * granularitas yang SUNGGUHAN dipakai: satu titik per periode yang
     * pernah diisi, bukan satu titik per bulan kalender.
     *
     * @return list<array{periode: string, skor: ?float}>
     */
    public function tren(): array
    {
        $periode = BscIndikator::query()
            ->select('periode')->distinct()
            ->orderBy('periode')
            ->pluck('periode');

        return $periode->map(fn (string $p) => [
            'periode' => $p,
            'skor' => $this->kartu($p)['skor'],
        ])->all();
    }
}
