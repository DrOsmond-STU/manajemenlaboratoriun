<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\BookingService;
use App\Services\KetersediaanRuangan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

class BookingController extends Controller
{
    public function __construct(
        private readonly BookingService $bookings,
        private readonly KetersediaanRuangan $ketersediaan,
    ) {}

    /**
     * Ruangan mana yang bebas pada sebuah rentang waktu.
     *
     * Jawabannya tetap PERKIRAAN: antara pemeriksaan dan penyimpanan selalu
     * ada jeda, dan jaminannya tetap pemicu basis data. Yang dicapai endpoint
     * ini adalah membuat penolakan pada langkah terakhir menjadi jarang —
     * bukan mustahil.
     */
    public function ketersediaan(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mulai' => ['required', 'date'],
            'selesai' => ['required', 'date', 'after:mulai'],
            'kapasitas_min' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ]);

        return response()->json([
            'data' => $this->ketersediaan->untukRentang(
                $request->user(),
                Carbon::parse($data['mulai']),
                Carbon::parse($data['selesai']),
                $data['kapasitas_min'] ?? null,
            ),
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Booking::query()
            ->dalamCakupan($request->user())
            ->with(['room:id,kode,nama', 'user:id,name'])
            ->latest('mulai');

        if ($request->filled('room_id')) {
            $query->where('room_id', $request->integer('room_id'));
        }

        if ($request->boolean('hanya_aktif')) {
            $query->aktif();
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('cari')) {
            $kata = $request->string('cari')->toString();
            $query->where(fn ($q) => $q
                ->where('keperluan', 'ilike', "%{$kata}%")
                ->orWhereHas('room', fn ($r) => $r->where('nama', 'ilike', "%{$kata}%"))
                ->orWhereHas('user', fn ($u) => $u->where('name', 'ilike', "%{$kata}%")));
        }

        return BookingResource::collection($query->paginate(25));
    }

    public function store(StoreBookingRequest $request): JsonResponse
    {
        $booking = $this->bookings->buat([
            ...$request->validated(),
            'user_id' => $request->user()->id,
            // Unit kerja disalin dari pemohon, bukan diterima dari permintaan:
            // bila dikirim pemanggil, penapisan cakupan dapat dilewati hanya
            // dengan mengaku berasal dari unit lain.
            'unit_kerja' => $request->user()->unit_kerja,
            'status' => 'menunggu',
        ]);

        return BookingResource::make($booking->load('room:id,kode,nama'))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Booking $booking): BookingResource
    {
        return BookingResource::make(
            $booking->load(['room:id,kode,nama', 'user:id,name'])
        );
    }
}
