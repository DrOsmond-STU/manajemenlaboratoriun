<?php

namespace App\Http\Resources;

use App\Models\Asset;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Asset */
class AssetResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,

            // Dua penomoran, dikelompokkan agar antarmuka tidak perlu tahu
            // unsur mana milik BMN dan mana milik internal.
            'bmn' => [
                'id' => $this->bmn_id,
                'kode_lokasi' => $this->kode_lokasi,
                'kode_barang' => $this->kode_barang,
                'uraian_barang' => $this->whenLoaded('kodeBarang', fn () => $this->kodeBarang->uraian),
                'nup' => $this->nup,
                'nup_fmt' => $this->nup_fmt,
                'kib' => $this->kib,
            ],
            'kode_internal' => $this->kode_internal,

            'nama' => $this->nama,
            'merk' => $this->merk,
            'tipe' => $this->tipe,
            'serial_number' => $this->serial_number,
            'spesifikasi' => $this->spesifikasi,
            'kapasitas_ukur' => $this->kapasitas_ukur,
            'kelengkapan' => $this->kelengkapan ?? [],

            'foto' => [
                // URL foto utama saja pada daftar — memuat seluruh foto tiap
                // aset berarti puluhan baris tambahan untuk gambar yang tidak
                // ditampilkan sampai asetnya dibuka.
                'utama' => $this->whenLoaded(
                    'fotoUtama',
                    fn () => $this->fotoUtama
                        ? route('assets.foto.tampilkan', ['asset' => $this->id, 'foto' => $this->fotoUtama->id])
                        : null,
                ),
                'jumlah' => $this->whenCounted('photos'),
            ],

            'perolehan' => [
                'cara' => $this->cara_perolehan,
                'tanggal' => $this->tgl_perolehan?->toDateString(),
                'sumber_dana' => $this->sumber_dana,
                'no_bukti' => $this->no_bukti,
                'no_kontrak' => $this->no_kontrak,
                'kuantitas' => $this->kuantitas,
                'satuan' => $this->satuan,
            ],

            // Di luar cakupan penatausahaan BMN — dicatat karena berguna
            // untuk klaim garansi dan menghubungi pemasok, bukan karena
            // diwajibkan PMK 181/PMK.06/2016.
            'pemasok' => $this->pemasok,
            'garansi_berakhir' => $this->garansi_berakhir?->toDateString(),

            'penyusutan' => $this->penyusutan->toArray(),

            'kondisi' => [
                'kode' => $this->kondisi,
                'nama' => Asset::KONDISI[$this->kondisi] ?? $this->kondisi,
            ],
            'status_penggunaan' => $this->status_penggunaan,
            'psp' => [
                'nomor' => $this->no_psp,
                'tanggal' => $this->tgl_psp?->toDateString(),
            ],

            'wajib_kalibrasi' => (bool) $this->wajib_kalibrasi,
            // Kalibrasi selesai TERAKHIR — hanya untuk alat yang wajib
            // kalibrasi. `$terakhir` diambil SEKALI dan dipakai untuk kedua
            // medan supaya "kedaluwarsa" tidak dihitung ulang dengan kueri
            // terpisah dari `berlaku_sampai`-nya sendiri; rumusnya sengaja
            // sama persis dengan Asset::kalibrasiKedaluwarsa() (alat tanpa
            // kalibrasi sama sekali dianggap kedaluwarsa).
            'kalibrasi' => $this->when($this->wajib_kalibrasi, function () {
                $terakhir = $this->relationLoaded('maintenances')
                    ? $this->maintenances->first()
                    : $this->kalibrasiTerakhir();

                return [
                    'berlaku_sampai' => $terakhir?->berlaku_sampai?->toDateString(),
                    'kedaluwarsa' => $terakhir === null || $terakhir->berlaku_sampai->isPast(),
                ];
            }),
            'unit_kerja' => $this->unit_kerja,

            'laboratorium' => $this->whenLoaded('laboratory', fn () => $this->laboratory ? [
                'id' => $this->laboratory->id,
                'kode' => $this->laboratory->kode,
                'nama' => $this->laboratory->nama,
            ] : null),

            'ruangan' => $this->whenLoaded('room', fn () => $this->room ? [
                'id' => $this->room->id,
                'kode' => $this->room->kode,
                'nama' => $this->room->nama,
            ] : null),
            'penanggung_jawab' => $this->whenLoaded('penanggungJawab', fn () => $this->penanggungJawab ? [
                'id' => $this->penanggungJawab->id,
                'nama' => $this->penanggungJawab->name,
            ] : null),

            'keterangan' => $this->keterangan,
        ];
    }
}
