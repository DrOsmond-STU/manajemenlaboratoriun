<?php

use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BmnKodeBarangController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\LaboratoryController;
use App\Http\Controllers\Api\RoomController;
use Illuminate\Support\Facades\Route;

// --- Tanpa autentikasi ---------------------------------------------------
// Pembatasan percobaan ditangani LoginRequest per kombinasi surel + IP.
// `throttle` di sini adalah lapis kedua terhadap banjir permintaan dari satu
// IP, termasuk yang memakai surel berganti-ganti untuk menghindari lapis
// pertama.
Route::post('masuk', [AuthController::class, 'masuk'])
    ->middleware(['guest', 'throttle:20,1'])
    ->name('masuk');

// --- Wajib autentikasi ---------------------------------------------------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('keluar', [AuthController::class, 'keluar'])->name('keluar');
    Route::get('saya', [AuthController::class, 'saya'])->name('saya');
    Route::post('ubah-sandi', [AuthController::class, 'ubahSandi'])->name('ubah-sandi');

    // Disimpan demi kecocokan dengan bawaan Sanctum.
    Route::get('user', [AuthController::class, 'saya']);

    // --- Booking ruangan -------------------------------------------------
    Route::get('bookings', [BookingController::class, 'index'])
        ->middleware('can:booking-ruangan.lihat');
    Route::post('bookings', [BookingController::class, 'store'])
        ->middleware('can:booking-ruangan.buat');
    Route::get('bookings/{booking}', [BookingController::class, 'show'])
        ->middleware('can:booking-ruangan.lihat');

    // --- Master data: ruangan --------------------------------------------
    // Izinnya diatur RoomPolicy, bukan middleware `can:`, karena membaca
    // ruangan boleh dengan izin master-data ATAU booking-ruangan — pemesan
    // harus dapat melihat ruangan yang hendak dipesannya.
    Route::apiResource('rooms', RoomController::class);

    // --- Master data: laboratorium ---------------------------------------
    // Izinnya diatur LaboratoryPolicy, mengikuti kolom `laboratorium` pada
    // matriks akses.
    Route::apiResource('laboratories', LaboratoryController::class);

    // --- Aset & BMN ------------------------------------------------------
    Route::get('assets', [AssetController::class, 'index'])
        ->middleware('can:aset.lihat');
    Route::post('assets', [AssetController::class, 'store'])
        ->middleware('can:aset.buat');
    Route::get('assets/{asset}', [AssetController::class, 'show'])
        ->middleware('can:aset.lihat');
    Route::patch('assets/{asset}', [AssetController::class, 'update'])
        ->middleware('can:aset.ubah');
    Route::delete('assets/{asset}', [AssetController::class, 'destroy'])
        ->middleware('can:aset.hapus');

    Route::patch('assets/{asset}/mutasi', [AssetController::class, 'mutasi'])
        ->middleware('can:aset.ubah')->name('assets.mutasi');
    Route::get('assets/{asset}/riwayat', [AssetController::class, 'riwayat'])
        ->middleware('can:aset.lihat')->name('assets.riwayat');

    // --- Master kode barang ----------------------------------------------
    // Hanya baca; diperlukan pemilih kode saat mendaftarkan aset, sehingga
    // izinnya mengikuti izin membuat/melihat aset.
    Route::get('bmn/kode-barang', [BmnKodeBarangController::class, 'index'])
        ->middleware('can:aset.lihat')->name('bmn.kode-barang.index');
});
