<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Rental;
use App\Models\Room;
use App\Models\Tariff;
use App\Services\PenagihanService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Penyewaan dan penagihan.
 *
 * Modul uang. Tiga aturan yang dijaga paling keras, ketiganya karena
 * kesalahannya berujung pada angka yang harus dipertanggungjawabkan ke bagian
 * keuangan:
 *
 *   1. Tagihan yang sudah terbit tidak berubah walau tarifnya naik.
 *   2. Pembayaran tidak boleh melebihi tagihan.
 *   3. Status tagihan selalu dihitung ulang, tidak pernah ditebak.
 */
class PenyewaanPenagihanTest extends TestCase
{
    use RefreshDatabase;

    private function sewa(array $ganti = []): Rental
    {
        return Rental::factory()->create($ganti);
    }

    private function tarif(Room $room, int $harga, string $satuan = 'jam'): Tariff
    {
        return Tariff::create([
            'nama' => 'Sewa '.$room->nama,
            'room_id' => $room->id,
            'satuan_waktu' => $satuan,
            'harga' => $harga,
            'segmen' => 'umum',
            'aktif' => true,
        ]);
    }

    // --- Penerbitan tagihan ---------------------------------------------------

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/tagihan')->assertUnauthorized();
    }

    public function test_tagihan_terbit_dari_tarif_yang_berlaku(): void
    {
        $room = Room::factory()->create(['nama' => 'Auditorium']);
        $this->tarif($room, 500_000, 'jam');

        $sewa = $this->sewa([
            'room_id' => $room->id,
            'mulai' => now()->addDay()->setTime(8, 0),
            'selesai' => now()->addDay()->setTime(12, 0),   // 4 jam
        ]);

        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/penyewaan/{$sewa->id}/tagihan", ['ppn_persen' => 11])
            ->assertCreated()
            ->assertJsonPath('data.nilai.subtotal', 2_000_000)
            ->assertJsonPath('data.nilai.ppn', 220_000)
            ->assertJsonPath('data.nilai.total', 2_220_000)
            ->assertJsonPath('data.nilai.sisa', 2_220_000);
    }

    public function test_nomor_tagihan_berurut_dan_unik(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 100_000);
        $finance = $this->penggunaBerperan('finance');

        $nomor = [];
        foreach (range(1, 3) as $i) {
            $sewa = $this->sewa(['room_id' => $room->id]);
            $nomor[] = $this->actingAs($finance)
                ->postJson("/api/penyewaan/{$sewa->id}/tagihan")
                ->assertCreated()->json('data.nomor');
        }

        $this->assertSame($nomor, array_unique($nomor));
        $this->assertStringContainsString('INV/'.now()->year.'/', $nomor[0]);
        $this->assertStringEndsWith('00003', $nomor[2]);
    }

    public function test_tagihan_tanpa_tarif_dan_tanpa_baris_ditolak(): void
    {
        $sewa = $this->sewa(['room_id' => Room::factory()->create()->id]);

        // Tagihan bernilai nol hanya menimbulkan kebingungan saat ditagihkan.
        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/penyewaan/{$sewa->id}/tagihan")
            ->assertStatus(422)
            ->assertJsonValidationErrors('rental_id');
    }

    public function test_baris_tambahan_dapat_disertakan(): void
    {
        $sewa = $this->sewa(['room_id' => Room::factory()->create()->id]);

        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/penyewaan/{$sewa->id}/tagihan", [
                'baris' => [
                    ['deskripsi' => 'Sewa auditorium', 'kuantitas' => 1, 'satuan' => 'paket', 'harga_satuan' => 3_000_000],
                    ['deskripsi' => 'Konsumsi', 'kuantitas' => 50, 'satuan' => 'orang', 'harga_satuan' => 35_000],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.nilai.subtotal', 4_750_000);
    }

    public function test_penyewaan_dibatalkan_tidak_dapat_ditagihkan(): void
    {
        $sewa = $this->sewa(['status' => 'dibatalkan']);

        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/penyewaan/{$sewa->id}/tagihan", [
                'baris' => [['deskripsi' => 'x', 'kuantitas' => 1, 'harga_satuan' => 1000]],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('rental_id');
    }

    // --- Tagihan adalah cuplikan ------------------------------------------------

    public function test_kenaikan_tarif_tidak_mengubah_tagihan_yang_sudah_terbit(): void
    {
        $room = Room::factory()->create();
        $tarif = $this->tarif($room, 500_000, 'jam');

        $sewa = $this->sewa([
            'room_id' => $room->id,
            'mulai' => now()->addDay()->setTime(8, 0),
            'selesai' => now()->addDay()->setTime(10, 0),   // 2 jam
        ]);

        $id = $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/penyewaan/{$sewa->id}/tagihan")
            ->assertCreated()->json('data.id');

        // Tarif naik dua kali lipat setelah tagihan terbit.
        $tarif->update(['harga' => 1_000_000]);

        // Tagihan yang sudah terbit tidak boleh ikut berubah.
        $this->assertSame(1_000_000, Invoice::find($id)->total());
    }

    public function test_subtotal_baris_dihitung_basis_data(): void
    {
        $sewa = $this->sewa();

        $tagihan = $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/penyewaan/{$sewa->id}/tagihan", [
                'baris' => [['deskripsi' => 'Sewa', 'kuantitas' => 7, 'harga_satuan' => 250_000]],
            ])->assertCreated();

        // Kolom GENERATED — mustahil menyimpang dari kuantitas × harga.
        $this->assertSame(1_750_000, (int) DB::table('invoice_lines')->value('subtotal'));
    }

    // --- Pembayaran ---------------------------------------------------------------

    private function tagihanRp(int $jumlah): Invoice
    {
        $sewa = $this->sewa();

        $id = $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/penyewaan/{$sewa->id}/tagihan", [
                'baris' => [['deskripsi' => 'Sewa', 'kuantitas' => 1, 'harga_satuan' => $jumlah]],
            ])->assertCreated()->json('data.id');

        return Invoice::findOrFail($id);
    }

    public function test_pembayaran_penuh_melunaskan(): void
    {
        $tagihan = $this->tagihanRp(1_000_000);

        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/tagihan/{$tagihan->id}/pembayaran", [
                'tanggal' => now()->toDateString(),
                'jumlah' => 1_000_000,
                'metode' => 'transfer',
            ])
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'lunas')
            ->assertJsonPath('data.nilai.sisa', 0);
    }

    public function test_pembayaran_sebagian_menandai_sebagian(): void
    {
        $tagihan = $this->tagihanRp(1_000_000);

        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/tagihan/{$tagihan->id}/pembayaran", [
                'tanggal' => now()->toDateString(), 'jumlah' => 400_000,
            ])
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'sebagian')
            ->assertJsonPath('data.nilai.sisa', 600_000);
    }

    public function test_pembayaran_melebihi_tagihan_ditolak(): void
    {
        $tagihan = $this->tagihanRp(1_000_000);

        // Kelebihan bayar menghasilkan kewajiban mengembalikan uang yang tidak
        // tercatat di mana pun.
        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/tagihan/{$tagihan->id}/pembayaran", [
                'tanggal' => now()->toDateString(), 'jumlah' => 1_500_000,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('jumlah');

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_akumulasi_pembayaran_yang_melebihi_juga_ditolak(): void
    {
        $tagihan = $this->tagihanRp(1_000_000);
        $finance = $this->penggunaBerperan('finance');

        foreach ([600_000, 300_000] as $jumlah) {
            $this->actingAs($finance)->postJson("/api/tagihan/{$tagihan->id}/pembayaran", [
                'tanggal' => now()->toDateString(), 'jumlah' => $jumlah,
            ])->assertOk();
        }

        // Sisa 100.000, dibayar 200.000 — ditolak.
        $this->actingAs($finance)->postJson("/api/tagihan/{$tagihan->id}/pembayaran", [
            'tanggal' => now()->toDateString(), 'jumlah' => 200_000,
        ])->assertStatus(422)->assertJsonValidationErrors('jumlah');

        $this->assertSame(900_000, $tagihan->fresh()->terbayar());
    }

    public function test_kelebihan_bayar_ditolak_pemicu_basis_data(): void
    {
        $tagihan = $this->tagihanRp(1_000_000);

        // Menembus lapisan aplikasi sepenuhnya.
        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/payments_melebihi_tagihan/');

        DB::table('payments')->insert([
            'invoice_id' => $tagihan->id, 'tanggal' => now()->toDateString(),
            'jumlah' => 5_000_000, 'metode' => 'tunai',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_pembayaran_negatif_ditolak(): void
    {
        $tagihan = $this->tagihanRp(1_000_000);

        // Koreksi dilakukan lewat baris pembatalan yang tercatat, bukan angka
        // minus yang menghilangkan jejaknya.
        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson("/api/tagihan/{$tagihan->id}/pembayaran", [
                'tanggal' => now()->toDateString(), 'jumlah' => -50_000,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('jumlah');
    }

    public function test_status_dihitung_ulang_bukan_ditebak(): void
    {
        $tagihan = $this->tagihanRp(1_000_000);
        $finance = $this->penggunaBerperan('finance');

        $this->actingAs($finance)->postJson("/api/tagihan/{$tagihan->id}/pembayaran", [
            'tanggal' => now()->toDateString(), 'jumlah' => 1_000_000,
        ])->assertOk();

        $this->assertSame('lunas', $tagihan->fresh()->status);

        // Pembayaran dihapus — status harus ikut mundur, bukan tetap "lunas"
        // padahal uangnya tidak pernah masuk.
        Payment::where('invoice_id', $tagihan->id)->delete();

        $segar = app(PenagihanService::class)->segarkanStatus($tagihan);

        $this->assertSame('terbit', $segar->status);
        $this->assertSame(1_000_000, $segar->sisa());
    }

    // --- Jatuh tempo -------------------------------------------------------------------

    public function test_tagihan_terlewat_jatuh_tempo_dapat_ditapis(): void
    {
        $tagihan = $this->tagihanRp(1_000_000);

        // Tagihan yang terlewat adalah tagihan LAMA yang jatuh temponya juga
        // sudah lewat. Memundurkan jatuh temponya saja ditolak batasan
        // `jatuh_tempo >= tanggal` — dan memang seharusnya begitu.
        $tagihan->update([
            'tanggal' => now()->subMonth()->toDateString(),
            'jatuh_tempo' => now()->subWeek()->toDateString(),
        ]);

        $data = $this->actingAs($this->penggunaBerperan('finance'))
            ->getJson('/api/tagihan?terlewat=1')->assertOk()->json('data');

        $this->assertCount(1, $data);
        $this->assertTrue($data[0]['terlewat_jatuh_tempo']);
    }

    // --- Otorisasi ----------------------------------------------------------------------

    public function test_finance_memegang_modul_ini(): void
    {
        $sewa = $this->sewa();
        $finance = $this->penggunaBerperan('finance');

        $this->actingAs($finance)->getJson('/api/tagihan')->assertOk();
        $this->actingAs($finance)->postJson("/api/penyewaan/{$sewa->id}/tagihan", [
            'baris' => [['deskripsi' => 'x', 'kuantitas' => 1, 'harga_satuan' => 1000]],
        ])->assertCreated();
    }

    public function test_lab_manager_tidak_boleh_menyentuh_penagihan(): void
    {
        // Matriks: lab-manager pada penyewaan adalah '—'.
        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->getJson('/api/tagihan')->assertForbidden();
    }

    public function test_facility_manager_boleh_melihat_tetapi_bukan_pemegang(): void
    {
        // Matriks: facility-manager pada penyewaan adalah UBAH.
        $fm = $this->penggunaBerperan('facility-manager');

        $this->actingAs($fm)->getJson('/api/tagihan')->assertOk();
    }
}
