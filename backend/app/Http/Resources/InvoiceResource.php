<?php

namespace App\Http\Resources;

use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Invoice */
class InvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nomor' => $this->nomor,
            'tanggal' => $this->tanggal?->toDateString(),
            'jatuh_tempo' => $this->jatuh_tempo?->toDateString(),
            'terlewat_jatuh_tempo' => $this->jatuhTempoTerlewat(),
            'status' => ['kode' => $this->status, 'nama' => Invoice::STATUS[$this->status] ?? $this->status],
            'nilai' => [
                'subtotal' => $this->subtotal(),
                'ppn_persen' => $this->ppn_persen,
                'ppn' => $this->ppn(),
                'total' => $this->total(),
                'terbayar' => $this->terbayar(),
                'sisa' => $this->sisa(),
            ],
            'baris' => $this->whenLoaded('lines', fn () => $this->lines->map(fn ($l) => [
                'deskripsi' => $l->deskripsi,
                'kuantitas' => $l->kuantitas,
                'satuan' => $l->satuan,
                'harga_satuan' => $l->harga_satuan,
                'subtotal' => $l->subtotal,
            ])),
            'pembayaran' => $this->whenLoaded('payments', fn () => $this->payments->map(fn ($p) => [
                'tanggal' => $p->tanggal?->toDateString(),
                'jumlah' => $p->jumlah,
                'metode' => $p->metode,
                'referensi' => $p->referensi,
            ])),
            'penyewaan' => $this->whenLoaded('rental', fn () => [
                'id' => $this->rental->id,
                'penyewa' => $this->rental->penyewa,
                'instansi' => $this->rental->instansi,
            ]),
            'catatan' => $this->catatan,
        ];
    }
}
