<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\PaymentResource;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Rental;
use App\Services\PenagihanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PenyewaanController extends Controller
{
    public function __construct(private readonly PenagihanService $penagihan) {}

    // --- Penyewaan -----------------------------------------------------------

    public function daftarSewa(Request $request): JsonResponse
    {
        $query = Rental::query()->with(['room:id,kode,nama', 'laboratory:id,kode,nama'])->latest('mulai');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        return response()->json(['data' => $query->paginate(25)]);
    }

    public function buatSewa(Request $request): JsonResponse
    {
        $data = $request->validate([
            'penyewa' => ['required', 'string', 'max:150'],
            'instansi' => ['nullable', 'string', 'max:150'],
            'kontak' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:150'],
            'npwp' => ['nullable', 'string', 'max:30'],
            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'laboratory_id' => ['nullable', 'integer', 'exists:laboratories,id'],
            'mulai' => ['required', 'date'],
            'selesai' => ['required', 'date', 'after:mulai'],
            'segmen' => ['nullable', Rule::in(['internal', 'umum', 'pemerintah'])],
            'keperluan' => ['nullable', 'string', 'max:2000'],
        ]);

        $sewa = Rental::create([...$data, 'dibuat_oleh' => $request->user()->id]);

        return response()->json(['data' => $sewa], 201);
    }

    // --- Tagihan --------------------------------------------------------------

    public function terbitkanTagihan(Request $request, Rental $sewa): InvoiceResource
    {
        $data = $request->validate([
            'ppn_persen' => ['nullable', 'integer', 'min:0', 'max:100'],
            'jatuh_tempo_hari' => ['nullable', 'integer', 'min:0', 'max:365'],
            'baris' => ['nullable', 'array'],
            'baris.*.deskripsi' => ['required', 'string', 'max:250'],
            'baris.*.kuantitas' => ['required', 'integer', 'min:1'],
            'baris.*.satuan' => ['nullable', 'string', 'max:20'],
            'baris.*.harga_satuan' => ['required', 'integer', 'min:0'],
        ]);

        $tagihan = $this->penagihan->terbitkan(
            $sewa,
            $request->user(),
            $data['ppn_persen'] ?? 0,
            $data['jatuh_tempo_hari'] ?? 14,
            array_map(fn ($b) => [
                'deskripsi' => $b['deskripsi'],
                'kuantitas' => $b['kuantitas'],
                'satuan' => $b['satuan'] ?? 'paket',
                'harga_satuan' => $b['harga_satuan'],
            ], $data['baris'] ?? []),
        );

        return InvoiceResource::make($tagihan->load(['lines', 'rental']));
    }

    public function daftarTagihan(Request $request): AnonymousResourceCollection
    {
        $query = Invoice::query()->with(['rental:id,penyewa,instansi', 'lines'])->latest('tanggal');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->boolean('belum_lunas')) {
            $query->belumLunas();
        }

        // Yang lewat jatuh tempo adalah pertanyaan pertama bagian keuangan.
        if ($request->boolean('terlewat')) {
            $query->belumLunas()->whereDate('jatuh_tempo', '<', now());
        }

        return InvoiceResource::collection($query->paginate(25));
    }

    public function lihatTagihan(Invoice $tagihan): InvoiceResource
    {
        return InvoiceResource::make($tagihan->load(['lines', 'payments', 'rental', 'quotation']));
    }

    public function catatPembayaran(Request $request, Invoice $tagihan): InvoiceResource
    {
        $data = $request->validate([
            'tanggal' => ['required', 'date', 'before_or_equal:today'],
            'jumlah' => ['required', 'integer', 'min:1'],
            'metode' => ['nullable', Rule::in(['transfer', 'tunai', 'kartu', 'lainnya'])],
            'status' => ['nullable', Rule::in(['menunggu_verifikasi', 'terverifikasi'])],
            'referensi' => ['nullable', 'string', 'max:100'],
            'catatan' => ['nullable', 'string', 'max:1000'],
        ]);

        $this->penagihan->catatPembayaran($tagihan, $data, $request->user());

        return InvoiceResource::make(
            $this->penagihan->segarkanStatus($tagihan)->load(['lines', 'payments', 'rental'])
        );
    }

    /**
     * Pastikan pembayaran yang tercatat memang masuk — baru setelah ini
     * jumlahnya ikut dihitung `Invoice::terbayar()`.
     */
    public function verifikasiPembayaran(Payment $pembayaran): InvoiceResource
    {
        $pembayaran->update(['status' => 'terverifikasi']);

        $tagihan = $this->penagihan->segarkanStatus($pembayaran->invoice);

        return InvoiceResource::make($tagihan->load(['lines', 'payments', 'rental', 'quotation']));
    }

    /**
     * Riwayat pembayaran lintas tagihan — layar "Pembayaran" butuh daftar
     * global ini, bukan pembayaran per tagihan satu-satu.
     */
    public function daftarPembayaran(Request $request): AnonymousResourceCollection
    {
        $query = Payment::query()->with(['invoice:id,nomor,rental_id', 'invoice.rental:id,penyewa'])->latest('tanggal');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        return PaymentResource::collection($query->paginate(25));
    }
}
