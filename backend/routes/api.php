<?php

use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\BmnKodeBarangController;
use App\Http\Controllers\Api\BookingController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());

    Route::apiResource('bookings', BookingController::class)->only(['index', 'store', 'show']);

    Route::apiResource('assets', AssetController::class)
        ->only(['index', 'store', 'show', 'update', 'destroy']);

    // Perpindahan ruangan dan riwayatnya berdiri sendiri, bukan bagian dari
    // penyuntingan biasa — keduanya tindakan penatausahaan tersendiri.
    Route::patch('assets/{asset}/mutasi', [AssetController::class, 'mutasi'])->name('assets.mutasi');
    Route::get('assets/{asset}/riwayat', [AssetController::class, 'riwayat'])->name('assets.riwayat');

    // Master kode barang: hanya baca, dipakai pemilih kode pada pendaftaran aset.
    Route::get('bmn/kode-barang', [BmnKodeBarangController::class, 'index'])->name('bmn.kode-barang.index');
});
