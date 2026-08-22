<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PenggunaAdminResource;
use App\Models\User;
use App\Support\MatriksAkses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * CRUD pengguna untuk admin — beda dari PenggunaController (daftar untuk
 * pemilihan pada formulir lain). Dijaga izin `pengguna.*`, yang pada
 * MatriksAkses saat ini hanya dimiliki super-admin — lihat docblock
 * MatriksAkses::MODUL untuk alasannya.
 */
class PenggunaAdminController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = User::query()->with(['roles', 'gedung'])->orderBy('name');

        if ($request->filled('cari')) {
            $kata = $request->string('cari')->toString();
            $query->where(fn ($q) => $q
                ->where('name', 'ilike', "%{$kata}%")
                ->orWhere('email', 'ilike', "%{$kata}%"));
        }

        if ($request->filled('peran')) {
            $query->role($request->string('peran')->toString());
        }

        if ($request->filled('aktif')) {
            $query->where('aktif', $request->boolean('aktif'));
        }

        return PenggunaAdminResource::collection($query->paginate(25));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'unit_kerja' => ['nullable', 'string', 'max:150'],
            'peran' => ['required', 'array', 'min:1'],
            'peran.*' => [Rule::in(array_keys(MatriksAkses::NAMA_PERAN))],
            'gedung' => ['nullable', 'array'],
            'gedung.*' => ['string', 'max:100'],
        ]);

        $pengguna = DB::transaction(function () use ($data) {
            $u = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'unit_kerja' => $data['unit_kerja'] ?? null,
                // Eksplisit, bukan mengandalkan bawaan basis data: create()
                // tidak menyegarkan atribut dari nilai DEFAULT setelah
                // INSERT, sehingga instance di memori akan tetap null
                // walau baris di basis data sudah benar true.
                'aktif' => true,
            ]);

            $u->syncRoles($data['peran']);

            foreach ($data['gedung'] ?? [] as $gedung) {
                $u->gedung()->create(['gedung' => $gedung]);
            }

            return $u;
        });

        return PenggunaAdminResource::make($pengguna->load(['roles', 'gedung']))
            ->response()->setStatusCode(201);
    }

    public function update(Request $request, User $pengguna): PenggunaAdminResource
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'email' => ['sometimes', 'email', 'max:150', Rule::unique('users', 'email')->ignore($pengguna->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'unit_kerja' => ['sometimes', 'nullable', 'string', 'max:150'],
            'aktif' => ['sometimes', 'boolean'],
            'peran' => ['sometimes', 'array'],
            'peran.*' => [Rule::in(array_keys(MatriksAkses::NAMA_PERAN))],
            'gedung' => ['sometimes', 'array'],
            'gedung.*' => ['string', 'max:100'],
        ]);

        $this->cegahKunciDiriSendiri($request, $pengguna, $data);

        DB::transaction(function () use ($data, $pengguna) {
            $isi = collect($data)->except(['password', 'peran', 'gedung'])->all();

            if (! empty($data['password'])) {
                $isi['password'] = Hash::make($data['password']);
            }

            if ($isi !== []) {
                $pengguna->update($isi);
            }

            if (array_key_exists('peran', $data)) {
                $pengguna->syncRoles($data['peran']);
            }

            if (array_key_exists('gedung', $data)) {
                $pengguna->gedung()->delete();
                foreach ($data['gedung'] as $gedung) {
                    $pengguna->gedung()->create(['gedung' => $gedung]);
                }
            }
        });

        return PenggunaAdminResource::make($pengguna->fresh(['roles', 'gedung']));
    }

    /**
     * Mencegah admin mengunci dirinya sendiri: menonaktifkan akun sendiri,
     * atau mencabut peran Super Admin dari akun sendiri. Keduanya tidak
     * menimbulkan galat teknis apa pun bila dibiarkan — hanya admin yang
     * tiba-tiba tidak dapat masuk lagi ke sistemnya sendiri, dan tidak ada
     * admin lain yang tersisa untuk memulihkannya.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws ValidationException
     */
    private function cegahKunciDiriSendiri(Request $request, User $pengguna, array $data): void
    {
        if (! $request->user()->is($pengguna)) {
            return;
        }

        if (array_key_exists('aktif', $data) && $data['aktif'] === false) {
            throw ValidationException::withMessages([
                'aktif' => 'Tidak dapat menonaktifkan akun sendiri.',
            ]);
        }

        if (array_key_exists('peran', $data) && $pengguna->hasRole('super-admin')
            && ! in_array('super-admin', $data['peran'], true)) {
            throw ValidationException::withMessages([
                'peran' => 'Tidak dapat mencabut peran Super Admin dari akun sendiri.',
            ]);
        }
    }
}
