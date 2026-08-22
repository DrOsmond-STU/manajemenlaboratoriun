<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\KembalikanPinjamanRequest;
use App\Http\Requests\StoreEquipmentLoanRequest;
use App\Http\Resources\EquipmentLoanResource;
use App\Models\EquipmentLoan;
use App\Services\AssetService;
use App\Services\EquipmentLoanService;
use App\Services\KetersediaanAlat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

class EquipmentLoanController extends Controller
{
    public function __construct(
        private readonly EquipmentLoanService $peminjaman,
        private readonly KetersediaanAlat $ketersediaan,
    ) {}

    /**
     * Alat mana yang bebas dipinjam pada sebuah rentang waktu.
     *
     * Selain bentrok jadwal, alat punya syarat kelayakan yang tidak dimiliki
     * ruangan: kalibrasi. Alat ukur berkalibrasi kedaluwarsa secara teknis
     * bebas, tetapi hasil pengujian yang memakainya tidak sah — jadi ia
     * ditandai tidak tersedia, dengan alasannya disebutkan.
     */
    public function ketersediaan(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mulai' => ['required', 'date'],
            'selesai' => ['required', 'date', 'after:mulai'],
            'cari' => ['nullable', 'string', 'max:100'],
        ]);

        return response()->json([
            'data' => $this->ketersediaan->untukRentang(
                $request->user(),
                Carbon::parse($data['mulai']),
                Carbon::parse($data['selesai']),
                $data['cari'] ?? null,
            ),
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = EquipmentLoan::query()
            ->dalamCakupan($request->user())
            ->with(['asset:id,nama,kode_internal,bmn_id', 'user:id,name'])
            ->latest('mulai');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('cari')) {
            $kata = $request->string('cari')->toString();
            $query->where(fn ($q) => $q
                ->where('keperluan', 'ilike', "%{$kata}%")
                ->orWhereHas('asset', fn ($a) => $a->where('nama', 'ilike', "%{$kata}%"))
                ->orWhereHas('user', fn ($u) => $u->where('name', 'ilike', "%{$kata}%")));
        }

        if ($request->filled('asset_id')) {
            $query->where('asset_id', $request->integer('asset_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->boolean('hanya_menahan')) {
            $query->menahan();
        }

        // Yang terlambat adalah pertanyaan pertama pengelola alat setiap pagi.
        if ($request->boolean('terlambat')) {
            $query->where('status', 'dipinjam')->where('selesai', '<', now());
        }

        // Rentang tanggal — dipakai Kalender Terpadu untuk mengambil satu
        // bulan sekaligus, bukan mengandalkan halaman 25-teratas yang bisa
        // saja tidak mencakup bulan yang sedang dilihat.
        if ($request->filled('sejak')) {
            $query->where('mulai', '>=', $request->date('sejak'));
        }
        if ($request->filled('sampai')) {
            $query->where('mulai', '<=', $request->date('sampai')->endOfDay());
        }

        // Rentang yang dibatasi tanggal wajar dipertaruhkan lebih besar —
        // lihat alasan yang sama pada BookingController::index.
        $ukuranHalaman = ($request->filled('sejak') && $request->filled('sampai')) ? 200 : 25;

        return EquipmentLoanResource::collection($query->paginate($ukuranHalaman));
    }

    public function store(StoreEquipmentLoanRequest $request): JsonResponse
    {
        $pinjaman = $this->peminjaman->ajukan($request->validated(), $request->user());

        return EquipmentLoanResource::make($pinjaman->load('asset:id,nama,kode_internal,bmn_id'))
            ->response()->setStatusCode(201);
    }

    public function show(EquipmentLoan $peminjaman): EquipmentLoanResource
    {
        return EquipmentLoanResource::make(
            $peminjaman->load(['asset:id,nama,kode_internal,bmn_id', 'user:id,name'])
        );
    }

    /** Serah terima: alat diambil peminjam. */
    public function serahkan(EquipmentLoan $peminjaman): EquipmentLoanResource
    {
        return EquipmentLoanResource::make(
            $this->peminjaman->serahkan($peminjaman)->load('asset:id,nama,kode_internal,bmn_id')
        );
    }

    /** Pengembalian, sekaligus mencatat kondisi alat saat kembali. */
    public function kembalikan(
        KembalikanPinjamanRequest $request,
        EquipmentLoan $peminjaman,
        AssetService $aset,
    ): EquipmentLoanResource {
        $hasil = $this->peminjaman->kembalikan(
            $peminjaman,
            $request->string('kondisi')->toString() ?: null,
            $request->string('catatan')->toString() ?: null,
            $aset,
            $request->user(),
        );

        return EquipmentLoanResource::make($hasil->load('asset:id,nama,kode_internal,bmn_id'));
    }
}
