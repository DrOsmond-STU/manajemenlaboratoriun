<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Ruangan menyimpan seluruh isian yang ditampilkan layar.
 *
 * Tabel ini semula dibuat untuk melayani pemesanan saja. Menyambungkan layar
 * ke tabel yang lebih tipis akan menghilangkan jenis ruangan, luas, tarif,
 * penanggung jawab, tata letak, dan fasilitas dari antarmuka tanpa ada yang
 * meminta — kemunduran yang paling mudah lolos, karena tidak menimbulkan
 * galat apa pun, hanya isian yang diam-diam berkurang.
 */
class RoomKolomLengkapTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string,mixed>
     */
    private function isian(array $ganti = []): array
    {
        return array_merge([
            'kode' => 'CR-B-401',
            'nama' => 'Conference Room Garuda',
            'jenis' => 'Conference Room',
            'gedung' => 'Gedung B',
            'lantai' => '4',
            'luas_m2' => 96,
            'kapasitas' => 45,
            'skema_tarif' => 'berbayar',
            'tarif' => 1_250_000,
            'tata_letak' => ['Theater', 'Classroom', 'U-Shape'],
            'fasilitas' => ['Proyektor 2x', 'Sound System', 'Video Conf', 'AC'],
            'keterangan' => 'Panggung kecil tersedia.',
        ], $ganti);
    }

    public function test_seluruh_isian_layar_tersimpan_dan_terbaca_kembali(): void
    {
        $pj = User::factory()->create(['name' => 'Rahmat Hidayat']);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/rooms', $this->isian(['penanggung_jawab_id' => $pj->id]))
            ->assertCreated()
            ->json('data');

        $this->assertSame('Conference Room', $data['jenis']);
        $this->assertSame(96, $data['luas_m2']);
        $this->assertSame(45, $data['kapasitas']);
        $this->assertSame(1_250_000, $data['tarif']['nilai']);
        $this->assertSame('berbayar', $data['tarif']['skema']);
        $this->assertSame(['Theater', 'Classroom', 'U-Shape'], $data['tata_letak']);
        $this->assertCount(4, $data['fasilitas']);
        $this->assertSame('Rahmat Hidayat', $data['penanggung_jawab']['nama']);
        $this->assertSame('Panggung kecil tersedia.', $data['keterangan']);
    }

    public function test_nama_skema_tarif_dan_status_ikut_dikirim(): void
    {
        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/rooms', $this->isian())
            ->assertCreated()
            ->json('data');

        // Antarmuka tidak boleh memelihara salinan daftar yang sama — salinan
        // itu pasti menyimpang, dan yang tampil lalu jadi kode mentah.
        $this->assertSame('Berbayar', $data['tarif']['skema_nama']);
        $this->assertSame('Tersedia', $data['status']['nama']);
        $this->assertSame('tersedia', $data['status']['kode']);
    }

    public function test_daftar_kosong_dikirim_sebagai_larik_bukan_null(): void
    {
        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/rooms', $this->isian([
                'skema_tarif' => 'internal', 'tarif' => null,
                'tata_letak' => null, 'fasilitas' => null,
            ]))
            ->assertCreated()
            ->json('data');

        // Antarmuka yang memanggil .map() pada null akan patah, dan
        // "belum ada fasilitas" paling tepat diwakili larik kosong.
        $this->assertSame([], $data['tata_letak']);
        $this->assertSame([], $data['fasilitas']);
    }

    // --- Tarif ---------------------------------------------------------------

    public function test_ruangan_berbayar_tanpa_tarif_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/rooms', $this->isian(['tarif' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('tarif');
    }

    public function test_basis_data_menolak_berbayar_tanpa_tarif_walau_lapis_aplikasi_dilewati(): void
    {
        // Ruangan berbayar tanpa tarif akan ditagihkan dengan angka yang belum
        // ada. Harus ketahuan sekarang, bukan saat tagihan pertama terbit.
        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/rooms_berbayar_wajib_bertarif/');

        DB::table('rooms')->insert([
            'kode' => 'X-1', 'nama' => 'Uji', 'skema_tarif' => 'berbayar', 'tarif' => null,
            'kapasitas' => 0, 'status' => 'tersedia', 'perlu_persetujuan' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_skema_tarif_ngawur_ditolak_basis_data(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/rooms_skema_tarif_sah/');

        DB::table('rooms')->insert([
            'kode' => 'X-2', 'nama' => 'Uji', 'skema_tarif' => 'sesuka-hati',
            'kapasitas' => 0, 'status' => 'tersedia', 'perlu_persetujuan' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_internal_bertarif_nol_berbeda_dari_berbayar_belum_bertarif(): void
    {
        $pengguna = $this->penggunaBerperan('facility-manager');

        $internal = $this->actingAs($pengguna)
            ->postJson('/api/rooms', $this->isian([
                'kode' => 'MR-A-105', 'skema_tarif' => 'internal', 'tarif' => 0,
            ]))
            ->assertCreated()->json('data.tarif');

        // Keduanya "tidak menagih apa-apa hari ini", tetapi hanya satu yang
        // sah. Satu kolom angka saja tidak dapat membedakannya.
        $this->assertSame('internal', $internal['skema']);
        $this->assertSame(0, $internal['nilai']);

        $this->actingAs($pengguna)
            ->postJson('/api/rooms', $this->isian(['kode' => 'MR-A-106', 'tarif' => null]))
            ->assertStatus(422);
    }

    // --- Penyuntingan --------------------------------------------------------

    public function test_penyuntingan_tidak_menghapus_isian_yang_tidak_dikirim(): void
    {
        $pengguna = $this->penggunaBerperan('facility-manager');

        $id = $this->actingAs($pengguna)->postJson('/api/rooms', $this->isian())
            ->assertCreated()->json('data.id');

        // Mengubah kapasitas saja tidak boleh menghanguskan daftar fasilitas
        // yang sudah susah payah diisi.
        $data = $this->actingAs($pengguna)
            ->patchJson("/api/rooms/{$id}", ['kapasitas' => 50])
            ->assertOk()->json('data');

        $this->assertSame(50, $data['kapasitas']);
        $this->assertCount(4, $data['fasilitas']);
        $this->assertSame('Conference Room', $data['jenis']);
    }

    public function test_perubahan_tarif_ruangan_masuk_jejak_audit(): void
    {
        $pengelola = $this->penggunaBerperan('facility-manager');

        $id = $this->actingAs($pengelola)->postJson('/api/rooms', $this->isian())
            ->assertCreated()->json('data.id');

        $this->actingAs($pengelola)
            ->patchJson("/api/rooms/{$id}", ['tarif' => 1_500_000])
            ->assertOk();

        $entri = AuditLog::untukModel('Room', $id)
            ->where('peristiwa', 'diubah')->sole();

        $this->assertSame(1_250_000, (int) $entri->sebelum['tarif']);
        $this->assertSame(1_500_000, (int) $entri->sesudah['tarif']);
    }

    // --- Penyaringan ---------------------------------------------------------

    public function test_daftar_dapat_ditapis_per_jenis(): void
    {
        Room::factory()->create(['kode' => 'A-1', 'jenis' => 'Auditorium']);
        Room::factory()->create(['kode' => 'B-1', 'jenis' => 'Meeting Room']);

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson('/api/rooms?jenis=Auditorium')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.kode', 'A-1');
    }
}
