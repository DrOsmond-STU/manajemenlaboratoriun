<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetMaintenance;
use App\Models\BmnKodeBarang;
use App\Models\Booking;
use App\Models\ChecklistAssignment;
use App\Models\ChecklistRun;
use App\Models\ChecklistTemplate;
use App\Models\Dashboard;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Rental;
use App\Models\Room;
use App\Support\RegistriWidget;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Perluasan katalog widget dashboard: dari 13 menjadi puluhan, supaya
 * cakupannya sedekat mungkin dengan Dashboard Operasional, Manajemen, dan
 * Analitik pada purwarupa yang sudah disetujui.
 *
 * Bukan satu uji per widget — itu akan mengulang pola yang sama puluhan
 * kali. Yang diuji di sini adalah tiap KELUARGA bentuk data baru (deret,
 * matriks, teks) sekali dengan benar, ditambah beberapa widget yang
 * logikanya paling berisiko salah (checklist jatuh tempo, panel peringatan
 * lintas modul, kartu BSC).
 */
class DashboardWidgetPerluasanTest extends TestCase
{
    use RefreshDatabase;

    private function pasang(string $pengguna, string $kunci, array $opsi = []): array
    {
        $u = $this->penggunaBerperan($pengguna);
        $d = Dashboard::create(['nama' => 'x', 'user_id' => $u->id, 'jenis' => 'operasional']);
        $d->widgets()->create([
            'widget' => $kunci, 'kolom' => 0, 'baris' => 0, 'lebar' => 4, 'tinggi' => 2, 'opsi' => $opsi ?: null,
        ]);

        return $this->actingAs($u)->getJson('/api/dashboard/'.$d->id)
            ->assertOk()->json('data.widgets.0.data');
    }

    // --- Deret (tren) ----------------------------------------------------------

    public function test_tren_utilisasi_ruangan_enam_titik_dan_menghormati_cakupan(): void
    {
        Room::factory()->count(2)->create(['gedung' => 'Gedung A']);

        $data = $this->pasang('facility-manager', 'ruangan.tren-utilisasi');

        $this->assertCount(6, $data['titik'], 'Enam bulan terakhir, seperti purwarupa.');
        $this->assertSame('%', $data['satuan']);
    }

    public function test_tren_utilisasi_ikut_naik_saat_ada_booking(): void
    {
        $room = Room::factory()->create();

        Booking::factory()->create([
            'room_id' => $room->id, 'status' => 'disetujui',
            'mulai' => now()->startOfMonth()->addHours(9),
            'selesai' => now()->startOfMonth()->addHours(11),
        ]);

        $data = $this->pasang('facility-manager', 'ruangan.utilisasi');

        $this->assertNotNull($data['nilai']);
        $this->assertGreaterThan(0, $data['nilai']);
    }

    public function test_tren_pendapatan_sewa_menjumlahkan_pembayaran_per_bulan(): void
    {
        $sewa = Rental::factory()->create();
        $invoice = Invoice::create([
            'rental_id' => $sewa->id, 'nomor' => 'INV/1', 'tanggal' => now(),
            'jatuh_tempo' => now()->addDays(7), 'ppn_persen' => 0, 'status' => 'terbit',
        ]);
        $invoice->lines()->create([
            'deskripsi' => 'Sewa ruangan', 'kuantitas' => 1, 'satuan' => 'hari', 'harga_satuan' => 1_500_000,
        ]);
        Payment::create([
            'invoice_id' => $invoice->id, 'tanggal' => now(), 'jumlah' => 1_500_000, 'metode' => 'transfer',
        ]);

        $data = $this->pasang('finance', 'penyewaan.tren-pendapatan');

        $this->assertCount(6, $data['titik']);
        $this->assertSame(1_500_000, $data['titik'][5]['nilai'], 'Titik terakhir adalah bulan berjalan.');
        $this->assertSame(0, $data['titik'][0]['nilai'], 'Bulan tanpa pembayaran tetap tampil sebagai nol.');
    }

    public function test_tren_biaya_pemeliharaan_menghormati_cakupan(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $asset = Asset::factory()->kodeBarang('3.08.01.03.001')->create();

        AssetMaintenance::factory()->create([
            'asset_id' => $asset->id, 'status' => 'selesai', 'dikerjakan_pada' => now(), 'biaya' => 250_000,
        ]);

        $data = $this->pasang('facility-manager', 'pemeliharaan.tren-biaya');

        $this->assertSame(250_000, $data['titik'][5]['nilai']);
    }

    // --- Matriks (heatmap) ------------------------------------------------------

    public function test_heatmap_okupansi_menandai_sel_tersibuk_seratus(): void
    {
        // Tiga ruangan berbeda dipesan Senin jam 09 (tiga peristiwa pada sel
        // yang sama), satu ruangan lain dipesan Rabu jam 14 — ruangan
        // berbeda karena satu ruangan tidak dapat dipesan dua kali sekaligus
        // pada jam yang sama (batasan anti-bentrok basis data).
        foreach (range(1, 3) as $i) {
            Booking::factory()->create([
                'room_id' => Room::factory()->create()->id, 'status' => 'disetujui',
                'mulai' => now()->startOfWeek()->addHours(9),
                'selesai' => now()->startOfWeek()->addHours(10),
            ]);
        }
        Booking::factory()->create([
            'room_id' => Room::factory()->create()->id, 'status' => 'disetujui',
            'mulai' => now()->startOfWeek()->addDays(2)->addHours(14),
            'selesai' => now()->startOfWeek()->addDays(2)->addHours(15),
        ]);

        $data = $this->pasang('facility-manager', 'ruangan.heatmap-okupansi');

        $this->assertCount(7, $data['baris']);
        $this->assertContains('09', $data['kolom']);

        $maks = max(array_map('max', $data['sel']));
        $this->assertSame(100, $maks, 'Sel tersibuk dinormalkan ke 100.');
    }

    // --- Teks (catatan bebas) ---------------------------------------------------

    public function test_catatan_bebas_tidak_menghitung_data_apa_pun(): void
    {
        $data = $this->pasang('facility-manager', 'catatan.bebas');

        $this->assertNull($data['nilai']);
        $this->assertArrayNotHasKey('pesan', $data, 'Bukan galat — memang tidak ada yang perlu dihitung.');
    }

    public function test_catatan_bebas_tidak_menuntut_izin_apa_pun(): void
    {
        // "employee" adalah peran paling minim; widget catatan tetap tampil
        // di daftar widget tersedia karena izinnya null, bukan dijaga modul.
        $kunci = collect(
            $this->actingAs($this->penggunaBerperan('employee'))
                ->getJson('/api/dashboard/widget-tersedia')->assertOk()->json('data')
        )->pluck('kunci');

        $this->assertTrue($kunci->contains('catatan.bebas'));
        $this->assertTrue($kunci->contains('sistem.peringatan'));
    }

    // --- Checklist jatuh tempo ---------------------------------------------------

    public function test_checklist_jatuh_tempo_hanya_yang_belum_selesai_periode_ini(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir(1)->create();
        $room = Room::factory()->create();

        $a = ChecklistAssignment::create([
            'checklist_template_id' => $templat->id, 'room_id' => $room->id,
            'user_id' => $this->penggunaBerperan('lab-technician')->id,
            'periode' => 'harian', 'aktif' => true,
        ]);

        $data = $this->pasang('facility-manager', 'checklist.jatuh-tempo');
        $this->assertSame(1, $data['nilai'], 'Belum ada pelaksanaan sama sekali — jatuh tempo.');

        ChecklistRun::create([
            'checklist_template_id' => $templat->id, 'room_id' => $room->id, 'user_id' => $a->user_id,
            'status' => 'selesai', 'dimulai_pada' => now(), 'selesai_pada' => now(),
            'butir_total' => 1, 'butir_lulus' => 1, 'skor' => 100,
        ]);

        $data = $this->pasang('facility-manager', 'checklist.jatuh-tempo');
        $this->assertSame(0, $data['nilai'], 'Sudah ada pelaksanaan selesai hari ini — tidak lagi jatuh tempo.');
    }

    public function test_checklist_insidental_tidak_pernah_jatuh_tempo(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir(1)->create();

        ChecklistAssignment::create([
            'checklist_template_id' => $templat->id, 'room_id' => Room::factory()->create()->id,
            'user_id' => $this->penggunaBerperan('lab-technician')->id,
            'periode' => 'insidental', 'aktif' => true,
        ]);

        $data = $this->pasang('facility-manager', 'checklist.jatuh-tempo');
        $this->assertSame(0, $data['nilai']);
    }

    // --- Panel peringatan lintas modul -------------------------------------------

    public function test_peringatan_hanya_menyebut_domain_yang_diizinkan_pemasangnya(): void
    {
        // "employee" tidak berwenang atas kalibrasi/pemeliharaan/checklist/
        // penyewaan sama sekali menurut matriks — panelnya harus kosong,
        // BUKAN menolak (izinnya sendiri null).
        $data = $this->pasang('employee', 'sistem.peringatan');

        $this->assertSame(0, $data['nilai']);
        $this->assertSame([], $data['baris']);
    }

    public function test_peringatan_menyebut_kalibrasi_kedaluwarsa_bagi_yang_berwenang(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        Asset::factory()->kodeBarang('3.08.01.03.001')->create(['wajib_kalibrasi' => true]);

        $data = $this->pasang('asset-manager', 'sistem.peringatan');

        $ids = array_column($data['baris'], 'id');
        $this->assertContains('kalibrasi', $ids);
    }

    // --- Balanced Scorecard sebagai widget ---------------------------------------

    public function test_bsc_skor_widget_mengikuti_kartu_periode_berjalan(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', [
            'periode' => (string) now()->year, 'perspektif' => 'keuangan',
            'objectives' => [[
                'nama' => 'Sasaran', 'indikator' => [[
                    'nama' => 'PNBP', 'polaritas' => 'naik-baik', 'target' => 100,
                    'realisasi' => 80, 'bobot' => 100,
                ]],
            ]],
        ])->assertOk();

        $data = $this->pasang('facility-manager', 'bsc.skor');
        $this->assertEqualsWithDelta(80, $data['nilai'], 0.001);
    }

    public function test_bsc_kartu_widget_membawa_seluruh_perspektif(): void
    {
        $data = $this->pasang('facility-manager', 'bsc.kartu');

        $this->assertCount(4, $data['perspektif']);
        $this->assertArrayHasKey('sasaran', $data['perspektif'][0]);
    }

    // --- Bawaan tidak membanjiri dashboard pertama -------------------------------

    public function test_dashboard_bawaan_tetap_terkurasi_walau_katalog_membesar(): void
    {
        // Super Admin punya hampir seluruh izin di matriks — sebelum
        // dikurasi, ini akan menghasilkan puluhan widget pada login pertama.
        $data = $this->actingAs($this->penggunaBerperan('super-admin'))
            ->getJson('/api/dashboard/utama')->assertOk()->json('data');

        $this->assertLessThanOrEqual(
            count(RegistriWidget::BAWAAN), count($data['widgets']),
            'Bawaan tidak boleh diam-diam membengkak melebihi daftar yang dikurasi.'
        );
        $this->assertGreaterThan(10, count($data['widgets']), 'Tetap berguna — bukan halaman kosong.');
    }
}
