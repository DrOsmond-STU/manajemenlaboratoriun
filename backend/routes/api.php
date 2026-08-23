<?php

use App\Http\Controllers\Api\AssetAuditController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BmnKodeBarangController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BscController;
use App\Http\Controllers\Api\ChecklistController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EquipmentLoanController;
use App\Http\Controllers\Api\FotoAsetController;
use App\Http\Controllers\Api\LaboratoryController;
use App\Http\Controllers\Api\MaintenanceController;
use App\Http\Controllers\Api\PenawaranController;
use App\Http\Controllers\Api\PenggunaAdminController;
use App\Http\Controllers\Api\PenggunaController;
use App\Http\Controllers\Api\PenyewaanController;
use App\Http\Controllers\Api\PeranController;
use App\Http\Controllers\Api\PersetujuanController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\TarifController;
use App\Http\Controllers\Api\VendorController;
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

    // --- Dashboard ---------------------------------------------------------
    // Yang boleh disusun pengguna adalah PENYAJIANNYA; cara angkanya dihitung
    // tetap kode yang ditinjau — lihat App\Support\RegistriWidget.
    Route::get('dashboard/utama', [DashboardController::class, 'utama'])
        ->middleware('can:dashboard.lihat')->name('dashboard.utama');
    Route::get('dashboard/widget-tersedia', [DashboardController::class, 'widgetTersedia'])
        ->middleware('can:dashboard.lihat')->name('dashboard.widget-tersedia');
    Route::get('dashboard/widget', [DashboardController::class, 'widgetData'])
        ->middleware('can:dashboard.lihat')->name('dashboard.widget-data');

    Route::get('dashboard', [DashboardController::class, 'index'])
        ->middleware('can:dashboard.lihat');
    Route::post('dashboard', [DashboardController::class, 'store'])
        ->middleware('can:dashboard.lihat');
    Route::get('dashboard/{dashboard}', [DashboardController::class, 'show'])
        ->middleware('can:dashboard.lihat');
    Route::put('dashboard/{dashboard}', [DashboardController::class, 'update'])
        ->middleware('can:dashboard.lihat');
    Route::delete('dashboard/{dashboard}', [DashboardController::class, 'destroy'])
        ->middleware('can:dashboard.lihat');

    // --- Balanced Scorecard -------------------------------------------------
    // Membaca menuntut dashboard.lihat; menyusun kerangkanya menuntut
    // dashboard.kelola, yang pada matriks hanya dipegang Super Admin dan
    // Facility Manager.
    //
    // PERLU DIPASTIKAN: peran Management — yang justru paling wajar memiliki
    // kartu skor — hanya berhak LIHAT menurut matriks di SECURITY.md §4.1.
    // Tidak diubah sepihak di sini; lihat docs/BACKEND.md §8.1.
    Route::get('bsc', [BscController::class, 'kartu'])
        ->middleware('can:dashboard.lihat')->name('bsc.kartu');
    Route::get('bsc/kerangka', [BscController::class, 'kerangka'])
        ->middleware('can:dashboard.lihat')->name('bsc.kerangka');
    Route::get('bsc/tren', [BscController::class, 'tren'])
        ->middleware('can:dashboard.lihat')->name('bsc.tren');

    Route::put('bsc/perspektif', [BscController::class, 'simpanPerspektif'])
        ->middleware('can:dashboard.kelola')->name('bsc.simpan-perspektif');
    Route::delete('bsc/periode', [BscController::class, 'hapusPeriode'])
        ->middleware('can:dashboard.kelola')->name('bsc.hapus-periode');

    // Mengisi angka bulanan adalah pekerjaan rutin, bukan keputusan
    // manajemen — izinnya UBAH, bukan KELOLA.
    Route::patch('bsc/indikator/{indikator}/realisasi', [BscController::class, 'isiRealisasi'])
        ->middleware('can:dashboard.ubah')->name('bsc.realisasi');

    // --- Booking ruangan -------------------------------------------------
    // Didaftarkan sebelum bookings/{booking}, kalau tidak "ketersediaan"
    // tertangkap sebagai id pemesanan.
    Route::get('bookings/ketersediaan', [BookingController::class, 'ketersediaan'])
        ->middleware('can:booking-ruangan.lihat')->name('bookings.ketersediaan');

    Route::get('bookings', [BookingController::class, 'index'])
        ->middleware('can:booking-ruangan.lihat');
    Route::post('bookings', [BookingController::class, 'store'])
        ->middleware('can:booking-ruangan.buat');
    Route::get('bookings/{booking}', [BookingController::class, 'show'])
        ->middleware('can:booking-ruangan.lihat');

    // --- Pemilih pengguna --------------------------------------------------
    // Untuk mengisi penanggung jawab, supervisor, dan teknisi pada formulir.
    // Izinnya master-data.lihat: yang memerlukannya adalah orang yang memang
    // sedang menyunting master data. Surel tidak pernah ikut dikirim — lihat
    // keterangan pada PenggunaController.
    Route::get('pengguna', [PenggunaController::class, 'index'])
        ->middleware('can:master-data.lihat')->name('pengguna.index');

    // --- Manajemen Pengguna & Peran ------------------------------------------
    // Beda dari 'pengguna' di atas (pemilih untuk formulir lain): CRUD penuh,
    // hanya untuk yang memegang izin pengguna.* — pada matriks saat ini
    // cuma super-admin. Lihat docblock MatriksAkses::MODUL untuk alasannya.
    Route::get('pengguna-kelola', [PenggunaAdminController::class, 'index'])
        ->middleware('can:pengguna.lihat');
    Route::post('pengguna-kelola', [PenggunaAdminController::class, 'store'])
        ->middleware('can:pengguna.buat');
    Route::put('pengguna-kelola/{pengguna}', [PenggunaAdminController::class, 'update'])
        ->middleware('can:pengguna.ubah');

    // --- Peran & hak akses — hanya baca --------------------------------------
    // Tidak ada store/update: matriksnya kode, bukan baris tabel. Lihat
    // docblock PeranController.
    Route::get('peran', [PeranController::class, 'index'])
        ->middleware('can:pengguna.lihat');

    // --- Master data: ruangan --------------------------------------------
    // Izinnya diatur RoomPolicy, bukan middleware `can:`, karena membaca
    // ruangan boleh dengan izin master-data ATAU booking-ruangan — pemesan
    // harus dapat melihat ruangan yang hendak dipesannya.
    Route::apiResource('rooms', RoomController::class);

    // --- Penyewaan & penagihan ----------------------------------------------
    // Seluruh modul ini milik peran Finance pada matriks akses; peran lain
    // paling jauh hanya melihat.
    Route::get('penyewaan', [PenyewaanController::class, 'daftarSewa'])
        ->middleware('can:penyewaan.lihat');
    Route::post('penyewaan', [PenyewaanController::class, 'buatSewa'])
        ->middleware('can:penyewaan.buat');
    Route::post('penyewaan/{sewa}/tagihan', [PenyewaanController::class, 'terbitkanTagihan'])
        ->middleware('can:penyewaan.ubah')->name('penyewaan.terbitkan-tagihan');

    Route::get('tagihan', [PenyewaanController::class, 'daftarTagihan'])
        ->middleware('can:penyewaan.lihat');
    Route::get('tagihan/{tagihan}', [PenyewaanController::class, 'lihatTagihan'])
        ->middleware('can:penyewaan.lihat');
    Route::post('tagihan/{tagihan}/pembayaran', [PenyewaanController::class, 'catatPembayaran'])
        ->middleware('can:penyewaan.ubah')->name('tagihan.pembayaran');
    Route::get('pembayaran', [PenyewaanController::class, 'daftarPembayaran'])
        ->middleware('can:penyewaan.lihat');
    Route::post('pembayaran/{pembayaran}/verifikasi', [PenyewaanController::class, 'verifikasiPembayaran'])
        ->middleware('can:penyewaan.ubah')->name('pembayaran.verifikasi');

    // --- Tarif: fasilitas, add-on, dan paket layanan — satu tabel tiga layar
    Route::get('tarif', [TarifController::class, 'index'])
        ->middleware('can:penyewaan.lihat');
    Route::post('tarif', [TarifController::class, 'store'])
        ->middleware('can:penyewaan.buat');
    Route::put('tarif/{tarif}', [TarifController::class, 'update'])
        ->middleware('can:penyewaan.ubah');

    // --- Penawaran (quotation) — tahap sebelum tagihan, boleh dinegosiasikan
    Route::get('penawaran', [PenawaranController::class, 'index'])
        ->middleware('can:penyewaan.lihat');
    Route::post('penawaran', [PenawaranController::class, 'store'])
        ->middleware('can:penyewaan.buat');
    Route::get('penawaran/{penawaran}', [PenawaranController::class, 'show'])
        ->middleware('can:penyewaan.lihat');
    Route::post('penawaran/{penawaran}/putuskan', [PenawaranController::class, 'putuskan'])
        ->middleware('can:penyewaan.ubah');
    Route::post('penawaran/{penawaran}/tagihan', [PenawaranController::class, 'terbitkanInvoice'])
        ->middleware('can:penyewaan.ubah')->name('penawaran.terbitkan-tagihan');

    // --- Persetujuan --------------------------------------------------------
    // Izin diperiksa di dalam controller karena bergantung pada jenis antrean
    // yang diminta: pemesanan ruangan atau peminjaman alat.
    Route::get('persetujuan/antrean', [PersetujuanController::class, 'antrean'])
        ->name('persetujuan.antrean');

    Route::post('persetujuan/booking/{booking}/setujui', [PersetujuanController::class, 'setujuiBooking']);
    Route::post('persetujuan/booking/{booking}/tolak', [PersetujuanController::class, 'tolakBooking']);
    Route::post('persetujuan/peminjaman/{peminjaman}/setujui', [PersetujuanController::class, 'setujuiPeminjaman']);
    Route::post('persetujuan/peminjaman/{peminjaman}/tolak', [PersetujuanController::class, 'tolakPeminjaman']);

    // --- Checklist ---------------------------------------------------------
    // Templat dibuat dan dikelola pengguna; penugasan melekatkannya pada
    // sumber daya sekaligus pada penanggung jawabnya.
    Route::get('checklist/templat', [ChecklistController::class, 'daftarTemplat'])
        ->middleware('can:checklist.lihat');
    Route::post('checklist/templat', [ChecklistController::class, 'buatTemplat'])
        ->middleware('can:checklist.buat');
    Route::get('checklist/templat/{templat}', [ChecklistController::class, 'lihatTemplat'])
        ->middleware('can:checklist.lihat');

    Route::post('checklist/penugasan', [ChecklistController::class, 'tugaskan'])
        ->middleware('can:checklist.ubah');

    // Tugas sendiri hanya menuntut izin LIHAT — pelaksana lapangan tidak
    // perlu izin mengelola untuk mengetahui apa yang harus dikerjakannya.
    Route::get('checklist/tugas-saya', [ChecklistController::class, 'tugasSaya'])
        ->middleware('can:checklist.lihat')->name('checklist.tugas-saya');

    Route::get('checklist/pelaksanaan', [ChecklistController::class, 'daftarPelaksanaan'])
        ->middleware('can:checklist.lihat');
    Route::post('checklist/pelaksanaan', [ChecklistController::class, 'mulai'])
        ->middleware('can:checklist.buat');
    Route::get('checklist/pelaksanaan/{pelaksanaan}', [ChecklistController::class, 'lihatPelaksanaan'])
        ->middleware('can:checklist.lihat');
    Route::post('checklist/pelaksanaan/{pelaksanaan}/jawab', [ChecklistController::class, 'jawab'])
        ->middleware('can:checklist.buat');
    Route::post('checklist/pelaksanaan/{pelaksanaan}/selesaikan', [ChecklistController::class, 'selesaikan'])
        ->middleware('can:checklist.buat');

    // --- Pemeliharaan & kalibrasi -----------------------------------------
    // Izinnya diperiksa di dalam controller, bukan lewat middleware `can:`,
    // karena bergantung pada JENIS pekerjaan: kalibrasi menuntut izin
    // kalibrasi.*, pemeliharaan menuntut pemeliharaan.*.
    Route::get('pemeliharaan/kalibrasi-kedaluwarsa', [MaintenanceController::class, 'kalibrasiKedaluwarsa'])
        ->name('pemeliharaan.kalibrasi-kedaluwarsa');
    Route::get('pemeliharaan', [MaintenanceController::class, 'index']);
    Route::post('pemeliharaan', [MaintenanceController::class, 'store']);
    Route::get('pemeliharaan/{pemeliharaan}', [MaintenanceController::class, 'show']);
    Route::post('pemeliharaan/{pemeliharaan}/selesaikan', [MaintenanceController::class, 'selesaikan'])
        ->name('pemeliharaan.selesaikan');

    // --- Vendor & mitra -----------------------------------------------------
    // Referensi operasional (nama, kontak, kategori, kontrak) — tidak
    // sesensitif Manajemen Pengguna, tingkatnya meniru kolom master-data.
    // Lihat docblock MatriksAkses::MODUL untuk alasannya.
    Route::get('vendors', [VendorController::class, 'index'])
        ->middleware('can:vendor.lihat');
    Route::post('vendors', [VendorController::class, 'store'])
        ->middleware('can:vendor.buat');
    Route::get('vendors/{vendor}', [VendorController::class, 'show'])
        ->middleware('can:vendor.lihat');
    Route::put('vendors/{vendor}', [VendorController::class, 'update'])
        ->middleware('can:vendor.ubah');
    // Hapus di sini berarti nonaktifkan (lihat docblock VendorController::destroy),
    // sehingga izinnya UBAH, bukan HAPUS — sama seperti nonaktifkan pengguna.
    Route::delete('vendors/{vendor}', [VendorController::class, 'destroy'])
        ->middleware('can:vendor.ubah');

    // --- Peminjaman alat --------------------------------------------------
    // Sebelum peminjaman/{peminjaman}, kalau tidak "ketersediaan" tertangkap
    // sebagai id peminjaman.
    Route::get('peminjaman/ketersediaan', [EquipmentLoanController::class, 'ketersediaan'])
        ->middleware('can:booking-alat.lihat')->name('peminjaman.ketersediaan');

    Route::get('peminjaman', [EquipmentLoanController::class, 'index'])
        ->middleware('can:booking-alat.lihat');
    Route::post('peminjaman', [EquipmentLoanController::class, 'store'])
        ->middleware('can:booking-alat.buat');
    Route::get('peminjaman/{peminjaman}', [EquipmentLoanController::class, 'show'])
        ->middleware('can:booking-alat.lihat');

    // Serah terima dan pengembalian adalah tindakan pengelolaan, bukan
    // pengajuan — karena itu menuntut izin UBAH, bukan BUAT. Peminjam boleh
    // mengajukan, tetapi bukan menyerahkan alat kepada dirinya sendiri.
    Route::post('peminjaman/{peminjaman}/serahkan', [EquipmentLoanController::class, 'serahkan'])
        ->middleware('can:booking-alat.ubah')->name('peminjaman.serahkan');
    Route::post('peminjaman/{peminjaman}/kembalikan', [EquipmentLoanController::class, 'kembalikan'])
        ->middleware('can:booking-alat.ubah')->name('peminjaman.kembalikan');

    // --- Master data: laboratorium ---------------------------------------
    // Izinnya diatur LaboratoryPolicy, mengikuti kolom `laboratorium` pada
    // matriks akses.
    Route::apiResource('laboratories', LaboratoryController::class);

    // --- Aset & BMN ------------------------------------------------------
    // Ringkasan dan mutasi-lintas-aset didaftarkan SEBELUM assets/{asset},
    // kalau tidak keduanya akan tertangkap sebagai id aset dan menghasilkan
    // 404 (atau galat tipe, karena "ringkasan"/"mutasi" bukan angka).
    Route::get('assets/ringkasan', [AssetController::class, 'ringkasan'])
        ->middleware('can:aset.lihat')->name('assets.ringkasan');
    Route::get('assets/mutasi', [AssetController::class, 'mutasiSemua'])
        ->middleware('can:aset.lihat')->name('assets.mutasi-semua');

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

    // --- Jejak audit -------------------------------------------------------
    // Hanya baca. Tidak ada rute tulis karena tidak boleh ada: basis data
    // menolak UPDATE dan DELETE pada tabelnya lewat pemicu.
    Route::get('audit', [AuditController::class, 'index'])
        ->middleware('can:audit.lihat')->name('audit.index');

    // --- Foto aset ---------------------------------------------------------
    // Berkasnya dilayani lewat rute, BUKAN sebagai berkas statis di docroot:
    // foto aset memperlihatkan nomor seri, label BMN, dan tata letak ruangan
    // tempat alat mahal disimpan.
    Route::get('assets/{asset}/foto', [FotoAsetController::class, 'index'])
        ->middleware('can:aset.lihat')->name('assets.foto.index');
    Route::get('assets/{asset}/foto/{foto}', [FotoAsetController::class, 'tampilkan'])
        ->middleware('can:aset.lihat')->name('assets.foto.tampilkan');

    Route::post('assets/{asset}/foto', [FotoAsetController::class, 'store'])
        ->middleware('can:aset.ubah')->name('assets.foto.store');
    Route::post('assets/{asset}/foto/{foto}/utama', [FotoAsetController::class, 'jadikanUtama'])
        ->middleware('can:aset.ubah')->name('assets.foto.utama');
    Route::delete('assets/{asset}/foto/{foto}', [FotoAsetController::class, 'destroy'])
        ->middleware('can:aset.ubah')->name('assets.foto.destroy');

    // --- Audit Aset (stock opname) -------------------------------------------
    // Izinnya modul TERSENDIRI (`audit-aset`), bukan `aset` — lihat docblock
    // MatriksAkses::MODUL. Jangan tertukar dengan `audit` (Jejak Audit di
    // atas): itu jejak perubahan data yang dicatat OTOMATIS oleh sistem;
    // ini sesi stock opname yang DIJALANKAN MANUAL oleh staf di lapangan.
    Route::get('audit-aset', [AssetAuditController::class, 'index'])
        ->middleware('can:audit-aset.lihat');
    Route::post('audit-aset', [AssetAuditController::class, 'store'])
        ->middleware('can:audit-aset.buat');
    Route::get('audit-aset/{sesi}', [AssetAuditController::class, 'show'])
        ->middleware('can:audit-aset.lihat');
    Route::post('audit-aset/{sesi}/scan', [AssetAuditController::class, 'scan'])
        ->middleware('can:audit-aset.ubah')->name('audit-aset.scan');
    Route::post('audit-aset/{sesi}/tutup', [AssetAuditController::class, 'tutup'])
        ->middleware('can:audit-aset.ubah')->name('audit-aset.tutup');

    // --- Master kode barang ----------------------------------------------
    // Hanya baca; diperlukan pemilih kode saat mendaftarkan aset, sehingga
    // izinnya mengikuti izin membuat/melihat aset.
    Route::get('bmn/kode-barang', [BmnKodeBarangController::class, 'index'])
        ->middleware('can:aset.lihat')->name('bmn.kode-barang.index');
});
