<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
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
        $query = Booking::query()->with(['room:id,kode,nama', 'user:id,name'])->latest('mulai');

        if ($request->filled('room_id')) {
            $query->where('room_id', $request->integer('room_id'));
        }

        if ($request->boolean('hanya_aktif')) {
            $query->aktif();
        }

        return \App\Http\Resources\BookingResource::collection($query->paginate(25));
    }

    public function store(StoreBookingRequest $request): JsonResponse
    {
        $booking = $this->bookings->buat([
            ...$request->validated(),
            'user_id' => $request->user()->id,
            'status' => 'menunggu',
        ]);

        return \App\Http\Resources\BookingResource::make($booking->load('room:id,kode,nama'))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Booking $booking): \App\Http\Resources\BookingResource
    {
        return \App\Http\Resources\BookingResource::make(
            $booking->load(['room:id,kode,nama', 'user:id,name'])
        );
    }
}
