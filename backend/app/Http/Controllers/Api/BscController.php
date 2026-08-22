<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SimpanPerspektifBscRequest;
use App\Models\BscIndikator;
use App\Services\Scorecard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BscController extends Controller
{
    public function __construct(private readonly Scorecard $scorecard) {}

    /** Kartu skor satu periode. */
    public function kartu(Request $request): JsonResponse
    {
        $periode = $request->string('periode')->toString() ?: (string) now()->year;

        return response()->json(['data' => $this->scorecard->kartu($periode)]);
    }

    /** Kerangka pilihan: perspektif dan arah indikator yang dikenal. */
    public function kerangka(): JsonResponse
    {
        return response()->json(['data' => [
            'perspektif' => BscIndikator::PERSPEKTIF,
            'polaritas' => BscIndikator::POLARITAS,
        ]]);
    }

    public function simpanPerspektif(SimpanPerspektifBscRequest $request): JsonResponse
    {
        $data = $request->validated();

        $this->scorecard->simpanPerspektif(
            $data['periode'], $data['perspektif'], $data['objectives'],
        );

        return response()->json(['data' => $this->scorecard->kartu($data['periode'])]);
    }

    /** Skor total tiap periode yang pernah tercatat — tren scorecard. */
    public function tren(): JsonResponse
    {
        return response()->json(['data' => $this->scorecard->tren()]);
    }

    /**
     * Mengisi realisasi satu indikator.
     *
     * Terpisah dari penyuntingan kerangka, dan sengaja: mengisi angka bulanan
     * adalah pekerjaan rutin, sementara mengubah target atau bobot adalah
     * keputusan manajemen. Menyatukan keduanya dalam satu endpoint membuat
     * pengisian rutin berpeluang menggeser targetnya sendiri — cara paling
     * mudah membuat setiap indikator tampak tercapai.
     */
    public function isiRealisasi(Request $request, BscIndikator $indikator): JsonResponse
    {
        $data = $request->validate([
            'realisasi' => ['present', 'nullable', 'numeric'],
            'catatan' => ['nullable', 'string', 'max:1000'],
        ]);

        $indikator->update($data);

        return response()->json(['data' => [
            'id' => $indikator->id,
            'nama' => $indikator->nama,
            'realisasi' => $indikator->realisasi,
            'capaian' => $indikator->capaian(),
        ]]);
    }

    public function hapusPeriode(Request $request): JsonResponse
    {
        $periode = $request->string('periode')->toString();

        if (! preg_match('/^\d{4}(-Q[1-4])?$/', $periode)) {
            throw ValidationException::withMessages(['periode' => 'Periode tidak sah.']);
        }

        $jumlah = BscIndikator::query()->periode($periode)->delete();

        return response()->json(['pesan' => "{$jumlah} indikator periode {$periode} dihapus."]);
    }
}
