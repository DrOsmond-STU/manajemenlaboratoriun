<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\BscIndikator;
use App\Models\BscObjective;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BalancedScorecardTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string,mixed>
     */
    private function perspektif(array $objectives, array $ganti = []): array
    {
        return array_merge([
            'periode' => '2026',
            'perspektif' => 'pelanggan',
            'objectives' => $objectives,
        ], $ganti);
    }

    /**
     * @return array<string,mixed>
     */
    private function sasaran(array $indikator, array $ganti = []): array
    {
        return array_merge([
            'nama' => 'Meningkatkan kepuasan pengguna',
            'indikator' => $indikator,
        ], $ganti);
    }

    /**
     * @return array<string,mixed>
     */
    private function indikator(array $ganti = []): array
    {
        return array_merge([
            'nama' => 'Kepuasan pengguna layanan',
            'satuan' => '%',
            'polaritas' => 'naik-baik',
            'target' => 90,
            'bobot' => 100,
        ], $ganti);
    }

    // --- Arah indikator ------------------------------------------------------

    public function test_indikator_turun_baik_dinilai_terbalik(): void
    {
        $keluhan = new BscIndikator([
            'polaritas' => 'turun-baik', 'target' => 10, 'realisasi' => 5,
        ]);

        // Lima keluhan terhadap target maksimal sepuluh adalah 200% capaian.
        // Rumus yang selalu realisasi/target akan membacanya 50% — lalu
        // memberi penghargaan kepada orang yang salah.
        $this->assertSame(200.0, $keluhan->capaian());

        $memburuk = new BscIndikator([
            'polaritas' => 'turun-baik', 'target' => 10, 'realisasi' => 20,
        ]);
        $this->assertSame(50.0, $memburuk->capaian());
    }

    public function test_realisasi_nol_pada_indikator_turun_baik_berarti_sempurna(): void
    {
        $nol = new BscIndikator(['polaritas' => 'turun-baik', 'target' => 10, 'realisasi' => 0]);

        // Nol keluhan tidak boleh menjadi "tidak terdefinisi" karena
        // pembagian dengan nol.
        $this->assertSame(100.0, $nol->capaian());
    }

    public function test_capaian_dibatasi_saat_menghitung_skor(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([
                $this->indikator(['nama' => 'Salah tulis target', 'target' => 1, 'realisasi' => 90, 'bobot' => 50]),
                $this->indikator(['nama' => 'Benar-benar gagal', 'target' => 100, 'realisasi' => 10, 'bobot' => 50]),
            ]),
        ]))->assertOk();

        $kartu = $this->actingAs($pengelola)->getJson('/api/bsc?periode=2026')->assertOk()->json('data');
        $pelanggan = collect($kartu['perspektif'])->firstWhere('kode', 'pelanggan');
        $indikator = $pelanggan['sasaran'][0]['indikator'];

        // Capaian aslinya dilaporkan apa adanya...
        $this->assertEqualsWithDelta(9000, $indikator[0]['capaian'], 0.001);

        // ...tetapi skornya memakai batas 120, supaya satu target salah tulis
        // tidak menutupi indikator yang benar-benar gagal.
        $this->assertEqualsWithDelta(65, $pelanggan['skor'], 0.001, '(120 + 10) / 2 = 65');
    }

    // --- Sasaran strategis -----------------------------------------------------

    public function test_indikator_dikelompokkan_di_dalam_sasarannya(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([
                $this->indikator(['nama' => 'Indeks kepuasan', 'bobot' => 60]),
            ], ['nama' => 'Meningkatkan kepuasan pengguna']),
            $this->sasaran([
                $this->indikator(['nama' => 'Booking terpenuhi', 'bobot' => 40]),
            ], ['nama' => 'Menjamin ketersediaan fasilitas']),
        ]))->assertOk();

        $kartu = $this->actingAs($pengelola)->getJson('/api/bsc?periode=2026')->assertOk()->json('data');
        $pelanggan = collect($kartu['perspektif'])->firstWhere('kode', 'pelanggan');

        $this->assertCount(2, $pelanggan['sasaran']);
        $this->assertSame('Meningkatkan kepuasan pengguna', $pelanggan['sasaran'][0]['nama']);
        $this->assertSame('Indeks kepuasan', $pelanggan['sasaran'][0]['indikator'][0]['nama']);
        $this->assertSame('Menjamin ketersediaan fasilitas', $pelanggan['sasaran'][1]['nama']);
        $this->assertSame('Booking terpenuhi', $pelanggan['sasaran'][1]['indikator'][0]['nama']);
    }

    public function test_sasaran_tanpa_indikator_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/bsc/perspektif', $this->perspektif([
                $this->sasaran([], ['nama' => 'Sasaran kosong']),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('objectives');
    }

    public function test_nama_sasaran_kembar_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/bsc/perspektif', $this->perspektif([
                $this->sasaran([$this->indikator(['nama' => 'A', 'bobot' => 50])], ['nama' => 'Sasaran Sama']),
                $this->sasaran([$this->indikator(['nama' => 'B', 'bobot' => 50])], ['nama' => 'sasaran sama']),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('objectives');
    }

    public function test_menghapus_sasaran_ikut_menghapus_indikator_di_dalamnya(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([$this->indikator(['nama' => 'A'])], ['nama' => 'Sasaran A']),
        ]))->assertOk();

        $idSasaranLama = BscObjective::sole()->id;

        // Tulis ulang tanpa Sasaran A sama sekali.
        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([$this->indikator(['nama' => 'B'])], ['nama' => 'Sasaran B']),
        ]))->assertOk();

        $this->assertDatabaseMissing('bsc_objectives', ['id' => $idSasaranLama]);
        $this->assertSame(['B'], BscIndikator::pluck('nama')->all());
    }

    // --- Bobot (tetap per perspektif, bukan per sasaran) ----------------------

    public function test_bobot_yang_tidak_berjumlah_seratus_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/bsc/perspektif', $this->perspektif([
                $this->sasaran([
                    $this->indikator(['nama' => 'A', 'bobot' => 60]),
                    $this->indikator(['nama' => 'B', 'bobot' => 55]),
                ]),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('objectives');

        $this->assertDatabaseCount('bsc_indikator', 0);
    }

    public function test_bobot_dijumlahkan_lintas_sasaran_dalam_satu_perspektif(): void
    {
        // Sasaran murni pengelompokan tampilan — bobotnya tetap dijumlahkan
        // untuk SELURUH perspektif, bukan per sasaran. 60 di satu sasaran +
        // 40 di sasaran lain harus diterima sebagai 100.
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/bsc/perspektif', $this->perspektif([
                $this->sasaran([$this->indikator(['nama' => 'A', 'bobot' => 60])], ['nama' => 'Sasaran A']),
                $this->sasaran([$this->indikator(['nama' => 'B', 'bobot' => 40])], ['nama' => 'Sasaran B']),
            ]))
            ->assertOk();

        $this->assertDatabaseCount('bsc_indikator', 2);
    }

    public function test_basis_data_menolak_bobot_timpang_walau_lapis_aplikasi_dilewati(): void
    {
        $objective = BscObjective::create([
            'periode' => '2026', 'perspektif' => 'keuangan', 'nama' => 'Sasaran', 'urutan' => 0,
        ]);

        // Inti pemicu tertunda: baris ini sendirian TIDAK melanggar saat
        // ditulis — pelanggarannya baru ada ketika transaksi ditutup dengan
        // jumlah 60. Batasan per baris biasa tidak dapat menangkap ini, dan
        // itulah sebabnya penyusunan ulang satu perspektif utuh mungkin
        // dilakukan sama sekali.
        DB::table('bsc_indikator')->insert([
            'periode' => '2026', 'perspektif' => 'keuangan', 'bsc_objective_id' => $objective->id,
            'nama' => 'PNBP', 'polaritas' => 'naik-baik', 'target' => 100, 'bobot' => 60,
            'urutan' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);

        // Penyisipannya berhasil — belum ada galat sampai di sini.
        $this->assertDatabaseCount('bsc_indikator', 1);

        // Di produksi pemeriksaannya terjadi pada COMMIT. Uji ini berjalan di
        // dalam transaksi RefreshDatabase yang TIDAK PERNAH di-commit,
        // sehingga COMMIT-nya tak akan datang; SET CONSTRAINTS ALL IMMEDIATE
        // memaksa batasan tertunda diperiksa sekarang juga — cara baku
        // menguji batasan DEFERRABLE.
        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/bsc_bobot_tidak_seimbang/');

        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
    }

    public function test_pemicu_tertunda_meloloskan_keadaan_antara_yang_timpang(): void
    {
        $objective = BscObjective::create([
            'periode' => '2026', 'perspektif' => 'keuangan', 'nama' => 'Sasaran', 'urutan' => 0,
        ]);

        // Sisi baiknya, yang membuat seluruh rancangan ini berguna: dua baris
        // yang masing-masing timpang tetapi berjumlah 100 pada akhirnya
        // diterima, walau setelah baris pertama jumlahnya baru 40.
        DB::table('bsc_indikator')->insert([
            'periode' => '2026', 'perspektif' => 'keuangan', 'bsc_objective_id' => $objective->id,
            'nama' => 'PNBP', 'polaritas' => 'naik-baik', 'target' => 100, 'bobot' => 40,
            'urutan' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('bsc_indikator')->insert([
            'periode' => '2026', 'perspektif' => 'keuangan', 'bsc_objective_id' => $objective->id,
            'nama' => 'Efisiensi belanja', 'polaritas' => 'turun-baik', 'target' => 100, 'bobot' => 60,
            'urutan' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);

        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');

        $this->assertDatabaseCount('bsc_indikator', 2);
    }

    public function test_perspektif_dapat_disusun_ulang_utuh_dalam_satu_transaksi(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([
                $this->indikator(['nama' => 'A', 'bobot' => 50]),
                $this->indikator(['nama' => 'B', 'bobot' => 50]),
            ]),
        ]))->assertOk();

        // Menghapus B dan menambah C sekaligus. Di titik mana pun di tengah
        // transaksi jumlahnya bukan 100 — dan itu memang boleh, karena
        // pemeriksaannya tertunda sampai COMMIT.
        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([
                $this->indikator(['nama' => 'A', 'bobot' => 30]),
                $this->indikator(['nama' => 'C', 'bobot' => 70]),
            ]),
        ]))->assertOk();

        $this->assertSame(
            ['A', 'C'],
            BscIndikator::where('perspektif', 'pelanggan')->orderBy('urutan')->pluck('nama')->all()
        );
    }

    public function test_perspektif_boleh_dikosongkan_seluruhnya(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([$this->indikator(['bobot' => 100])]),
        ]))->assertOk();

        // Sebuah scorecard boleh belum menggarap satu perspektif. Yang tidak
        // boleh adalah terisi sebagian lalu dianggap utuh.
        $this->actingAs($pengelola)
            ->putJson('/api/bsc/perspektif', $this->perspektif([]))
            ->assertOk();

        $this->assertDatabaseCount('bsc_indikator', 0);
        $this->assertDatabaseCount('bsc_objectives', 0);
    }

    public function test_realisasi_yang_sudah_ada_tidak_hilang_saat_bobot_diubah(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([$this->indikator(['nama' => 'Kepuasan', 'bobot' => 100])]),
        ]))->assertOk();

        $id = BscIndikator::sole()->id;
        $this->actingAs($pengelola)
            ->patchJson("/api/bsc/indikator/{$id}/realisasi", ['realisasi' => 87])
            ->assertOk();

        // Mengubah bobot menulis ulang barisnya — id-nya berubah, dan
        // sasarannya sengaja dipindah ke sasaran lain sekalian. Angka yang
        // sudah dikumpulkan sepanjang tahun tidak boleh ikut lenyap.
        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([
                $this->indikator(['nama' => 'Kepuasan', 'bobot' => 40]),
            ], ['nama' => 'Sasaran Baru']),
            $this->sasaran([
                $this->indikator(['nama' => 'Waktu tunggu', 'polaritas' => 'turun-baik', 'target' => 3, 'bobot' => 60]),
            ], ['nama' => 'Sasaran Lain']),
        ]))->assertOk();

        $kepuasan = BscIndikator::where('nama', 'Kepuasan')->sole();

        $this->assertSame(87.0, $kepuasan->realisasi);
        $this->assertNotSame($id, $kepuasan->id, 'Barisnya memang ditulis ulang.');
    }

    public function test_nama_indikator_kembar_ditolak_walau_di_sasaran_berbeda(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/bsc/perspektif', $this->perspektif([
                $this->sasaran([$this->indikator(['nama' => 'Kepuasan', 'bobot' => 50])], ['nama' => 'Sasaran A']),
                $this->sasaran([$this->indikator(['nama' => 'KEPUASAN', 'bobot' => 50])], ['nama' => 'Sasaran B']),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('objectives');
    }

    public function test_target_nol_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/bsc/perspektif', $this->perspektif([
                $this->sasaran([$this->indikator(['target' => 0])]),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('objectives.0.indikator.0.target');
    }

    public function test_polaritas_wajib_diisi(): void
    {
        $indikator = $this->indikator();
        unset($indikator['polaritas']);

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/bsc/perspektif', $this->perspektif([$this->sasaran([$indikator])]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('objectives.0.indikator.0.polaritas');
    }

    // --- Kartu skor ----------------------------------------------------------

    public function test_perspektif_yang_belum_digarap_tetap_muncul(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([$this->indikator()]),
        ]))->assertOk();

        $kartu = $this->actingAs($pengelola)->getJson('/api/bsc?periode=2026')->assertOk()->json('data');

        // Menghilangkan perspektif kosong membuat kartu skor tampak lengkap
        // padahal tiga perempat kerangkanya tidak pernah disentuh — dan itu
        // justru temuan yang paling perlu terlihat.
        $this->assertCount(4, $kartu['perspektif']);

        $keuangan = collect($kartu['perspektif'])->firstWhere('kode', 'keuangan');
        $this->assertEqualsWithDelta(0, $keuangan['bobot_total'], 0.001);
        $this->assertNull($keuangan['skor']);
        $this->assertSame([], $keuangan['sasaran']);
    }

    public function test_indikator_tanpa_realisasi_tidak_dihitung_nol(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([
                $this->indikator(['nama' => 'Sudah diisi', 'target' => 100, 'realisasi' => 80, 'bobot' => 50]),
                $this->indikator(['nama' => 'Belum diisi', 'target' => 100, 'bobot' => 50]),
            ]),
        ]))->assertOk();

        $kartu = $this->actingAs($pengelola)->getJson('/api/bsc?periode=2026')->assertOk()->json('data');
        $pelanggan = collect($kartu['perspektif'])->firstWhere('kode', 'pelanggan');

        // Menghitungnya nol membuat kartu skor Januari selalu merah padahal
        // datanya memang belum masuk, dan orang berhenti mempercayai angkanya.
        $this->assertEqualsWithDelta(80, $pelanggan['skor'], 0.001);
    }

    public function test_skor_gabungan_merata_antarperspektif_yang_terisi(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif(
            [$this->sasaran([$this->indikator(['target' => 100, 'realisasi' => 100])])],
        ))->assertOk();

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif(
            [$this->sasaran([$this->indikator(['nama' => 'PNBP', 'target' => 100, 'realisasi' => 60])])],
            ['perspektif' => 'keuangan'],
        ))->assertOk();

        $kartu = $this->actingAs($pengelola)->getJson('/api/bsc?periode=2026')->assertOk()->json('data');

        $this->assertEqualsWithDelta(80, $kartu['skor'], 0.001, 'Perspektif kosong tidak menarik skor gabungan ke bawah.');
    }

    public function test_periode_terpisah_tidak_saling_mengganggu(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        foreach (['2025', '2026'] as $periode) {
            $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif(
                [$this->sasaran([$this->indikator(['target' => 100, 'realisasi' => $periode === '2025' ? 50 : 100])])],
                ['periode' => $periode],
            ))->assertOk();
        }

        $skor = fn (string $periode) => collect(
            $this->actingAs($pengelola)->getJson('/api/bsc?periode='.$periode)->json('data.perspektif')
        )->firstWhere('kode', 'pelanggan')['skor'];

        $this->assertEqualsWithDelta(50, $skor('2025'), 0.001);
        $this->assertEqualsWithDelta(100, $skor('2026'), 0.001);
    }

    public function test_periode_triwulan_diterima(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/bsc/perspektif', $this->perspektif(
                [$this->sasaran([$this->indikator()])], ['periode' => '2026-Q3'],
            ))
            ->assertOk();

        $this->assertSame('2026-Q3', BscIndikator::sole()->periode);
    }

    public function test_periode_ngawur_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/bsc/perspektif', $this->perspektif(
                [$this->sasaran([$this->indikator()])], ['periode' => 'kapan-kapan'],
            ))
            ->assertStatus(422)
            ->assertJsonValidationErrors('periode');
    }

    // --- Tren ------------------------------------------------------------------

    public function test_tren_mengikuti_periode_yang_sungguhan_tercatat(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        // Kunci array numerik ("2025") otomatis dijadikan int oleh PHP; nilai
        // periodenya dicetak ulang ke string di sini supaya tidak lolos
        // sebagai integer ke permintaan yang menuntut string.
        foreach (['2025' => 50, '2026' => 90] as $periode => $realisasi) {
            $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif(
                [$this->sasaran([$this->indikator(['target' => 100, 'realisasi' => $realisasi])])],
                ['periode' => (string) $periode],
            ))->assertOk();
        }

        $tren = $this->actingAs($pengelola)->getJson('/api/bsc/tren')->assertOk()->json('data');

        // Satu titik per periode yang sungguhan pernah diisi — bukan satu
        // titik per bulan kalender, karena tidak ada satu pun tempat yang
        // menyimpan skor per bulan.
        $this->assertSame(['2025', '2026'], array_column($tren, 'periode'));
        $this->assertEqualsWithDelta(50, $tren[0]['skor'], 0.001);
        $this->assertEqualsWithDelta(90, $tren[1]['skor'], 0.001);
    }

    // --- Akses & jejak -------------------------------------------------------

    public function test_pemegang_lihat_tidak_dapat_menyusun_kerangka(): void
    {
        $manajemen = $this->penggunaBerperan('management');

        $this->actingAs($manajemen)->getJson('/api/bsc?periode=2026')->assertOk();

        // Management hanya berhak LIHAT menurut matriks — lihat catatan pada
        // routes/api.php; ini butir yang perlu dipastikan ke satuan kerja.
        $this->actingAs($manajemen)
            ->putJson('/api/bsc/perspektif', $this->perspektif([$this->sasaran([$this->indikator()])]))
            ->assertForbidden();
    }

    public function test_perubahan_target_dan_realisasi_masuk_jejak_audit(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([$this->indikator(['nama' => 'Kepuasan', 'target' => 90])]),
        ]))->assertOk();

        $id = BscIndikator::sole()->id;
        $this->actingAs($pengelola)
            ->patchJson("/api/bsc/indikator/{$id}/realisasi", ['realisasi' => 95])
            ->assertOk();

        // Target, bobot, dan realisasi adalah yang akan dipersoalkan orang
        // bila skornya diragukan — dan jejaknya tidak dapat disunting siapa
        // pun, termasuk yang mengubahnya.
        $entri = AuditLog::untukModel('BscIndikator', $id)
            ->where('peristiwa', 'diubah')->sole();

        $this->assertNull($entri->sebelum['realisasi']);
        $this->assertSame(95, (int) $entri->sesudah['realisasi']);
        $this->assertSame($pengelola->id, $entri->user_id);
    }

    public function test_penyusunan_ulang_perspektif_menghasilkan_satu_entri_audit_bukan_belasan(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([
                $this->indikator(['nama' => 'Kepuasan', 'target' => 90, 'bobot' => 50]),
                $this->indikator(['nama' => 'Keluhan', 'polaritas' => 'turun-baik', 'target' => 10, 'bobot' => 50]),
            ]),
        ]))->assertOk();

        // Hanya bobotnya yang digeser; tidak ada indikator baru.
        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([
                $this->indikator(['nama' => 'Kepuasan', 'target' => 90, 'bobot' => 70]),
                $this->indikator(['nama' => 'Keluhan', 'polaritas' => 'turun-baik', 'target' => 10, 'bobot' => 30]),
            ]),
        ]))->assertOk();

        $entri = AuditLog::where('model', 'BscPerspektif')
            ->orderBy('id')->get();

        $this->assertCount(2, $entri, 'Satu entri per penyimpanan, bukan satu per indikator.');
        $this->assertSame('dibuat', $entri[0]->peristiwa);
        $this->assertSame('diubah', $entri[1]->peristiwa);
        $this->assertSame('Pelanggan · 2026', $entri[1]->label);

        // Yang dicari pemeriksa: bobot bergeser dari 50/50 menjadi 70/30 —
        // bukan "dua indikator dibuat".
        $this->assertSame(50, (int) $entri[1]->sebelum['sasaran'][0]['indikator'][0]['bobot']);
        $this->assertSame(70, (int) $entri[1]->sesudah['sasaran'][0]['indikator'][0]['bobot']);

        $this->assertSame(
            0,
            AuditLog::where('model', 'BscIndikator')->count(),
            'Penulisan ulang tidak boleh membanjiri jejak dengan entri per baris.'
        );
    }

    public function test_penyimpanan_tanpa_perubahan_tidak_menambah_entri_audit(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');
        $isi = $this->perspektif([$this->sasaran([$this->indikator()])]);

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $isi)->assertOk();
        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $isi)->assertOk();

        // Id baris memang berubah tiap penulisan ulang; itu bukan perubahan
        // yang perlu dicatat, dan mencatatnya membuat jejak penuh derau.
        $this->assertSame(1, AuditLog::where('model', 'BscPerspektif')->count());
    }

    public function test_pengosongan_perspektif_tercatat_sebagai_penghapusan(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([
            $this->sasaran([$this->indikator(['nama' => 'Kepuasan'])]),
        ]))->assertOk();

        $this->actingAs($pengelola)->putJson('/api/bsc/perspektif', $this->perspektif([]))->assertOk();

        $entri = AuditLog::where('model', 'BscPerspektif')->latest('id')->first();

        $this->assertSame('dihapus', $entri->peristiwa);
        $this->assertSame('Kepuasan', $entri->sebelum['sasaran'][0]['indikator'][0]['nama']);
        $this->assertNull($entri->sesudah, 'Yang hilang harus tercatat, bukan diam-diam lenyap.');
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/bsc')->assertUnauthorized();
    }
}
