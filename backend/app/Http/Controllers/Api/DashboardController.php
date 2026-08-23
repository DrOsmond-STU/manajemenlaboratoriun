<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SimpanDashboardRequest;
use App\Http\Resources\DashboardResource;
use App\Models\Dashboard;
use App\Models\DashboardWidget;
use App\Services\DataWidget;
use App\Services\SusunanDashboard;
use App\Support\RegistriWidget;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class DashboardController extends Controller
{
    public function __construct(private readonly SusunanDashboard $susunan) {}

    /**
     * Angka SATU widget lepas dari tata letak dashboard mana pun.
     *
     * Dipakai layar Laporan yang butuh angka yang SAMA PERSIS dengan yang
     * dashboard tampilkan (utilisasi ruangan, sebaran status booking, dan
     * seterusnya) tanpa memaksa layar itu ikut memasang widget di dashboard
     * pengguna. `DashboardWidget`-nya sengaja TIDAK disimpan — sekadar
     * bungkus in-memory supaya bisa memanggil DataWidget::untuk() apa
     * adanya, tanpa menduplikasi perhitungannya di tempat lain.
     *
     * Otorisasi per widget SUDAH ditegakkan di dalam DataWidget::untuk()
     * sendiri (Gate per `izin` yang terdaftar di RegistriWidget) — kunci
     * yang izinnya tidak dipunyai pemanggil kembali sebagai penanda
     * "tidak berwenang", bukan angka. Middleware rute hanya menuntut
     * `dashboard.lihat` sebagai syarat masuk paling luar, sama seperti
     * widgetTersedia().
     */
    public function widgetData(Request $request, DataWidget $dataWidget): JsonResponse
    {
        $kunci = $request->string('kunci')->toString();

        abort_unless(RegistriWidget::ada($kunci), 404, 'Widget tidak dikenal.');

        $widget = new DashboardWidget([
            'widget' => $kunci,
            'opsi' => array_filter([
                'hari' => $request->integer('hari') ?: null,
                'batas' => $request->integer('batas') ?: null,
            ], fn ($v) => $v !== null),
        ]);

        return response()->json(['data' => $dataWidget->untuk($widget, $request->user())]);
    }

    /** Daftar dashboard: milik sendiri ditambah yang bersama. */
    public function index(Request $request): AnonymousResourceCollection
    {
        return DashboardResource::collection(
            Dashboard::query()->terlihatOleh($request->user())
                ->with('widgets')->orderByDesc('utama')->orderBy('nama')->get()
        );
    }

    /**
     * Widget yang boleh dipasang pengguna ini.
     *
     * Disaring per izin, bukan dikirim seluruhnya lalu disembunyikan
     * antarmuka. Menyembunyikan di sisi peramban hanya menyembunyikan
     * tombolnya; daftarnya sendiri sudah memberi tahu modul apa saja yang ada
     * dan siapa yang mengurusnya.
     */
    public function widgetTersedia(Request $request): JsonResponse
    {
        $pengguna = $request->user();
        $tersedia = [];

        foreach (RegistriWidget::WIDGET as $kunci => $ket) {
            // Izin null berarti widgetnya tidak dijaga izin modul manapun
            // (mis. catatan bebas) — tersedia bagi siapa pun yang login,
            // bukan dilewatkan ke Gate yang menuntut nama ability.
            if ($ket['izin'] === null || Gate::forUser($pengguna)->allows($ket['izin'])) {
                $tersedia[] = ['kunci' => $kunci] + $ket;
            }
        }

        return response()->json(['data' => $tersedia]);
    }

    /** Dashboard beserta angkanya. */
    public function show(Request $request, Dashboard $dashboard): DashboardResource
    {
        $this->pastikanTerlihat($request, $dashboard);

        return new DashboardResource($dashboard->load('widgets'), denganData: true);
    }

    /**
     * Dashboard utama pengguna; dibuatkan bawaan bila belum punya.
     *
     * Pengguna baru harus melihat sesuatu yang berguna pada login pertama,
     * bukan halaman kosong dengan ajakan menyusun sendiri. Bawaannya disusun
     * dari widget yang boleh dilihatnya — sehingga teknisi lab dan petugas
     * keuangan mendapat dashboard awal yang berbeda tanpa ada yang mengatur
     * apa pun.
     */
    public function utama(Request $request): DashboardResource
    {
        return new DashboardResource(
            $this->susunan->utamaUntuk($request->user())->load('widgets'),
            denganData: true,
        );
    }

    public function store(SimpanDashboardRequest $request): JsonResponse
    {
        $dashboard = $this->susunan->simpan(
            new Dashboard(['user_id' => $request->user()->id]),
            $request->validated(),
        );

        return (new DashboardResource($dashboard->load('widgets')))
            ->response()->setStatusCode(201);
    }

    public function update(SimpanDashboardRequest $request, Dashboard $dashboard): DashboardResource
    {
        $this->pastikanMilikSendiri($request, $dashboard);

        return new DashboardResource(
            $this->susunan->simpan($dashboard, $request->validated())->load('widgets')
        );
    }

    public function destroy(Request $request, Dashboard $dashboard): JsonResponse
    {
        $this->pastikanMilikSendiri($request, $dashboard);

        $dashboard->delete();

        return response()->json(['pesan' => 'Dashboard dihapus.']);
    }

    private function pastikanTerlihat(Request $request, Dashboard $dashboard): void
    {
        abort_unless(
            $dashboard->bersama() || $dashboard->user_id === $request->user()->id,
            403,
            'Dashboard ini bukan milik Anda.',
        );
    }

    /**
     * Dashboard bersama tidak dapat disunting lewat jalur ini, bahkan oleh
     * Super Admin — templat organisasi diubah lewat seeder yang tertinjau,
     * bukan lewat penyuntingan sambil lalu yang berdampak ke semua orang.
     */
    private function pastikanMilikSendiri(Request $request, Dashboard $dashboard): void
    {
        abort_unless(
            $dashboard->user_id === $request->user()->id,
            403,
            $dashboard->bersama()
                ? 'Dashboard bersama tidak dapat disunting dari sini.'
                : 'Dashboard ini bukan milik Anda.',
        );
    }
}
