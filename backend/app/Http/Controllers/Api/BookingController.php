<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BookingController extends Controller
{
    public function __construct(private readonly BookingService $bookings) {}

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
