<?php

namespace App\Http\Resources;

use App\Models\Quotation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Quotation */
class QuotationResource extends JsonResource
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
            'berlaku_sampai' => $this->berlaku_sampai?->toDateString(),
            'kedaluwarsa' => $this->kedaluwarsa(),
            'status' => ['kode' => $this->status, 'nama' => Quotation::STATUS[$this->status] ?? $this->status],
            'nilai' => [
                'subtotal' => $this->subtotal(),
                'ppn_persen' => $this->ppn_persen,
                'ppn' => $this->ppn(),
                'total' => $this->total(),
            ],
            'dapat_diterbitkan_invoice' => $this->dapatDiterbitkanInvoice(),
            'invoice_nomor' => $this->whenLoaded('invoice', fn () => $this->invoice?->nomor),
            'baris' => $this->whenLoaded('lines', fn () => $this->lines->map(fn ($l) => [
                'deskripsi' => $l->deskripsi,
                'kuantitas' => $l->kuantitas,
                'satuan' => $l->satuan,
                'harga_satuan' => $l->harga_satuan,
                'subtotal' => $l->subtotal,
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
