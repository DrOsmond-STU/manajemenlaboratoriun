<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\BmnKodeBarang;
use App\Models\Room;
use App\Models\User;
use App\Support\Satker;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Perubahan, perpindahan, riwayat, dan penghapusan aset.
 *
 * Dua aturan yang dijaga paling keras di sini, keduanya karena kesalahannya
 * tidak menimbulkan galat apa pun sampai terlambat:
 *
 *   1. Identitas BMN tidak dapat diubah setelah aset terdaftar — labelnya sudah
 *      menempel di badan alat.
 *   2. NUP yang sudah diberikan tidak dipakai ulang, bahkan setelah asetnya
 *      dihapus — nomornya sudah beredar di dokumen.
 */
class AssetMutasiTest extends TestCase
{
    use RefreshDatabase;

    private function aset(array $ganti = []): Asset
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();

        return Asset::factory()->kodeBarang('3.08.01.03.001')->create($ganti);
    }

    // --- Perubahan data --------------------------------------------------

    public function test_data_teknis_dapat_diubah(): void
    {
        $aset = $this->aset(['nama' => 'Nama Lama']);

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}", ['nama' => 'Nama Baru', 'merk' => 'Shimadzu'])
            ->assertOk()
            ->assertJsonPath('data.nama', 'Nama Baru')
            ->assertJsonPath('data.merk', 'Shimadzu');
    }

    public function test_identitas_bmn_tidak_dapat_diubah_lewat_api(): void
    {
        $aset = $this->aset();
        BmnKodeBarang::factory()->kode('3.08.01.08.003')->create();

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}", [
                'kode_barang' => '3.08.01.08.003',
                'nup' => 999,
                'nama' => 'Nama Baru',
            ])
            ->assertOk();

        $aset->refresh();

        // Perubahan namanya tetap berlaku; identitas BMN-nya diabaikan.
        $this->assertSame('Nama Baru', $aset->nama);
        $this->assertSame('3.08.01.03.001', $aset->kode_barang);
        $this->assertNotSame(999, $aset->nup);
    }

    public function test_identitas_bmn_ditolak_pemicu_basis_data(): void
    {
        $aset = $this->aset();

        // Menembus lapisan aplikasi sepenuhnya — seperti perbaikan manual
        // lewat psql atau skrip impor yang keliru.
        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/Identitas BMN tidak boleh diubah/');

        DB::table('assets')->where('id', $aset->id)->update(['nup' => 999]);
    }

    public function test_kode_lokasi_juga_terkunci(): void
    {
        $aset = $this->aset();

        $this->expectException(QueryException::class);

        DB::table('assets')->where('id', $aset->id)->update(['kode_lokasi' => '999.99.9999.999999.999']);
    }

    public function test_kode_internal_kembar_saat_mengubah_ditolak(): void
    {
        $a = $this->aset(['kode_internal' => 'STU/A/0001']);
        $b = Asset::factory()->kodeBarang('3.08.01.03.001')->create(['kode_internal' => 'STU/B/0002']);

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$b->id}", ['kode_internal' => 'STU/A/0001'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('kode_internal');

        $this->assertSame('STU/A/0001', $a->fresh()->kode_internal);
    }

    public function test_kode_internal_sendiri_boleh_dikirim_ulang(): void
    {
        $aset = $this->aset(['kode_internal' => 'STU/A/0001']);

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}", ['kode_internal' => 'STU/A/0001', 'nama' => 'Berubah'])
            ->assertOk();
    }

    // --- Riwayat ----------------------------------------------------------

    public function test_perubahan_kondisi_tercatat_di_riwayat(): void
    {
        $aset = $this->aset(['kondisi' => 'B']);
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson("/api/assets/{$aset->id}", [
                'kondisi' => 'RB',
                'catatan_perubahan' => 'Rusak setelah kebocoran atap',
            ])
            ->assertOk();

        $riwayat = AssetMutation::where('asset_id', $aset->id)->firstOrFail();

        $this->assertSame('kondisi', $riwayat->jenis);
        $this->assertSame('Baik', $riwayat->nilai_lama);
        $this->assertSame('Rusak Berat', $riwayat->nilai_baru);
        $this->assertSame('Rusak setelah kebocoran atap', $riwayat->catatan);
        $this->assertSame($user->id, $riwayat->user_id);
    }

    public function test_perubahan_yang_tidak_mengubah_apa_pun_tidak_dicatat(): void
    {
        $aset = $this->aset(['kondisi' => 'B']);

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}", ['kondisi' => 'B', 'nama' => 'Nama Baru'])
            ->assertOk();

        // Nama bukan kolom yang diawasi riwayat, dan kondisinya tidak berubah.
        $this->assertDatabaseCount('asset_mutations', 0);
    }

    public function test_beberapa_perubahan_sekaligus_menghasilkan_beberapa_baris(): void
    {
        $aset = $this->aset(['kondisi' => 'B']);
        $room = Room::factory()->create();
        $pj = User::factory()->create();

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}", [
                'kondisi' => 'RR',
                'room_id' => $room->id,
                'penanggung_jawab_id' => $pj->id,
            ])
            ->assertOk();

        $this->assertDatabaseCount('asset_mutations', 3);
        $this->assertSame(
            ['kondisi', 'penanggung_jawab', 'penempatan'],
            AssetMutation::orderBy('jenis')->pluck('jenis')->all(),
        );
    }

    public function test_riwayat_menyimpan_nama_ruangan_bukan_id(): void
    {
        $aset = $this->aset(['room_id' => null]);
        $room = Room::factory()->create(['nama' => 'Laboratorium Kimia 1']);

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}/mutasi", ['room_id' => $room->id])
            ->assertOk();

        $riwayat = AssetMutation::where('jenis', 'penempatan')->firstOrFail();
        $this->assertSame('Laboratorium Kimia 1', $riwayat->nilai_baru);

        // Riwayat harus tetap terbaca walau ruangannya kelak dihapus.
        $room->delete();
        $this->assertSame('Laboratorium Kimia 1', $riwayat->fresh()->nilai_baru);
    }

    public function test_riwayat_dapat_dibaca_lewat_api(): void
    {
        $aset = $this->aset(['kondisi' => 'B']);
        $user = User::factory()->create();

        $this->actingAs($user)->patchJson("/api/assets/{$aset->id}", ['kondisi' => 'RR'])->assertOk();
        $this->actingAs($user)->patchJson("/api/assets/{$aset->id}", ['kondisi' => 'RB'])->assertOk();

        $this->actingAs($user)
            ->getJson("/api/assets/{$aset->id}/riwayat")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            // Terbaru lebih dahulu.
            ->assertJsonPath('data.0.ke', 'Rusak Berat')
            ->assertJsonPath('data.1.ke', 'Rusak Ringan')
            ->assertJsonPath('data.0.oleh.nama', $user->name);
    }

    // --- Mutasi ruangan ---------------------------------------------------

    public function test_mutasi_memindahkan_dan_mencatat(): void
    {
        $asal = Room::factory()->create(['nama' => 'Lab A']);
        $tujuan = Room::factory()->create(['nama' => 'Lab B']);
        $aset = $this->aset(['room_id' => $asal->id]);

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}/mutasi", [
                'room_id' => $tujuan->id,
                'catatan' => 'Penataan ulang laboratorium',
            ])
            ->assertOk();

        $this->assertSame($tujuan->id, $aset->fresh()->room_id);

        $riwayat = AssetMutation::where('jenis', 'penempatan')->firstOrFail();
        $this->assertSame('Lab A', $riwayat->nilai_lama);
        $this->assertSame('Lab B', $riwayat->nilai_baru);
        $this->assertSame('Penataan ulang laboratorium', $riwayat->catatan);
    }

    public function test_mutasi_ke_ruangan_yang_sama_ditolak(): void
    {
        $room = Room::factory()->create();
        $aset = $this->aset(['room_id' => $room->id]);

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}/mutasi", ['room_id' => $room->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('room_id');

        $this->assertDatabaseCount('asset_mutations', 0);
    }

    public function test_aset_dapat_ditarik_dari_ruangan(): void
    {
        $room = Room::factory()->create(['nama' => 'Lab A']);
        $aset = $this->aset(['room_id' => $room->id]);

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}/mutasi", ['room_id' => null, 'catatan' => 'Dibawa ke bengkel'])
            ->assertOk();

        $this->assertNull($aset->fresh()->room_id);
        $this->assertNull(AssetMutation::where('jenis', 'penempatan')->value('nilai_baru'));
    }

    public function test_mutasi_tanpa_menyertakan_ruangan_ditolak(): void
    {
        $aset = $this->aset(['room_id' => Room::factory()->create()->id]);

        // Tidak mengirim `room_id` sama sekali tidak boleh diartikan sebagai
        // "keluarkan dari ruangan".
        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}/mutasi", ['catatan' => 'lupa isi'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('room_id');
    }

    public function test_ruangan_tujuan_harus_ada(): void
    {
        $aset = $this->aset();

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/assets/{$aset->id}/mutasi", ['room_id' => 99999])
            ->assertStatus(422)
            ->assertJsonValidationErrors('room_id');
    }

    // --- Penghapusan ------------------------------------------------------

    public function test_penghapusan_bersifat_lunak(): void
    {
        $aset = $this->aset();

        $this->actingAs(User::factory()->create())
            ->deleteJson("/api/assets/{$aset->id}", ['alasan' => 'Penghapusan sesuai SK'])
            ->assertOk()
            ->assertJsonFragment(['pesan' => 'Aset dihapus. NUP '.$aset->nup_fmt.' tetap tertahan dan tidak dipakai ulang.']);

        $this->assertSoftDeleted('assets', ['id' => $aset->id]);
    }

    public function test_nup_tidak_dipakai_ulang_setelah_aset_dihapus(): void
    {
        $aset = $this->aset(['nup' => 5]);

        $this->actingAs(User::factory()->create())
            ->deleteJson("/api/assets/{$aset->id}")
            ->assertOk();

        // Baris yang tertinggal karena hapus lunak masih dilihat indeks unik,
        // sehingga identitas BMN yang sama tidak dapat lahir kembali.
        $this->expectException(QueryException::class);

        DB::table('assets')->insert([
            'kode_lokasi' => Satker::kodeLokasi(),
            'kode_barang' => '3.08.01.03.001',
            'nup' => 5,
            'kode_internal' => 'STU/BARU/0001',
            'nama' => 'Barang lain',
            'tgl_perolehan' => '2023-01-01',
            'nilai_perolehan' => 1_000_000,
            'kuantitas' => 1,
            'satuan' => 'Unit',
            'kondisi' => 'B',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_aset_terhapus_tidak_muncul_di_daftar(): void
    {
        $aset = $this->aset();
        $user = User::factory()->create();

        $this->actingAs($user)->deleteJson("/api/assets/{$aset->id}")->assertOk();

        $this->actingAs($user)->getJson('/api/assets')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_alasan_penghapusan_tercatat_di_riwayat(): void
    {
        $aset = $this->aset();

        $this->actingAs(User::factory()->create())
            ->deleteJson("/api/assets/{$aset->id}", ['alasan' => 'Rusak berat, SK penghapusan 12/2026'])
            ->assertOk();

        $riwayat = AssetMutation::where('asset_id', $aset->id)->firstOrFail();

        $this->assertSame('status_penggunaan', $riwayat->jenis);
        $this->assertSame('Dihapuskan', $riwayat->nilai_baru);
        $this->assertSame('Rusak berat, SK penghapusan 12/2026', $riwayat->catatan);
    }

    // --- Autentikasi ------------------------------------------------------

    public function test_tamu_tidak_boleh_mengubah_memindahkan_atau_menghapus(): void
    {
        $aset = $this->aset();

        $this->patchJson("/api/assets/{$aset->id}", ['nama' => 'X'])->assertUnauthorized();
        $this->patchJson("/api/assets/{$aset->id}/mutasi", ['room_id' => null])->assertUnauthorized();
        $this->deleteJson("/api/assets/{$aset->id}")->assertUnauthorized();
        $this->getJson("/api/assets/{$aset->id}/riwayat")->assertUnauthorized();

        $this->assertDatabaseHas('assets', ['id' => $aset->id, 'deleted_at' => null]);
    }
}
