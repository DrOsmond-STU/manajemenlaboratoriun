<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TariffResource;
use App\Models\Tariff;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Tarif fasilitas, add-on, dan paket layanan — satu tabel, tiga tampilan.
 * Lihat docblock migrasi 2026_08_22_100000 untuk alasannya.
 */
class TarifController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Tariff::query()->with(['room:id,kode,nama', 'laboratory:id,kode,nama'])->orderBy('nama');

        if ($request->filled('jenis')) {
            $query->jenis($request->string('jenis')->toString());
        }

        if (! $request->boolean('sertakan_nonaktif')) {
            $query->aktif();
        }

        return TariffResource::collection($query->get());
    }

    public function store(Request $request): TariffResource
    {
        $data = $this->validasi($request);

        return TariffResource::make(Tariff::create($data));
    }

    public function update(Request $request, Tariff $tarif): TariffResource
    {
        $data = $this->validasi($request);
        $tarif->update($data);

        return TariffResource::make($tarif);
    }

    /**
     * @return array<string, mixed>
     */
    private function validasi(Request $request): array
    {
        return $request->validate([
            'nama' => ['required', 'string', 'max:150'],
            'jenis' => ['required', Rule::in(array_keys(Tariff::JENIS))],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'laboratory_id' => ['nullable', 'integer', 'exists:laboratories,id'],
            'satuan_waktu' => ['required', Rule::in(array_keys(Tariff::SATUAN))],
            'harga' => ['required', 'integer', 'min:0'],
            'segmen' => ['required', Rule::in(array_keys(Tariff::SEGMEN))],
            'deskripsi' => ['nullable', 'string', 'max:2000'],
            'kapasitas' => ['nullable', 'integer', 'min:1'],
            'aktif' => ['sometimes', 'boolean'],
        ]);
    }
}
