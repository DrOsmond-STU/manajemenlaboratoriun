<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Jejak audit: hanya dibaca.
 *
 * Tidak ada store, update, maupun destroy — dan itu bukan kelalaian. Basis
 * data pun menolak UPDATE dan DELETE lewat pemicu, sehingga menambahkan
 * endpoint-nya hanya akan menghasilkan galat 500 yang membingungkan.
 */
class AuditController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = AuditLog::query()->with('user:id,name')->latest('id');

        if ($request->filled('model')) {
            $query->where('model', $request->string('model')->toString());
        }

        // Menelusuri riwayat satu objek: apa saja yang pernah terjadi pada
        // aset #17, siapa pelakunya, dan apa nilai sebelum-sesudahnya.
        if ($request->filled('model') && $request->filled('model_id')) {
            $query->where('model_id', $request->integer('model_id'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('peristiwa')) {
            $query->where('peristiwa', $request->string('peristiwa')->toString());
        }

        if ($request->filled('sejak')) {
            $query->where('created_at', '>=', $request->date('sejak'));
        }

        if ($request->filled('sampai')) {
            // Akhir hari, bukan tengah malam: pemeriksa yang mengisi
            // `sampai=2026-08-21` bermaksud memasukkan tanggal itu, bukan
            // memotongnya pada detik pertama.
            $query->where('created_at', '<=', $request->date('sampai')->endOfDay());
        }

        return AuditLogResource::collection($query->paginate(50)->withQueryString());
    }
}
