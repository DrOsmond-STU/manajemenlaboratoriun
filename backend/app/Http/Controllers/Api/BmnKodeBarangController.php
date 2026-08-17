<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BmnKodeBarang;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Penelusuran master kode barang, untuk pemilih kode saat mendaftarkan aset.
 * Hanya baca — master diisi lewat impor referensi resmi, bukan lewat API ini.
 */
class BmnKodeBarangController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = BmnKodeBarang::query()->orderBy('kode');

        if ($request->filled('cari')) {
            $query->cari($request->string('cari')->toString());
        }

        if ($request->filled('awalan')) {
            $query->diBawah($request->string('awalan')->toString());
        }

        return JsonResource::collection($query->paginate(50));
    }
}
