<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Http\Resources\EquipmentLoanResource;
use App\Models\Booking;
use App\Models\EquipmentLoan;
use App\Services\PersetujuanService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Kotak persetujuan.
 *
 * Dipisahkan dari controller masing-masing modul karena yang dikerjakan
 * pemutus berbeda dari yang dikerjakan pemohon: ia menelusuri antrean lintas
 * modul, bukan mengelola satu pengajuan miliknya sendiri.
 */
class PersetujuanController extends Controller
{
    public function __construct(private readonly PersetujuanService $persetujuan) {}

    /**
     * Antrean yang menunggu keputusan saya.
     *
     * Pengajuan sendiri sengaja DIKELUARKAN dari daftar. Menampilkannya hanya
     * untuk ditolak saat diklik adalah cara paling pasti membuat orang
     * mengira sistemnya rusak.
     */
    public function antrean(Request $request): AnonymousResourceCollection
    {
        $jenis = $request->string('jenis')->toString() ?: 'booking';

        if ($jenis === 'peminjaman') {
            abort_unless($request->user()->can('booking-alat.ubah'), 403);

            $query = EquipmentLoan::query()
                ->dalamCakupan($request->user())
                ->where('status', 'menunggu')
                ->where('user_id', '!=', $request->user()->id)
                ->with(['asset:id,nama,kode_internal,bmn_id', 'user:id,name'])
                ->orderBy('mulai');

            return EquipmentLoanResource::collection($query->paginate(25));
        }

        abort_unless($request->user()->can('booking-ruangan.ubah'), 403);

        $query = Booking::query()
            ->dalamCakupan($request->user())
            ->where('status', 'menunggu')
            ->where('user_id', '!=', $request->user()->id)
            ->with(['room:id,kode,nama', 'user:id,name'])
            ->orderBy('mulai');

        return BookingResource::collection($query->paginate(25));
    }

    // --- Pemesanan ruangan --------------------------------------------------

    public function setujuiBooking(Request $request, Booking $booking): BookingResource
    {
        abort_unless($request->user()->can('booking-ruangan.ubah'), 403);

        $data = $request->validate(['catatan' => ['nullable', 'string', 'max:1000']]);

        $hasil = $this->persetujuan->setujui($booking, $request->user(), $data['catatan'] ?? null);

        return BookingResource::make($hasil->load(['room:id,kode,nama', 'user:id,name']));
    }

    public function tolakBooking(Request $request, Booking $booking): BookingResource
    {
        abort_unless($request->user()->can('booking-ruangan.ubah'), 403);

        $data = $request->validate(['alasan' => ['required', 'string', 'max:1000']]);

        $hasil = $this->persetujuan->tolak($booking, $request->user(), $data['alasan']);

        return BookingResource::make($hasil->load(['room:id,kode,nama', 'user:id,name']));
    }

    // --- Peminjaman alat -----------------------------------------------------

    public function setujuiPeminjaman(Request $request, EquipmentLoan $peminjaman): EquipmentLoanResource
    {
        abort_unless($request->user()->can('booking-alat.ubah'), 403);

        $data = $request->validate(['catatan' => ['nullable', 'string', 'max:1000']]);

        $hasil = $this->persetujuan->setujui($peminjaman, $request->user(), $data['catatan'] ?? null);

        return EquipmentLoanResource::make($hasil->load('asset:id,nama,kode_internal,bmn_id'));
    }

    public function tolakPeminjaman(Request $request, EquipmentLoan $peminjaman): EquipmentLoanResource
    {
        abort_unless($request->user()->can('booking-alat.ubah'), 403);

        $data = $request->validate(['alasan' => ['required', 'string', 'max:1000']]);

        $hasil = $this->persetujuan->tolak($peminjaman, $request->user(), $data['alasan']);

        return EquipmentLoanResource::make($hasil->load('asset:id,nama,kode_internal,bmn_id'));
    }
}
