<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Payment */
class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tanggal' => $this->tanggal?->toDateString(),
            'jumlah' => $this->jumlah,
            'metode' => $this->metode,
            'status' => ['kode' => $this->status, 'nama' => Payment::STATUS[$this->status] ?? $this->status],
            'referensi' => $this->referensi,
            'catatan' => $this->catatan,
            'invoice' => $this->whenLoaded('invoice', fn () => [
                'id' => $this->invoice->id,
                'nomor' => $this->invoice->nomor,
                'penyewa' => $this->invoice->relationLoaded('rental') ? $this->invoice->rental?->penyewa : null,
            ]),
        ];
    }
}
