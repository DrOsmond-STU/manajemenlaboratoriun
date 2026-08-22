<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\QuotationResource;
use App\Models\Quotation;
use App\Models\Rental;
use App\Services\PenagihanService;
use App\Services\PenawaranService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PenawaranController extends Controller
{
    public function __construct(
        private readonly PenawaranService $penawaran,
        private readonly PenagihanService $penagihan,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Quotation::query()->with(['rental:id,penyewa,instansi', 'invoice:id,quotation_id,nomor'])->latest('tanggal');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->boolean('aktif')) {
            $query->aktif();
        }

        return QuotationResource::collection($query->paginate(25));
    }

    public function show(Quotation $penawaran): QuotationResource
    {
        return QuotationResource::make($penawaran->load(['lines', 'rental', 'invoice']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rental_id' => ['required', 'integer', 'exists:rentals,id'],
            'ppn_persen' => ['nullable', 'integer', 'min:0', 'max:100'],
            'berlaku_hari' => ['nullable', 'integer', 'min:1', 'max:365'],
            'baris' => ['nullable', 'array'],
            'baris.*.deskripsi' => ['required', 'string', 'max:250'],
            'baris.*.kuantitas' => ['required', 'integer', 'min:1'],
            'baris.*.satuan' => ['nullable', 'string', 'max:20'],
            'baris.*.harga_satuan' => ['required', 'integer', 'min:0'],
        ]);

        $sewa = Rental::findOrFail($data['rental_id']);

        $hasil = $this->penawaran->buat(
            $sewa,
            $request->user(),
            $data['ppn_persen'] ?? 0,
            $data['berlaku_hari'] ?? 14,
            array_map(fn ($b) => [
                'deskripsi' => $b['deskripsi'],
                'kuantitas' => $b['kuantitas'],
                'satuan' => $b['satuan'] ?? 'paket',
                'harga_satuan' => $b['harga_satuan'],
            ], $data['baris'] ?? []),
        );

        return QuotationResource::make($hasil->load(['lines', 'rental']))->response()->setStatusCode(201);
    }

    public function putuskan(Request $request, Quotation $penawaran): QuotationResource
    {
        $data = $request->validate([
            'keputusan' => ['required', Rule::in(['negosiasi', 'disetujui', 'ditolak'])],
        ]);

        $hasil = $this->penawaran->putuskan($penawaran, $data['keputusan']);

        return QuotationResource::make($hasil->load(['lines', 'rental']));
    }

    public function terbitkanInvoice(Request $request, Quotation $penawaran): JsonResponse
    {
        $data = $request->validate([
            'jatuh_tempo_hari' => ['nullable', 'integer', 'min:0', 'max:365'],
        ]);

        $tagihan = $this->penagihan->terbitkanDariPenawaran(
            $penawaran,
            $request->user(),
            $data['jatuh_tempo_hari'] ?? 14,
        );

        return InvoiceResource::make($tagihan->load(['lines', 'rental', 'quotation']))->response()->setStatusCode(201);
    }
}
