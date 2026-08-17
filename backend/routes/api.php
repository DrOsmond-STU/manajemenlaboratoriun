<?php

use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\BmnKodeBarangController;
use App\Http\Controllers\Api\BookingController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());

    Route::apiResource('bookings', BookingController::class)->only(['index', 'store', 'show']);

    Route::apiResource('assets', AssetController::class)->only(['index', 'store', 'show']);

    // Master kode barang: hanya baca, dipakai pemilih kode pada pendaftaran aset.
    Route::get('bmn/kode-barang', [BmnKodeBarangController::class, 'index'])->name('bmn.kode-barang.index');
});
