<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRoomRequest;
use App\Http\Requests\UpdateRoomRequest;
use App\Http\Resources\RoomResource;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class RoomController extends Controller
{
    // Otorisasi dipanggil eksplisit per aksi, bukan lewat authorizeResource():
    // metode itu bersandar pada $this->middleware(), yang sudah tidak ada pada
    // controller Laravel 11+. Eksplisit juga membuat aturannya terbaca langsung
    // di tempat aksinya, tanpa perlu menghafal pemetaan aksi → kemampuan.

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Room::class);

        $query = Room::query()->dalamCakupan($request->user())
            ->with('penanggungJawab:id,name')
            ->withCount('bookingsAktif')->orderBy('kode');

        if ($request->filled('cari')) {
            $kata = $request->string('cari')->toString();
            $query->where(fn ($q) => $q
                ->where('nama', 'ilike', "%{$kata}%")
                ->orWhere('kode', 'ilike', "%{$kata}%")
                ->orWhere('gedung', 'ilike', "%{$kata}%"));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('gedung')) {
            $query->where('gedung', $request->string('gedung')->toString());
        }

        if ($request->filled('jenis')) {
            $query->where('jenis', $request->string('jenis')->toString());
        }

        // Kapasitas minimum — pertanyaan pertama siapa pun yang mencari ruangan.
        if ($request->filled('kapasitas_min')) {
            $query->where('kapasitas', '>=', $request->integer('kapasitas_min'));
        }

        return RoomResource::collection($query->paginate(50));
    }

    public function store(StoreRoomRequest $request): JsonResponse
    {
        $this->authorize('create', Room::class);

        $ruangan = Room::create($request->validated());

        // refresh() bukan pemborosan: sebagian kolom punya nilai bawaan di
        // basis data (`status`, `skema_tarif`), dan objek hasil create() tidak
        // mengetahuinya. Tanpa ini jawabannya memantulkan keadaan di memori —
        // dengan kolom-kolom itu bernilai null — bukan baris yang benar-benar
        // tersimpan, dan antarmuka menampilkan ruangan tanpa status sampai
        // halamannya dimuat ulang.
        $ruangan->refresh();

        return RoomResource::make($ruangan->load('penanggungJawab:id,name'))
            ->response()->setStatusCode(201);
    }

    public function show(Room $room): RoomResource
    {
        $this->authorize('view', $room);

        return RoomResource::make(
            $room->load('penanggungJawab:id,name')->loadCount('bookingsAktif')
        );
    }

    public function update(UpdateRoomRequest $request, Room $room): RoomResource
    {
        $this->authorize('update', $room);

        $room->update($request->validated());

        return RoomResource::make(
            $room->load('penanggungJawab:id,name')->loadCount('bookingsAktif')
        );
    }

    /**
     * Hapus ruangan (hapus lunak).
     *
     * Penjaga di bawah tidak dapat digantikan oleh batasan basis data. Kunci
     * asing `restrict` pada tabel bookings hanya menolak penghapusan PERMANEN;
     * hapus lunak sekadar mengisi `deleted_at`, sehingga basis data tidak
     * melihat pelanggaran apa pun — dan jadwal yang sudah terlanjur dibuat
     * kehilangan ruangannya tanpa satu pun peringatan.
     */
    public function destroy(Room $room): JsonResponse
    {
        $this->authorize('delete', $room);

        $terjadwal = $room->bookingsAktif()->count();

        if ($terjadwal > 0) {
            throw ValidationException::withMessages([
                'room' => "Ruangan masih memiliki {$terjadwal} pemesanan terjadwal. "
                    .'Batalkan atau pindahkan pemesanannya lebih dulu, atau ubah status '
                    .'ruangan menjadi tidak_aktif bila hanya ingin menghentikan pemesanan baru.',
            ]);
        }

        $room->delete();

        return response()->json(['pesan' => 'Ruangan dihapus.']);
    }
}
