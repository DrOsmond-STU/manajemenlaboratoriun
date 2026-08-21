<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\Dashboard;
use App\Models\DashboardWidget;
use App\Models\Room;
use App\Models\User;
use App\Models\UserGedung;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string,mixed>
     */
    private function susunan(array $widgets, array $ganti = []): array
    {
        return array_merge([
            'nama' => 'Dashboard Saya',
            'jenis' => 'operasional',
            'widgets' => $widgets,
        ], $ganti);
    }

    /**
     * @return array<string,mixed>
     */
    private function widget(string $kunci, array $ganti = []): array
    {
        return array_merge([
            'widget' => $kunci,
            'kolom' => 0, 'baris' => 0, 'lebar' => 3, 'tinggi' => 2,
        ], $ganti);
    }

    // --- Batas keamanan ------------------------------------------------------

    public function test_widget_di_luar_daftar_putih_ditolak(): void
    {
        // Percobaan paling langsung menyalahgunakan "widget dapat dikelola
        // sendiri": menjadikan sumber datanya kueri.
        $this->actingAs($this->penggunaBerperan('super-admin'))
            ->postJson('/api/dashboard', $this->susunan([
                $this->widget('users; drop table assets'),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('widgets.0.widget');

        $this->assertDatabaseCount('dashboards', 0);
    }

    public function test_widget_tanpa_izin_tidak_mengembalikan_angka(): void
    {
        $teknisi = $this->penggunaBerperan('lab-technician');

        // Widget dipasang lewat basis data langsung: yang diuji bukan apakah
        // pemasangannya dicegah, melainkan apakah ANGKANYA tetap tertahan
        // seandainya widget itu sudah telanjur ada — persis keadaan orang
        // yang perannya dicabut setelah menyusun dashboard-nya.
        $dashboard = Dashboard::create([
            'nama' => 'Coba', 'user_id' => $teknisi->id, 'jenis' => 'operasional',
        ]);
        $dashboard->widgets()->create($this->widget('tagihan.piutang'));

        $data = $this->actingAs($teknisi)
            ->getJson('/api/dashboard/'.$dashboard->id)
            ->assertOk()
            ->json('data.widgets.0.data');

        $this->assertNull($data['nilai'], 'Angka piutang tidak boleh keluar tanpa izin penyewaan.');
        $this->assertSame('Tidak berwenang melihat data ini.', $data['pesan']);
    }

    public function test_angka_widget_menghormati_cakupan_data(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();

        $gedungA = Room::factory()->create(['gedung' => 'Gedung A']);
        $gedungB = Room::factory()->create(['gedung' => 'Gedung B']);

        Asset::factory()->kodeBarang('3.08.01.03.001')->count(3)->create(['room_id' => $gedungA->id]);
        Asset::factory()->kodeBarang('3.08.01.03.001')->count(5)->create(['room_id' => $gedungB->id]);

        $pengelola = $this->penggunaBerperan('asset-manager');
        $penjaga = $this->penggunaBerperan('lab-technician');
        UserGedung::create(['user_id' => $penjaga->id, 'gedung' => 'Gedung A']);

        $hitung = function (User $u): int {
            $d = Dashboard::create(['nama' => 'x', 'user_id' => $u->id, 'jenis' => 'operasional']);
            $d->widgets()->create($this->widget('aset.jumlah'));

            return $this->actingAs($u)->getJson('/api/dashboard/'.$d->id)
                ->assertOk()->json('data.widgets.0.data.nilai');
        };

        // Ringkasan membocorkan keberadaan data sama seperti daftar rincinya:
        // "8 aset" bagi penjaga Gedung A sudah memberi tahu ada sesuatu di
        // gedung yang tidak boleh dilihatnya.
        $this->assertSame(8, $hitung($pengelola), 'Peran lintas gedung melihat semuanya.');
        $this->assertSame(3, $hitung($penjaga), 'Penjaga Gedung A hanya melihat gedungnya.');
    }

    public function test_dashboard_orang_lain_tidak_dapat_dilihat(): void
    {
        $lain = $this->penggunaBerperan('facility-manager');
        $dashboard = Dashboard::create([
            'nama' => 'Punya orang lain', 'user_id' => $lain->id, 'jenis' => 'operasional',
        ]);

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson('/api/dashboard/'.$dashboard->id)
            ->assertForbidden();
    }

    public function test_dashboard_bersama_terlihat_tetapi_tidak_dapat_disunting(): void
    {
        $bersama = Dashboard::create(['nama' => 'Templat Organisasi', 'user_id' => null, 'jenis' => 'operasional']);
        $pengguna = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengguna)->getJson('/api/dashboard/'.$bersama->id)
            ->assertOk()
            ->assertJsonPath('data.bersama', true)
            ->assertJsonPath('data.dapat_disunting', false);

        $this->actingAs($pengguna)
            ->putJson('/api/dashboard/'.$bersama->id, $this->susunan([$this->widget('aset.jumlah')]))
            ->assertForbidden();
    }

    public function test_super_admin_pun_tidak_menyunting_dashboard_bersama_dari_sini(): void
    {
        $bersama = Dashboard::create(['nama' => 'Templat', 'user_id' => null, 'jenis' => 'operasional']);

        // Templat yang berdampak ke semua orang diubah lewat seeder yang
        // tertinjau, bukan penyuntingan sambil lalu.
        $this->actingAs($this->penggunaBerperan('super-admin'))
            ->putJson('/api/dashboard/'.$bersama->id, $this->susunan([$this->widget('aset.jumlah')]))
            ->assertForbidden();
    }

    public function test_daftar_widget_tersedia_disaring_per_izin(): void
    {
        $kunci = fn (string $peran) => collect(
            $this->actingAs($this->penggunaBerperan($peran))
                ->getJson('/api/dashboard/widget-tersedia')->assertOk()->json('data')
        )->pluck('kunci');

        $this->assertTrue($kunci('finance')->contains('tagihan.piutang'));
        $this->assertFalse(
            $kunci('lab-technician')->contains('tagihan.piutang'),
            'Daftarnya sendiri sudah memberi tahu modul apa yang ada dan siapa yang mengurusnya.'
        );
    }

    // --- Geometri kisi -------------------------------------------------------

    public function test_widget_yang_menjorok_keluar_kisi_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('super-admin'))
            ->postJson('/api/dashboard', $this->susunan([
                $this->widget('aset.jumlah', ['kolom' => 8, 'lebar' => 6]),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('widgets.0.lebar');
    }

    public function test_lebar_nol_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('super-admin'))
            ->postJson('/api/dashboard', $this->susunan([
                $this->widget('aset.jumlah', ['lebar' => 0]),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('widgets.0.lebar');
    }

    public function test_basis_data_menolak_geometri_rusak_walau_lapis_aplikasi_dilewati(): void
    {
        $d = Dashboard::create(['nama' => 'x', 'user_id' => null, 'jenis' => 'operasional']);

        // Seret-lepas di peramban mengirim angka apa pun. Validasi permintaan
        // memberi pesan yang terbaca; batasan CHECK-lah yang berlaku juga bagi
        // jalur yang tidak lewat sana sama sekali.
        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/dashboard_widgets_geometri_sah/');

        DB::table('dashboard_widgets')->insert([
            'dashboard_id' => $d->id, 'widget' => 'aset.jumlah',
            'kolom' => 10, 'baris' => 0, 'lebar' => 9, 'tinggi' => 2,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    // --- Penyuntingan & susun ulang ------------------------------------------

    public function test_susunan_dapat_disimpan_dan_disusun_ulang(): void
    {
        $pengguna = $this->penggunaBerperan('facility-manager');

        $id = $this->actingAs($pengguna)
            ->postJson('/api/dashboard', $this->susunan([
                $this->widget('aset.jumlah', ['kolom' => 0, 'lebar' => 3]),
                $this->widget('booking.menunggu', ['kolom' => 3, 'lebar' => 3]),
            ]))
            ->assertCreated()
            ->json('data.id');

        // Susun ulang: bertukar tempat, lebar berubah, judul diganti sendiri.
        $data = $this->actingAs($pengguna)
            ->putJson('/api/dashboard/'.$id, $this->susunan([
                $this->widget('booking.menunggu', ['kolom' => 0, 'lebar' => 6, 'tinggi' => 4]),
                $this->widget('aset.jumlah', ['kolom' => 6, 'lebar' => 6, 'judul' => 'Total Barang']),
            ], ['nama' => 'Pantauan Harian']))
            ->assertOk()
            ->json('data');

        $this->assertSame('Pantauan Harian', $data['nama']);
        $this->assertSame('booking.menunggu', $data['widgets'][0]['widget']);
        $this->assertSame(6, $data['widgets'][0]['kisi']['lebar']);
        $this->assertSame('Total Barang', $data['widgets'][1]['judul']);

        // Ditulis ulang, bukan ditumpuk.
        $this->assertSame(2, DashboardWidget::count());
    }

    public function test_judul_kosong_memakai_bawaan_registri(): void
    {
        $pengguna = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengguna)
            ->postJson('/api/dashboard', $this->susunan([$this->widget('aset.jumlah')]))
            ->assertCreated()
            ->assertJsonPath('data.widgets.0.judul', 'Jumlah aset')
            ->assertJsonPath('data.widgets.0.satuan', 'unit');
    }

    public function test_hanya_satu_dashboard_utama_per_pengguna(): void
    {
        $pengguna = $this->penggunaBerperan('facility-manager');

        foreach (['Pertama', 'Kedua'] as $nama) {
            $this->actingAs($pengguna)
                ->postJson('/api/dashboard', $this->susunan(
                    [$this->widget('aset.jumlah')],
                    ['nama' => $nama, 'utama' => true],
                ))
                ->assertCreated();
        }

        $utama = Dashboard::where('user_id', $pengguna->id)->where('utama', true)->get();

        $this->assertCount(1, $utama, 'Menandai dashboard kedua harus menurunkan yang pertama, bukan gagal.');
        $this->assertSame('Kedua', $utama->first()->nama);
    }

    public function test_opsi_di_luar_yang_dikenal_dibuang(): void
    {
        $pengguna = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengguna)
            ->postJson('/api/dashboard', $this->susunan([
                $this->widget('aset.jumlah', ['opsi' => ['hari' => 30, 'skrip' => '<script>x</script>']]),
            ]))
            ->assertCreated()
            ->assertJsonPath('data.widgets.0.opsi', ['hari' => 30]);
    }

    // --- Bawaan --------------------------------------------------------------

    public function test_pengguna_baru_mendapat_dashboard_bawaan_sesuai_perannya(): void
    {
        $data = $this->actingAs($this->penggunaBerperan('finance'))
            ->getJson('/api/dashboard/utama')
            ->assertOk()
            ->json('data');

        $kunci = collect($data['widgets'])->pluck('widget');

        $this->assertTrue($data['utama']);
        $this->assertNotEmpty($kunci, 'Login pertama tidak boleh menampilkan halaman kosong.');
        $this->assertTrue($kunci->contains('tagihan.piutang'));

        // Tidak boleh ada satu pun kotak "tidak berwenang" pada tampilan
        // pertama — itu membuat aplikasi terasa rusak sejak menit pertama.
        foreach ($data['widgets'] as $w) {
            $this->assertArrayNotHasKey('pesan', $w['data'], "Widget {$w['widget']} tidak berizin.");
        }
    }

    public function test_dashboard_bawaan_tidak_dibuat_dua_kali(): void
    {
        $pengguna = $this->penggunaBerperan('facility-manager');

        $a = $this->actingAs($pengguna)->getJson('/api/dashboard/utama')->assertOk()->json('data.id');
        $b = $this->actingAs($pengguna)->getJson('/api/dashboard/utama')->assertOk()->json('data.id');

        $this->assertSame($a, $b);
        $this->assertSame(1, Dashboard::where('user_id', $pengguna->id)->count());
    }

    public function test_widget_daftar_menyebut_total_sebenarnya_bukan_jumlah_baris_tampil(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $pengguna = $this->penggunaBerperan('asset-manager');

        // Dua belas alat wajib kalibrasi, tak satu pun pernah dikalibrasi.
        Asset::factory()->kodeBarang('3.08.01.03.001')->count(12)
            ->create(['wajib_kalibrasi' => true]);

        $d = Dashboard::create(['nama' => 'x', 'user_id' => $pengguna->id, 'jenis' => 'operasional']);
        $d->widgets()->create($this->widget('kalibrasi.kedaluwarsa', ['lebar' => 6]));

        $data = $this->actingAs($pengguna)->getJson('/api/dashboard/'.$d->id)
            ->assertOk()->json('data.widgets.0.data');

        // Menampilkan "8" saat yang kedaluwarsa 12 akan menenangkan orang
        // secara keliru.
        $this->assertSame(12, $data['nilai']);
        $this->assertCount(8, $data['baris']);
        $this->assertTrue($data['terpotong']);
    }

    public function test_alat_belum_pernah_dikalibrasi_ikut_terhitung(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $pengguna = $this->penggunaBerperan('asset-manager');

        Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'Neraca Analitik', 'wajib_kalibrasi' => true,
        ]);
        // Alat yang tidak wajib kalibrasi tidak boleh ikut terhitung.
        Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'Meja Kerja', 'wajib_kalibrasi' => false,
        ]);

        $d = Dashboard::create(['nama' => 'x', 'user_id' => $pengguna->id, 'jenis' => 'operasional']);
        $d->widgets()->create($this->widget('kalibrasi.kedaluwarsa', ['lebar' => 6]));

        $data = $this->actingAs($pengguna)->getJson('/api/dashboard/'.$d->id)
            ->assertOk()->json('data.widgets.0.data');

        $this->assertSame(1, $data['nilai']);
        $this->assertSame('Neraca Analitik', $data['baris'][0]['judul']);
        $this->assertSame('belum pernah dikalibrasi', $data['baris'][0]['keterangan']);
    }

    public function test_sebaran_kondisi_menyertakan_kondisi_bernilai_nol(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $pengguna = $this->penggunaBerperan('asset-manager');

        Asset::factory()->kodeBarang('3.08.01.03.001')->count(2)->create(['kondisi' => 'B']);

        $d = Dashboard::create(['nama' => 'x', 'user_id' => $pengguna->id, 'jenis' => 'operasional']);
        $d->widgets()->create($this->widget('aset.kondisi', ['lebar' => 4]));

        $bagian = $this->actingAs($pengguna)->getJson('/api/dashboard/'.$d->id)
            ->assertOk()->json('data.widgets.0.data.bagian');

        // Menghilangkan kondisi bernilai nol membuat grafik berubah bentuk
        // dari waktu ke waktu dan menyembunyikan kabar baiknya.
        $this->assertCount(3, $bagian);
        $this->assertSame(['B', 'RR', 'RB'], array_column($bagian, 'kode'));
        $this->assertSame([2, 0, 0], array_column($bagian, 'jumlah'));
    }

    public function test_opsi_batas_mengubah_jumlah_baris_yang_ditampilkan(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $pengguna = $this->penggunaBerperan('asset-manager');

        Asset::factory()->kodeBarang('3.08.01.03.001')->count(12)
            ->create(['wajib_kalibrasi' => true]);

        $d = Dashboard::create(['nama' => 'x', 'user_id' => $pengguna->id, 'jenis' => 'operasional']);
        $d->widgets()->create($this->widget('kalibrasi.kedaluwarsa', [
            'lebar' => 6, 'opsi' => ['batas' => 3],
        ]));

        $data = $this->actingAs($pengguna)->getJson('/api/dashboard/'.$d->id)
            ->assertOk()->json('data.widgets.0.data');

        $this->assertCount(3, $data['baris'], 'Opsi yang disimpan harus benar-benar berpengaruh.');
        $this->assertSame(12, $data['nilai'], 'Totalnya tetap yang sebenarnya.');
    }

    public function test_opsi_batas_di_luar_rentang_kembali_ke_bawaan(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $pengguna = $this->penggunaBerperan('asset-manager');

        Asset::factory()->kodeBarang('3.08.01.03.001')->count(12)
            ->create(['wajib_kalibrasi' => true]);

        $d = Dashboard::create(['nama' => 'x', 'user_id' => $pengguna->id, 'jenis' => 'operasional']);

        // Ditulis langsung ke basis data: tata letak lama dapat memuat nilai
        // yang dulu sah. Dashboard-nya harus tetap terbuka, bukan menolak.
        $d->widgets()->create($this->widget('kalibrasi.kedaluwarsa', [
            'lebar' => 6, 'opsi' => ['batas' => 100000],
        ]));

        $data = $this->actingAs($pengguna)->getJson('/api/dashboard/'.$d->id)
            ->assertOk()->json('data.widgets.0.data');

        $this->assertCount(8, $data['baris']);
    }

    public function test_satu_widget_rusak_tidak_menjatuhkan_seluruh_halaman(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $pengguna = $this->penggunaBerperan('asset-manager');
        Asset::factory()->kodeBarang('3.08.01.03.001')->count(2)->create();

        $d = Dashboard::create(['nama' => 'x', 'user_id' => $pengguna->id, 'jenis' => 'operasional']);
        $d->widgets()->create($this->widget('aset.jumlah'));

        // Kunci tak dikenal hanya mungkin masuk lewat basis data langsung —
        // misalnya tata letak lama setelah sebuah widget dipensiunkan.
        DB::table('dashboard_widgets')->insert([
            'dashboard_id' => $d->id, 'widget' => 'widget.sudah.dipensiunkan',
            'kolom' => 3, 'baris' => 0, 'lebar' => 3, 'tinggi' => 2,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $widgets = $this->actingAs($pengguna)->getJson('/api/dashboard/'.$d->id)
            ->assertOk()
            ->json('data.widgets');

        $this->assertSame(2, $widgets[0]['data']['nilai'], 'Widget sehat tetap menampilkan angkanya.');
        $this->assertNull($widgets[1]['data']['nilai']);
        $this->assertSame('Widget tidak dikenal.', $widgets[1]['data']['pesan']);
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/dashboard/utama')->assertUnauthorized();
    }
}
