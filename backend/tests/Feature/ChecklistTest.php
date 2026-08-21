<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Models\ChecklistRun;
use App\Models\ChecklistTemplate;
use App\Models\Laboratory;
use App\Models\Room;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Checklist: templat, penugasan, pelaksanaan.
 *
 * Modul ini diminta khusus pada dokumen fitur: melekat pada ruangan atau
 * peralatan, enam jenis, dapat dibuat sendiri oleh pengguna, dan melekat pada
 * user. Tiga sifat itu yang dijaga uji di bawah — beserta dua penjagaan yang
 * paling mudah terlewat: checklist kosong dan checklist setengah terisi.
 */
class ChecklistTest extends TestCase
{
    use RefreshDatabase;

    private function alat(): Asset
    {
        BmnKodeBarang::firstOrCreate(
            ['kode' => '3.08.01.03.001'],
            ['uraian' => 'Alat uji', 'masa_manfaat' => 8],
        );

        return Asset::factory()->kodeBarang('3.08.01.03.001')->create();
    }

    /**
     * @return array<string,mixed>
     */
    private function isianTemplat(array $ganti = []): array
    {
        return array_merge([
            'nama' => 'Checklist Kebersihan Harian',
            'jenis' => 'kebersihan',
            'items' => [
                ['teks' => 'Lantai bersih dari tumpahan', 'tipe' => 'ya_tidak'],
                ['teks' => 'Tempat sampah dikosongkan', 'tipe' => 'ya_tidak'],
                ['teks' => 'Suhu ruangan', 'tipe' => 'angka', 'satuan' => '°C', 'wajib' => false],
            ],
        ], $ganti);
    }

    // --- Templat ---------------------------------------------------------------

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/checklist/templat')->assertUnauthorized();
    }

    public function test_pengguna_dapat_membuat_templat_sendiri(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/checklist/templat', $this->isianTemplat())
            ->assertCreated()
            ->assertJsonPath('data.jenis.nama', 'Kebersihan')
            ->assertJsonPath('data.jumlah_butir', 3);

        $this->assertDatabaseCount('checklist_items', 3);
    }

    public function test_keenam_jenis_tersedia(): void
    {
        $this->assertSame(
            ['pengecekan', 'perawatan', 'penyewaan', 'kebersihan', 'kerapian', 'kelayakan'],
            array_keys(ChecklistTemplate::JENIS),
        );

        $pengguna = $this->penggunaBerperan('facility-manager');

        foreach (array_keys(ChecklistTemplate::JENIS) as $i => $jenis) {
            $this->actingAs($pengguna)
                ->postJson('/api/checklist/templat', $this->isianTemplat([
                    'nama' => "Templat {$i}", 'jenis' => $jenis,
                ]))
                ->assertCreated();
        }
    }

    public function test_templat_tanpa_butir_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/checklist/templat', $this->isianTemplat(['items' => []]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('items');
    }

    public function test_urutan_butir_diberikan_otomatis(): void
    {
        $id = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/checklist/templat', $this->isianTemplat())
            ->assertCreated()->json('data.id');

        $urutan = ChecklistTemplate::find($id)->items->pluck('urutan')->all();
        $this->assertSame([1, 2, 3], $urutan);
    }

    // --- Melekat pada sumber daya ------------------------------------------------

    public function test_dapat_ditugaskan_pada_ruangan_laboratorium_dan_aset(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir()->create();
        $pelaksana = $this->penggunaBerperan('lab-technician');
        $pengelola = $this->penggunaBerperan('facility-manager');

        foreach ([
            ['room_id' => Room::factory()->create()->id],
            ['laboratory_id' => Laboratory::factory()->create()->id],
            ['asset_id' => $this->alat()->id],
        ] as $sumber) {
            $this->actingAs($pengelola)
                ->postJson('/api/checklist/penugasan', [
                    'checklist_template_id' => $templat->id,
                    'user_id' => $pelaksana->id,
                    'periode' => 'harian',
                    ...$sumber,
                ])
                ->assertCreated();
        }

        $this->assertDatabaseCount('checklist_assignments', 3);
    }

    public function test_penugasan_harus_tepat_satu_sumber_daya(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir()->create();
        $pelaksana = $this->penggunaBerperan('lab-technician');
        $pengelola = $this->penggunaBerperan('facility-manager');

        // Tidak satu pun.
        $this->actingAs($pengelola)->postJson('/api/checklist/penugasan', [
            'checklist_template_id' => $templat->id, 'user_id' => $pelaksana->id,
        ])->assertStatus(422)->assertJsonValidationErrors('room_id');

        // Dua sekaligus.
        $this->actingAs($pengelola)->postJson('/api/checklist/penugasan', [
            'checklist_template_id' => $templat->id, 'user_id' => $pelaksana->id,
            'room_id' => Room::factory()->create()->id,
            'asset_id' => $this->alat()->id,
        ])->assertStatus(422)->assertJsonValidationErrors('room_id');

        $this->assertDatabaseCount('checklist_assignments', 0);
    }

    public function test_batasan_tepat_satu_dijaga_basis_data(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir()->create();
        $pelaksana = $this->penggunaBerperan('lab-technician');

        // Menembus lapisan aplikasi sepenuhnya.
        $this->expectException(QueryException::class);

        DB::table('checklist_assignments')->insert([
            'checklist_template_id' => $templat->id,
            'user_id' => $pelaksana->id,
            'room_id' => null, 'laboratory_id' => null, 'asset_id' => null,
            'periode' => 'harian', 'aktif' => true,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    // --- Melekat pada user ---------------------------------------------------------

    public function test_tugas_saya_hanya_menampilkan_milik_sendiri(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir()->create();
        $saya = $this->penggunaBerperan('lab-technician');
        $oranglain = $this->penggunaBerperan('lab-technician');
        $room = Room::factory()->create(['nama' => 'Lab Kimia 1']);

        $pengelola = $this->penggunaBerperan('facility-manager');

        foreach ([$saya, $oranglain] as $u) {
            $this->actingAs($pengelola)->postJson('/api/checklist/penugasan', [
                'checklist_template_id' => $templat->id,
                'user_id' => $u->id, 'room_id' => $room->id, 'periode' => 'harian',
            ])->assertCreated();
        }

        $this->actingAs($saya)->getJson('/api/checklist/tugas-saya')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.sumber_daya.nama', 'Lab Kimia 1')
            ->assertJsonPath('data.0.penanggung_jawab.id', $saya->id);
    }

    // --- Pelaksanaan ------------------------------------------------------------------

    private function mulaiPelaksanaan(ChecklistTemplate $templat, Room $room, $pelaksana): int
    {
        return $this->actingAs($pelaksana)
            ->postJson('/api/checklist/pelaksanaan', [
                'checklist_template_id' => $templat->id,
                'room_id' => $room->id,
            ])
            ->assertCreated()->json('data.id');
    }

    public function test_pelaksanaan_dapat_dimulai_diisi_dan_diselesaikan(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir(3)->create();
        $room = Room::factory()->create();
        $pelaksana = $this->penggunaBerperan('lab-technician');

        $id = $this->mulaiPelaksanaan($templat, $room, $pelaksana);

        foreach ($templat->items as $butir) {
            $this->actingAs($pelaksana)
                ->postJson("/api/checklist/pelaksanaan/{$id}/jawab", [
                    'checklist_item_id' => $butir->id,
                    'nilai' => 'ya',
                ])->assertOk();
        }

        $this->actingAs($pelaksana)
            ->postJson("/api/checklist/pelaksanaan/{$id}/selesaikan", ['catatan' => 'Semua baik'])
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'selesai')
            ->assertJsonPath('data.hasil.skor', 100)
            ->assertJsonPath('data.hasil.butir_lulus', 3);
    }

    public function test_butir_wajib_kosong_menahan_penyelesaian(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir(3)->create();
        $room = Room::factory()->create();
        $pelaksana = $this->penggunaBerperan('lab-technician');

        $id = $this->mulaiPelaksanaan($templat, $room, $pelaksana);

        // Hanya satu dari tiga butir wajib yang diisi.
        $this->actingAs($pelaksana)->postJson("/api/checklist/pelaksanaan/{$id}/jawab", [
            'checklist_item_id' => $templat->items->first()->id, 'nilai' => 'ya',
        ])->assertOk();

        // Checklist setengah terisi yang tercatat "sudah diperiksa" lebih
        // menyesatkan daripada tidak diperiksa sama sekali.
        $this->actingAs($pelaksana)
            ->postJson("/api/checklist/pelaksanaan/{$id}/selesaikan")
            ->assertStatus(422)
            ->assertJsonValidationErrors('butir');

        $this->assertSame('berjalan', ChecklistRun::find($id)->status);
    }

    public function test_skor_dihitung_dari_butir_yang_dinilai_saja(): void
    {
        $templat = ChecklistTemplate::factory()->create();
        $templat->items()->createMany([
            ['urutan' => 1, 'teks' => 'Lantai bersih', 'tipe' => 'ya_tidak', 'wajib' => true],
            ['urutan' => 2, 'teks' => 'Meja rapi', 'tipe' => 'ya_tidak', 'wajib' => true],
            ['urutan' => 3, 'teks' => 'Suhu ruangan', 'tipe' => 'angka', 'wajib' => true, 'satuan' => '°C'],
        ]);

        $room = Room::factory()->create();
        $pelaksana = $this->penggunaBerperan('lab-technician');
        $id = $this->mulaiPelaksanaan($templat, $room, $pelaksana);

        $jawaban = ['ya', 'tidak', '24'];
        foreach ($templat->items as $i => $butir) {
            $this->actingAs($pelaksana)->postJson("/api/checklist/pelaksanaan/{$id}/jawab", [
                'checklist_item_id' => $butir->id, 'nilai' => $jawaban[$i],
            ])->assertOk();
        }

        // 1 dari 2 butir ya_tidak lulus = 50. Butir angka tidak ikut dinilai —
        // memasukkannya akan membuat skor kehilangan arti.
        $this->actingAs($pelaksana)
            ->postJson("/api/checklist/pelaksanaan/{$id}/selesaikan")
            ->assertOk()
            ->assertJsonPath('data.hasil.skor', 50);
    }

    public function test_templat_tanpa_butir_tidak_dapat_dilaksanakan(): void
    {
        $templat = ChecklistTemplate::factory()->create();   // tanpa butir
        $room = Room::factory()->create();

        // Checklist kosong akan selalu selesai dengan skor sempurna tanpa
        // memeriksa apa pun.
        $this->actingAs($this->penggunaBerperan('lab-technician'))
            ->postJson('/api/checklist/pelaksanaan', [
                'checklist_template_id' => $templat->id, 'room_id' => $room->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('checklist_template_id');
    }

    public function test_templat_tidak_aktif_tidak_dapat_dilaksanakan(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir()->create(['aktif' => false]);
        $room = Room::factory()->create();

        $this->actingAs($this->penggunaBerperan('lab-technician'))
            ->postJson('/api/checklist/pelaksanaan', [
                'checklist_template_id' => $templat->id, 'room_id' => $room->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('checklist_template_id');
    }

    public function test_pelaksanaan_selesai_tidak_dapat_diubah_lagi(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir(1)->create();
        $room = Room::factory()->create();
        $pelaksana = $this->penggunaBerperan('lab-technician');
        $id = $this->mulaiPelaksanaan($templat, $room, $pelaksana);

        $butir = $templat->items->first();
        $this->actingAs($pelaksana)->postJson("/api/checklist/pelaksanaan/{$id}/jawab", [
            'checklist_item_id' => $butir->id, 'nilai' => 'ya',
        ])->assertOk();
        $this->actingAs($pelaksana)->postJson("/api/checklist/pelaksanaan/{$id}/selesaikan")->assertOk();

        $this->actingAs($pelaksana)->postJson("/api/checklist/pelaksanaan/{$id}/jawab", [
            'checklist_item_id' => $butir->id, 'nilai' => 'tidak',
        ])->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_butir_dari_templat_lain_ditolak(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir(1)->create();
        $lain = ChecklistTemplate::factory()->denganButir(1)->create();
        $room = Room::factory()->create();
        $pelaksana = $this->penggunaBerperan('lab-technician');
        $id = $this->mulaiPelaksanaan($templat, $room, $pelaksana);

        $this->actingAs($pelaksana)->postJson("/api/checklist/pelaksanaan/{$id}/jawab", [
            'checklist_item_id' => $lain->items->first()->id, 'nilai' => 'ya',
        ])->assertStatus(422)->assertJsonValidationErrors('checklist_item_id');
    }

    public function test_jawaban_dapat_diperbarui_sebelum_selesai(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir(1)->create();
        $room = Room::factory()->create();
        $pelaksana = $this->penggunaBerperan('lab-technician');
        $id = $this->mulaiPelaksanaan($templat, $room, $pelaksana);
        $butir = $templat->items->first();

        $this->actingAs($pelaksana)->postJson("/api/checklist/pelaksanaan/{$id}/jawab", [
            'checklist_item_id' => $butir->id, 'nilai' => 'ya',
        ])->assertOk();

        $this->actingAs($pelaksana)->postJson("/api/checklist/pelaksanaan/{$id}/jawab", [
            'checklist_item_id' => $butir->id, 'nilai' => 'tidak', 'catatan' => 'Koreksi',
        ])->assertOk();

        // Satu butir hanya punya satu jawaban dalam satu pelaksanaan.
        $this->assertDatabaseCount('checklist_answers', 1);

        $this->actingAs($pelaksana)->postJson("/api/checklist/pelaksanaan/{$id}/selesaikan")
            ->assertOk()->assertJsonPath('data.hasil.skor', 0);
    }

    // --- Otorisasi -----------------------------------------------------------------------

    public function test_employee_boleh_melaksanakan_tetapi_tidak_menugaskan(): void
    {
        $templat = ChecklistTemplate::factory()->denganButir()->create();
        $room = Room::factory()->create();
        $employee = $this->penggunaBerperan('employee');

        // Matriks: employee pada checklist adalah BUAT — mengerjakan boleh.
        $this->actingAs($employee)->postJson('/api/checklist/pelaksanaan', [
            'checklist_template_id' => $templat->id, 'room_id' => $room->id,
        ])->assertCreated();

        // Menugaskan orang lain menuntut UBAH.
        $this->actingAs($employee)->postJson('/api/checklist/penugasan', [
            'checklist_template_id' => $templat->id,
            'user_id' => $employee->id, 'room_id' => $room->id,
        ])->assertForbidden();
    }

    public function test_finance_tidak_boleh_membaca_checklist(): void
    {
        // Matriks: finance pada checklist adalah '—'.
        $this->actingAs($this->penggunaBerperan('finance'))
            ->getJson('/api/checklist/templat')->assertForbidden();
    }
}
