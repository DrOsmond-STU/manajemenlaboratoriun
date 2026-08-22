<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetMutation;
use App\Models\BmnKodeBarang;
use App\Models\EquipmentLoan;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Peminjaman alat.
 *
 * Aturan intinya sama dengan pemesanan ruangan — satu benda tidak boleh
 * dipakai dua pihak bersamaan — sehingga uji anti-bentroknya pun sepadan.
 * Yang khas modul ini adalah KONDISI alat: barang rusak berat tidak boleh
 * berpindah tangan, dan kondisinya diperiksa ulang saat serah terima karena
 * dapat berubah setelah pengajuan dibuat.
 */
class PeminjamanAlatTest extends TestCase
{
    use RefreshDatabase;

    private function alat(array $ganti = []): Asset
    {
        BmnKodeBarang::firstOrCreate(
            ['kode' => '3.08.01.03.001'],
            ['uraian' => 'Alat uji', 'masa_manfaat' => 8],
        );

        return Asset::factory()->kodeBarang('3.08.01.03.001')->create($ganti);
    }

    /**
     * @return array<string,mixed>
     */
    private function isian(Asset $alat, array $ganti = []): array
    {
        return array_merge([
            'asset_id' => $alat->id,
            'keperluan' => 'Pengujian sampel air',
            'lokasi_pemakaian' => 'Lab Kimia',
            'mulai' => now()->addDay()->setTime(9, 0)->toIso8601String(),
            'selesai' => now()->addDay()->setTime(13, 0)->toIso8601String(),
        ], $ganti);
    }

    // --- Pengajuan ------------------------------------------------------------

    public function test_tamu_ditolak(): void
    {
        $this->postJson('/api/peminjaman', [])->assertUnauthorized();
    }

    public function test_dapat_mengajukan_peminjaman(): void
    {
        $alat = $this->alat(['nama' => 'Spektrofotometer']);

        $this->actingAs($this->penggunaBerperan('employee'))
            ->postJson('/api/peminjaman', $this->isian($alat))
            ->assertCreated()
            ->assertJsonPath('data.status.kode', 'menunggu')
            ->assertJsonPath('data.alat.nama', 'Spektrofotometer');
    }

    public function test_selesai_harus_setelah_mulai(): void
    {
        $alat = $this->alat();

        $this->actingAs($this->penggunaBerperan('employee'))
            ->postJson('/api/peminjaman', $this->isian($alat, [
                'selesai' => now()->addDay()->setTime(8, 0)->toIso8601String(),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('selesai');
    }

    // --- Anti-bentrok -----------------------------------------------------------

    public function test_peminjaman_tumpang_tindih_ditolak(): void
    {
        $alat = $this->alat();
        $pengguna = $this->penggunaBerperan('employee');

        $this->actingAs($pengguna)->postJson('/api/peminjaman', $this->isian($alat))->assertCreated();

        $this->actingAs($pengguna)
            ->postJson('/api/peminjaman', $this->isian($alat, [
                'mulai' => now()->addDay()->setTime(11, 0)->toIso8601String(),
                'selesai' => now()->addDay()->setTime(15, 0)->toIso8601String(),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('mulai');

        $this->assertDatabaseCount('equipment_loans', 1);
    }

    public function test_pemakaian_berurutan_diizinkan(): void
    {
        $alat = $this->alat();
        $pengguna = $this->penggunaBerperan('employee');

        $this->actingAs($pengguna)->postJson('/api/peminjaman', $this->isian($alat))->assertCreated();

        // 13:00–17:00 tepat setelah 09:00–13:00.
        $this->actingAs($pengguna)
            ->postJson('/api/peminjaman', $this->isian($alat, [
                'mulai' => now()->addDay()->setTime(13, 0)->toIso8601String(),
                'selesai' => now()->addDay()->setTime(17, 0)->toIso8601String(),
            ]))
            ->assertCreated();
    }

    public function test_alat_berbeda_pada_waktu_sama_diizinkan(): void
    {
        $a = $this->alat();
        $b = $this->alat();
        $pengguna = $this->penggunaBerperan('employee');

        $this->actingAs($pengguna)->postJson('/api/peminjaman', $this->isian($a))->assertCreated();
        $this->actingAs($pengguna)->postJson('/api/peminjaman', $this->isian($b))->assertCreated();
    }

    public function test_bentrok_ditolak_pemicu_basis_data(): void
    {
        $alat = $this->alat();
        $pemohon = User::factory()->create();

        $baris = fn (string $m, string $s) => [
            'asset_id' => $alat->id, 'user_id' => $pemohon->id,
            'keperluan' => 'x', 'mulai' => $m, 'selesai' => $s,
            'status' => 'menunggu', 'created_at' => now(), 'updated_at' => now(),
        ];

        DB::table('equipment_loans')->insert($baris('2027-03-01 09:00:00+07', '2027-03-01 13:00:00+07'));

        // Menembus lapisan aplikasi sepenuhnya.
        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/equipment_loans_no_overlap/');

        DB::table('equipment_loans')->insert($baris('2027-03-01 11:00:00+07', '2027-03-01 15:00:00+07'));
    }

    public function test_peminjaman_dikembalikan_membebaskan_slot(): void
    {
        $alat = $this->alat();
        $pemohon = User::factory()->create();

        // Alat yang sudah kembali lebih awal harus dapat langsung dipinjam
        // orang lain — menahannya sampai jadwal asli berakhir hanya membuat
        // alat menganggur.
        EquipmentLoan::factory()->create([
            'asset_id' => $alat->id, 'user_id' => $pemohon->id,
            'mulai' => now()->addDay()->setTime(9, 0),
            'selesai' => now()->addDay()->setTime(13, 0),
            'status' => 'dikembalikan',
        ]);

        $this->actingAs($this->penggunaBerperan('employee'))
            ->postJson('/api/peminjaman', $this->isian($alat))
            ->assertCreated();
    }

    // --- Kondisi alat -------------------------------------------------------------

    public function test_alat_rusak_berat_tidak_dapat_dipinjam(): void
    {
        $alat = $this->alat(['kondisi' => 'RB', 'nama' => 'Mikroskop Rusak']);

        $this->actingAs($this->penggunaBerperan('employee'))
            ->postJson('/api/peminjaman', $this->isian($alat))
            ->assertStatus(422)
            ->assertJsonValidationErrors('asset_id');

        $this->assertDatabaseCount('equipment_loans', 0);
    }

    public function test_alat_yang_rusak_setelah_pengajuan_tidak_boleh_diserahkan(): void
    {
        $alat = $this->alat(['kondisi' => 'B']);
        $pemohon = $this->penggunaBerperan('employee');

        $id = $this->actingAs($pemohon)
            ->postJson('/api/peminjaman', $this->isian($alat))
            ->assertCreated()->json('data.id');

        // Antara pengajuan dan pengambilan, alatnya rusak.
        $alat->update(['kondisi' => 'RB']);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/peminjaman/{$id}/serahkan")
            ->assertStatus(422)
            ->assertJsonValidationErrors('asset_id');
    }

    // --- Serah terima & pengembalian -------------------------------------------------

    public function test_serah_terima_mencatat_waktu_pengambilan(): void
    {
        $alat = $this->alat();
        $pinjaman = EquipmentLoan::factory()->create(['asset_id' => $alat->id]);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/peminjaman/{$pinjaman->id}/serahkan")
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'dipinjam');

        $this->assertNotNull($pinjaman->fresh()->diambil_pada);
    }

    public function test_tidak_dapat_menyerahkan_dua_kali(): void
    {
        $alat = $this->alat();
        $pinjaman = EquipmentLoan::factory()->create(['asset_id' => $alat->id, 'status' => 'dipinjam']);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/peminjaman/{$pinjaman->id}/serahkan")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_pengembalian_mencatat_waktu_dan_kondisi(): void
    {
        $alat = $this->alat(['kondisi' => 'B']);
        $pinjaman = EquipmentLoan::factory()->create(['asset_id' => $alat->id, 'status' => 'dipinjam']);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/peminjaman/{$pinjaman->id}/kembalikan", [
                'kondisi' => 'RR',
                'catatan' => 'Kabel daya sedikit terkelupas',
            ])
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'dikembalikan')
            ->assertJsonPath('data.kondisi_saat_kembali.nama', 'Rusak Ringan');

        $this->assertNotNull($pinjaman->fresh()->dikembalikan_pada);
    }

    public function test_kondisi_alat_ikut_diperbarui_beserta_riwayatnya(): void
    {
        $alat = $this->alat(['kondisi' => 'B']);
        $pinjaman = EquipmentLoan::factory()->create(['asset_id' => $alat->id, 'status' => 'dipinjam']);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/peminjaman/{$pinjaman->id}/kembalikan", ['kondisi' => 'RR'])
            ->assertOk();

        // Tanpa ini, alat yang rusak selama dipinjam tetap tercatat "Baik"
        // sampai ada yang kebetulan memeriksanya.
        $this->assertSame('RR', $alat->fresh()->kondisi);

        $riwayat = AssetMutation::where('asset_id', $alat->id)->where('jenis', 'kondisi')->firstOrFail();
        $this->assertSame('Baik', $riwayat->nilai_lama);
        $this->assertSame('Rusak Ringan', $riwayat->nilai_baru);
        $this->assertStringContainsString('pengembalian peminjaman', $riwayat->catatan);
    }

    public function test_pengembalian_tanpa_kondisi_tidak_mengubah_master(): void
    {
        $alat = $this->alat(['kondisi' => 'B']);
        $pinjaman = EquipmentLoan::factory()->create(['asset_id' => $alat->id, 'status' => 'dipinjam']);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/peminjaman/{$pinjaman->id}/kembalikan", [])
            ->assertOk();

        // Kondisi yang dikarang lebih berbahaya daripada kondisi yang belum diisi.
        $this->assertSame('B', $alat->fresh()->kondisi);
        $this->assertDatabaseCount('asset_mutations', 0);
    }

    public function test_hanya_yang_sedang_dipinjam_dapat_dikembalikan(): void
    {
        $alat = $this->alat();
        $pinjaman = EquipmentLoan::factory()->create(['asset_id' => $alat->id, 'status' => 'menunggu']);

        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson("/api/peminjaman/{$pinjaman->id}/kembalikan", ['kondisi' => 'B'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    // --- Keterlambatan --------------------------------------------------------------

    public function test_keterlambatan_terdeteksi_dan_dapat_ditapis(): void
    {
        $alat = $this->alat();
        $pemohon = User::factory()->create();

        EquipmentLoan::factory()->create([
            'asset_id' => $alat->id, 'user_id' => $pemohon->id,
            'mulai' => now()->subDays(3), 'selesai' => now()->subDay(),
            'status' => 'dipinjam',
        ]);

        $data = $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson('/api/peminjaman?terlambat=1')
            ->assertOk()->json('data');

        $this->assertCount(1, $data);
        $this->assertTrue($data[0]['terlambat']);
    }

    // --- Otorisasi -------------------------------------------------------------------

    public function test_employee_boleh_mengajukan_tetapi_tidak_menyerahkan(): void
    {
        $alat = $this->alat();
        $pemohon = $this->penggunaBerperan('employee');

        $id = $this->actingAs($pemohon)
            ->postJson('/api/peminjaman', $this->isian($alat))
            ->assertCreated()->json('data.id');

        // Peminjam tidak boleh menyerahkan alat kepada dirinya sendiri.
        $this->actingAs($pemohon)
            ->postJson("/api/peminjaman/{$id}/serahkan")
            ->assertForbidden();
    }

    public function test_finance_tidak_boleh_membaca_peminjaman(): void
    {
        // Matriks: finance pada modul booking-alat adalah '—'.
        $this->actingAs($this->penggunaBerperan('finance'))
            ->getJson('/api/peminjaman')
            ->assertForbidden();
    }

    public function test_unit_kerja_diambil_dari_pemohon(): void
    {
        $alat = $this->alat();
        $pemohon = $this->penggunaBerperan('employee', ['unit_kerja' => 'Lab Kimia']);

        $this->actingAs($pemohon)
            ->postJson('/api/peminjaman', $this->isian($alat, ['unit_kerja' => 'Direksi']))
            ->assertCreated();

        $this->assertSame('Lab Kimia', EquipmentLoan::first()->unit_kerja);
    }

    public function test_daftar_peminjaman_dapat_disaring_rentang_tanggal(): void
    {
        $pemohon = $this->penggunaBerperan('employee');

        EquipmentLoan::factory()->create([
            'asset_id' => $this->alat()->id, 'user_id' => $pemohon->id,
            'mulai' => '2026-09-05 09:00:00', 'selesai' => '2026-09-05 13:00:00',
        ]);
        EquipmentLoan::factory()->create([
            'asset_id' => $this->alat()->id, 'user_id' => $pemohon->id,
            'mulai' => '2026-10-05 09:00:00', 'selesai' => '2026-10-05 13:00:00',
        ]);

        // Dipakai Kalender Terpadu: satu bulan sekaligus.
        $this->actingAs($pemohon)
            ->getJson('/api/peminjaman?sejak=2026-09-01&sampai=2026-09-30')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
