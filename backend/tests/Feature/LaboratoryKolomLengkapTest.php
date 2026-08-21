<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Laboratory;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Laboratorium menyimpan seluruh isian yang ditampilkan layar, termasuk
 * fasilitas dan daftar teknisi.
 */
class LaboratoryKolomLengkapTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string,mixed>
     */
    private function isian(array $ganti = []): array
    {
        return array_merge([
            'kode' => 'LAB-KIM-01',
            'nama' => 'Laboratorium Kimia Analitik',
            'jenis' => 'Pengujian',
            'unit_kerja' => 'Pengujian Mutu',
            'luas_m2' => 145,
            'kapasitas' => 24,
            'jam_layanan' => '07:30 – 17:00',
            'akreditasi' => 'ISO/IEC 17025:2017',
            'fasilitas' => ['Fume Hood 4', 'Emergency Shower', 'Eye Wash', 'APAR CO2'],
        ], $ganti);
    }

    public function test_fasilitas_dan_teknisi_tersimpan_dan_terbaca_kembali(): void
    {
        $pj = User::factory()->create(['name' => 'Dr. Sri Wahyuni']);
        $sv = User::factory()->create(['name' => 'Prof. Bambang']);
        $t1 = User::factory()->create(['name' => 'Andi Teknisi']);
        $t2 = User::factory()->create(['name' => 'Rina Teknisi']);

        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/laboratories', $this->isian([
                'penanggung_jawab_id' => $pj->id,
                'supervisor_id' => $sv->id,
                'teknisi_ids' => [$t1->id, $t2->id],
            ]))
            ->assertCreated()
            ->json('data');

        $this->assertCount(4, $data['fasilitas']);
        $this->assertContains('Fume Hood 4', $data['fasilitas']);
        $this->assertSame('Dr. Sri Wahyuni', $data['penanggung_jawab']['nama']);
        $this->assertSame('Prof. Bambang', $data['supervisor']['nama']);
        $this->assertSame(
            ['Andi Teknisi', 'Rina Teknisi'],
            collect($data['teknisi'])->pluck('nama')->sort()->values()->all()
        );
        $this->assertSame('ISO/IEC 17025:2017', $data['akreditasi']);
        $this->assertSame('Aktif', $data['status']['nama']);
    }

    public function test_fasilitas_kosong_dikirim_sebagai_larik(): void
    {
        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/laboratories', $this->isian(['fasilitas' => null]))
            ->assertCreated()->json('data');

        $this->assertSame([], $data['fasilitas']);
    }

    // --- Teknisi -------------------------------------------------------------

    public function test_penyuntingan_tanpa_menyertakan_teknisi_tidak_menghapus_penugasan(): void
    {
        $pengguna = $this->penggunaBerperan('lab-manager');
        $t = User::factory()->create(['name' => 'Andi Teknisi']);

        $id = $this->actingAs($pengguna)
            ->postJson('/api/laboratories', $this->isian(['teknisi_ids' => [$t->id]]))
            ->assertCreated()->json('data.id');

        // Kehilangan diam-diam yang baru ketahuan saat notifikasi jadwal
        // perawatan tidak sampai ke siapa pun.
        $data = $this->actingAs($pengguna)
            ->patchJson("/api/laboratories/{$id}", ['kapasitas' => 30])
            ->assertOk()->json('data');

        $this->assertSame(30, $data['kapasitas']);
        $this->assertCount(1, $data['teknisi']);
        $this->assertSame('Andi Teknisi', $data['teknisi'][0]['nama']);
    }

    public function test_daftar_teknisi_dikirim_utuh_menggantikan_yang_lama(): void
    {
        $pengguna = $this->penggunaBerperan('lab-manager');
        $lama = User::factory()->create(['name' => 'Teknisi Lama']);
        $baru = User::factory()->create(['name' => 'Teknisi Baru']);

        $id = $this->actingAs($pengguna)
            ->postJson('/api/laboratories', $this->isian(['teknisi_ids' => [$lama->id]]))
            ->assertCreated()->json('data.id');

        $data = $this->actingAs($pengguna)
            ->patchJson("/api/laboratories/{$id}", ['teknisi_ids' => [$baru->id]])
            ->assertOk()->json('data');

        $this->assertCount(1, $data['teknisi']);
        $this->assertSame('Teknisi Baru', $data['teknisi'][0]['nama']);
    }

    public function test_daftar_teknisi_dapat_dikosongkan_dengan_sengaja(): void
    {
        $pengguna = $this->penggunaBerperan('lab-manager');
        $t = User::factory()->create();

        $id = $this->actingAs($pengguna)
            ->postJson('/api/laboratories', $this->isian(['teknisi_ids' => [$t->id]]))
            ->assertCreated()->json('data.id');

        // Larik kosong berbeda dari tidak dikirim sama sekali: yang pertama
        // berarti "tidak ada teknisinya", yang kedua berarti "jangan diubah".
        $data = $this->actingAs($pengguna)
            ->patchJson("/api/laboratories/{$id}", ['teknisi_ids' => []])
            ->assertOk()->json('data');

        $this->assertSame([], $data['teknisi']);
    }

    public function test_teknisi_kembar_ditolak(): void
    {
        $t = User::factory()->create();

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/laboratories', $this->isian(['teknisi_ids' => [$t->id, $t->id]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('teknisi_ids.1');
    }

    public function test_basis_data_menolak_penugasan_ganda_walau_lapis_aplikasi_dilewati(): void
    {
        $lab = Laboratory::factory()->create();
        $t = User::factory()->create();

        DB::table('laboratory_technicians')->insert([
            'laboratory_id' => $lab->id, 'user_id' => $t->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        // Penugasan ganda menghasilkan notifikasi berganda dan hitungan
        // teknisi yang salah.
        $this->expectException(QueryException::class);

        DB::table('laboratory_technicians')->insert([
            'laboratory_id' => $lab->id, 'user_id' => $t->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_penugasan_ikut_hilang_saat_penggunanya_dihapus(): void
    {
        $lab = Laboratory::factory()->create();
        $t = User::factory()->create();
        $lab->teknisi()->sync([$t->id]);

        $this->assertSame(1, $lab->teknisi()->count());

        // Berbeda dari jejak audit, yang justru harus bertahan setelah
        // penggunanya hilang: di sini yang dicatat adalah keadaan sekarang,
        // dan penugasan tanpa orangnya tidak punya arti.
        $t->delete();

        $this->assertSame(0, $lab->teknisi()->count());
    }

    public function test_satu_teknisi_dapat_melayani_beberapa_laboratorium(): void
    {
        $t = User::factory()->create(['name' => 'Andi']);
        $kimia = Laboratory::factory()->create(['nama' => 'Kimia']);
        $mikro = Laboratory::factory()->create(['nama' => 'Mikrobiologi']);

        $kimia->teknisi()->sync([$t->id]);
        $mikro->teknisi()->sync([$t->id]);

        // Pertanyaan yang benar-benar diajukan saat orang itu cuti.
        $dilayani = DB::table('laboratory_technicians')
            ->join('laboratories', 'laboratories.id', '=', 'laboratory_technicians.laboratory_id')
            ->where('laboratory_technicians.user_id', $t->id)
            ->pluck('laboratories.nama')->sort()->values()->all();

        $this->assertSame(['Kimia', 'Mikrobiologi'], $dilayani);
    }

    public function test_perubahan_akreditasi_masuk_jejak_audit(): void
    {
        $pengelola = $this->penggunaBerperan('lab-manager');

        $id = $this->actingAs($pengelola)
            ->postJson('/api/laboratories', $this->isian())
            ->assertCreated()->json('data.id');

        $this->actingAs($pengelola)
            ->patchJson("/api/laboratories/{$id}", ['akreditasi' => 'KAN LP-1234-IDN'])
            ->assertOk();

        // Akreditasi adalah klaim yang dipakai pelanggan luar untuk
        // memutuskan apakah hasil ujinya sah.
        $entri = AuditLog::untukModel('Laboratory', $id)
            ->where('peristiwa', 'diubah')->sole();

        $this->assertSame('ISO/IEC 17025:2017', $entri->sebelum['akreditasi']);
        $this->assertSame('KAN LP-1234-IDN', $entri->sesudah['akreditasi']);
    }
}
