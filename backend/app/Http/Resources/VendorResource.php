<?php

namespace App\Http\Resources;

use App\Models\Vendor;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Vendor
 */
class VendorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kode' => $this->kode,
            'nama' => $this->nama,
            'kategori' => $this->kategori,
            'pic' => [
                'nama' => $this->pic_nama,
                'telepon' => $this->pic_telepon,
                'email' => $this->pic_email,
            ],
            'rating' => $this->rating,
            'kontrak_berlaku_sampai' => $this->kontrak_berlaku_sampai?->toDateString(),
            'aktif' => $this->aktif,
            'catatan' => $this->catatan,
            // Dihitung sekali di sini lewat withCount/withSum pada
            // VendorController::index() — bukan N+1 query per baris.
            'jumlah_pekerjaan' => $this->whenCounted('maintenances'),
            'total_biaya' => $this->when(
                $this->maintenances_sum_biaya !== null,
                fn () => (int) $this->maintenances_sum_biaya,
                0,
            ),
        ];
    }
}
