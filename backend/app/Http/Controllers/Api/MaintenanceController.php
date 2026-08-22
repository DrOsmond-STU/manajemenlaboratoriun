<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SelesaikanMaintenanceRequest;
use App\Http\Requests\StoreMaintenanceRequest;
use App\Http\Resources\AssetResource;
use App\Http\Resources\MaintenanceResource;
use App\Models\AssetMaintenance;
use App\Services\AssetService;
use App\Services\MaintenanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Pemeliharaan dan kalibrasi.
 *
 * Satu controller untuk keduanya, sebagaimana satu tabel — daftar jatuh tempo
 * yang dilihat teknisi menggabungkan keduanya, dan memisahkannya hanya
 * memaksa penggabungan kembali di setiap tempat.
 *
 * Izinnya tetap terpisah mengikuti matriks: menulis kalibrasi menuntut
 * `kalibrasi.*`, menulis pemeliharaan menuntut `pemeliharaan.*`.
 */
class MaintenanceController extends Controller
{
    /** Dimuat di mana pun resource ini dikembalikan — paling banyak satu yang benar-benar terisi. */
    private const RELASI = ['asset:id,nama,kode_internal', 'room:id,kode,nama', 'laboratory:id,kode,nama', 'petugas:id,name'];

    public function __construct(private readonly MaintenanceService $pemeliharaan) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->pastikanBolehMembaca($request);

        $query = AssetMaintenance::query()
            ->with(self::RELASI)
            ->orderBy('jadwal');

        if ($request->filled('asset_id')) {
            $query->where('asset_id', $request->integer('asset_id'));
        }

        if ($request->filled('room_id')) {
            $query->where('room_id', $request->integer('room_id'));
        }

        if ($request->filled('laboratory_id')) {
            $query->where('laboratory_id', $request->integer('laboratory_id'));
        }

        if ($request->filled('jenis')) {
            $query->where('jenis', $request->string('jenis')->toString());
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->boolean('terlambat')) {
            $query->terlambat();
        }

        if ($request->filled('jatuh_tempo_hari')) {
            $query->jatuhTempo($request->integer('jatuh_tempo_hari'));
        }

        // Rentang tanggal — dipakai Kalender Terpadu untuk mengambil satu
        // bulan sekaligus, bukan mengandalkan halaman 50-teratas yang bisa
        // saja tidak mencakup bulan yang sedang dilihat.
        if ($request->filled('sejak')) {
            $query->where('jadwal', '>=', $request->date('sejak'));
        }
        if ($request->filled('sampai')) {
            $query->where('jadwal', '<=', $request->date('sampai'));
        }

        return MaintenanceResource::collection($query->paginate(50));
    }

    public function store(StoreMaintenanceRequest $request): JsonResponse
    {
        $this->pastikanBolehMenulis($request, $request->string('jenis')->toString());

        $pekerjaan = $this->pemeliharaan->jadwalkan($request->validated());

        return MaintenanceResource::make($pekerjaan->load(self::RELASI))
            ->response()->setStatusCode(201);
    }

    public function show(Request $request, AssetMaintenance $pemeliharaan): MaintenanceResource
    {
        $this->pastikanBolehMembaca($request);

        return MaintenanceResource::make($pemeliharaan->load(self::RELASI));
    }

    public function selesaikan(
        SelesaikanMaintenanceRequest $request,
        AssetMaintenance $pemeliharaan,
        AssetService $aset,
    ): MaintenanceResource {
        $this->pastikanBolehMenulis($request, $pemeliharaan->jenis);

        $hasil = $this->pemeliharaan->selesaikan(
            $pemeliharaan,
            $request->validated(),
            $aset,
            $request->user(),
        );

        return MaintenanceResource::make($hasil->load(self::RELASI));
    }

    /**
     * Alat yang kalibrasinya kedaluwarsa — daftar yang paling dicari saat
     * menyiapkan audit, dan yang paling berisiko bila terlewat.
     */
    public function kalibrasiKedaluwarsa(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('kalibrasi.lihat'), 403);

        return AssetResource::collection($this->pemeliharaan->alatKalibrasiKedaluwarsa());
    }

    private function pastikanBolehMembaca(Request $request): void
    {
        abort_unless(
            $request->user()->hasAnyPermission(['pemeliharaan.lihat', 'kalibrasi.lihat']),
            403,
        );
    }

    private function pastikanBolehMenulis(Request $request, string $jenis): void
    {
        $izin = $jenis === AssetMaintenance::JENIS_KALIBRASI ? 'kalibrasi.ubah' : 'pemeliharaan.ubah';

        abort_unless($request->user()->can($izin), 403);
    }
}
