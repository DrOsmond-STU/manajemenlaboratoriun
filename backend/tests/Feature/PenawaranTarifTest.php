<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Quotation;
use App\Models\Rental;
use App\Models\Room;
use App\Models\Tariff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tarif (tarif/add-on/paket dalam satu tabel), penawaran (quotation) sebagai
 * tahap sebelum tagihan, dan verifikasi pembayaran.
 *
 * Yang dijaga paling keras: penawaran yang sudah disetujui klien tidak
 * pernah diam-diam berubah harganya walau tarifnya naik setelahnya,
 * penawaran yang sudah final (disetujui/ditolak) atau kedaluwarsa tidak
 * dapat diputuskan ulang, dan pembayaran yang belum diverifikasi tidak
 * dihitung sebagai uang masuk.
 */
class PenawaranTarifTest extends TestCase
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
            'jenis' => 'tarif',
            'room_id' => $room->id,
            'satuan_waktu' => $satuan,
            'harga' => $harga,
            'segmen' => 'umum',
            'aktif' => true,
        ]);
    }

    // --- Tarif / add-on / paket ------------------------------------------------

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/tarif')->assertUnauthorized();
        $this->getJson('/api/penawaran')->assertUnauthorized();
    }

    public function test_tarif_addon_dan_paket_satu_daftar_ditapis_jenis(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 500_000);
        Tariff::create(['nama' => 'Operator AV', 'jenis' => 'addon', 'satuan_waktu' => 'paket', 'harga' => 500_000, 'segmen' => 'umum']);
        Tariff::create(['nama' => 'Paket Seminar', 'jenis' => 'paket', 'satuan_waktu' => 'paket', 'harga' => 5_000_000, 'segmen' => 'umum', 'deskripsi' => 'Ruang + konsumsi', 'kapasitas' => 100]);

        $finance = $this->penggunaBerperan('finance');

        $this->actingAs($finance)->getJson('/api/tarif?jenis=addon')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'Operator AV');

        $paket = $this->actingAs($finance)->getJson('/api/tarif?jenis=paket')
            ->assertOk()->assertJsonCount(1, 'data')->json('data.0');
        $this->assertSame('Ruang + konsumsi', $paket['deskripsi']);
        $this->assertSame(100, $paket['kapasitas']);
    }

    public function test_tarif_nonaktif_disembunyikan_kecuali_diminta(): void
    {
        $room = Room::factory()->create();
        $aktif = $this->tarif($room, 500_000);
        $aktif->update(['aktif' => false]);

        $finance = $this->penggunaBerperan('finance');
        $this->actingAs($finance)->getJson('/api/tarif')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($finance)->getJson('/api/tarif?sertakan_nonaktif=1')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_lab_manager_tidak_boleh_menambah_tarif(): void
    {
        $this->actingAs($this->penggunaBerperan('lab-manager'))
            ->postJson('/api/tarif', ['nama' => 'x', 'jenis' => 'addon', 'satuan_waktu' => 'paket', 'harga' => 1000, 'segmen' => 'umum'])
            ->assertForbidden();
    }

    // --- Penawaran (quotation) --------------------------------------------------

    public function test_penawaran_terbit_dari_tarif_yang_berlaku(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 500_000, 'jam');
        $sewa = $this->sewa([
            'room_id' => $room->id,
            'mulai' => now()->addDay()->setTime(8, 0),
            'selesai' => now()->addDay()->setTime(12, 0),
        ]);

        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson('/api/penawaran', ['rental_id' => $sewa->id, 'ppn_persen' => 11])
            ->assertCreated()
            ->assertJsonPath('data.status.kode', 'terkirim')
            ->assertJsonPath('data.nilai.subtotal', 2_000_000)
            ->assertJsonPath('data.nilai.total', 2_220_000);
    }

    public function test_penawaran_tanpa_baris_ditolak(): void
    {
        $sewa = $this->sewa(['room_id' => Room::factory()->create()->id]);

        $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson('/api/penawaran', ['rental_id' => $sewa->id])
            ->assertStatus(422)->assertJsonValidationErrors('rental_id');
    }

    public function test_nomor_penawaran_berurut_dan_unik(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 100_000);
        $finance = $this->penggunaBerperan('finance');

        $nomor = [];
        foreach (range(1, 3) as $i) {
            $sewa = $this->sewa(['room_id' => $room->id]);
            $nomor[] = $this->actingAs($finance)
                ->postJson('/api/penawaran', ['rental_id' => $sewa->id])
                ->assertCreated()->json('data.nomor');
        }

        $this->assertSame($nomor, array_unique($nomor));
        $this->assertStringContainsString('QUO/'.now()->year.'/', $nomor[0]);
    }

    public function test_penawaran_kedaluwarsa_dihitung_bukan_disimpan(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 100_000);
        $sewa = $this->sewa(['room_id' => $room->id]);

        $id = $this->actingAs($this->penggunaBerperan('finance'))
            ->postJson('/api/penawaran', ['rental_id' => $sewa->id, 'berlaku_hari' => 1])
            ->assertCreated()->json('data.id');

        $penawaran = Quotation::findOrFail($id);
        $penawaran->update(['tanggal' => now()->subDays(5)->toDateString(), 'berlaku_sampai' => now()->subDay()->toDateString()]);

        $data = $this->actingAs($this->penggunaBerperan('finance'))
            ->getJson("/api/penawaran/{$id}")->assertOk()->json('data');

        // Status tersimpannya tetap "terkirim" — kedaluwarsa murni fakta tanggal.
        $this->assertSame('terkirim', $data['status']['kode']);
        $this->assertTrue($data['kedaluwarsa']);
    }

    public function test_penawaran_kedaluwarsa_tidak_dapat_diputuskan(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 100_000);
        $sewa = $this->sewa(['room_id' => $room->id]);
        $finance = $this->penggunaBerperan('finance');

        $id = $this->actingAs($finance)->postJson('/api/penawaran', ['rental_id' => $sewa->id])
            ->assertCreated()->json('data.id');
        Quotation::findOrFail($id)->update(['tanggal' => now()->subDays(5)->toDateString(), 'berlaku_sampai' => now()->subDay()->toDateString()]);

        $this->actingAs($finance)->postJson("/api/penawaran/{$id}/putuskan", ['keputusan' => 'disetujui'])
            ->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_penawaran_final_tidak_dapat_diputuskan_ulang(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 100_000);
        $sewa = $this->sewa(['room_id' => $room->id]);
        $finance = $this->penggunaBerperan('finance');

        $id = $this->actingAs($finance)->postJson('/api/penawaran', ['rental_id' => $sewa->id])
            ->assertCreated()->json('data.id');
        $this->actingAs($finance)->postJson("/api/penawaran/{$id}/putuskan", ['keputusan' => 'ditolak'])->assertOk();

        $this->actingAs($finance)->postJson("/api/penawaran/{$id}/putuskan", ['keputusan' => 'disetujui'])
            ->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_penawaran_disetujui_dapat_diterbitkan_invoice(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 500_000, 'jam');
        $sewa = $this->sewa([
            'room_id' => $room->id,
            'mulai' => now()->addDay()->setTime(8, 0),
            'selesai' => now()->addDay()->setTime(10, 0),
        ]);
        $finance = $this->penggunaBerperan('finance');

        $id = $this->actingAs($finance)->postJson('/api/penawaran', ['rental_id' => $sewa->id, 'ppn_persen' => 11])
            ->assertCreated()->json('data.id');
        $this->actingAs($finance)->postJson("/api/penawaran/{$id}/putuskan", ['keputusan' => 'disetujui'])->assertOk();

        // Tarif naik SETELAH disetujui — tidak boleh ikut mengubah invoice.
        Tariff::first()->update(['harga' => 999_999_999]);

        $invoice = $this->actingAs($finance)->postJson("/api/penawaran/{$id}/tagihan")
            ->assertCreated()
            ->assertJsonPath('data.nilai.subtotal', 1_000_000)
            ->assertJsonPath('data.quotation_nomor', Quotation::findOrFail($id)->nomor)
            ->json('data');

        $this->assertSame($id, Invoice::findOrFail($invoice['id'])->quotation_id);
    }

    public function test_penawaran_belum_disetujui_tidak_dapat_diterbitkan_invoice(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 500_000);
        $sewa = $this->sewa(['room_id' => $room->id]);
        $finance = $this->penggunaBerperan('finance');

        $id = $this->actingAs($finance)->postJson('/api/penawaran', ['rental_id' => $sewa->id])
            ->assertCreated()->json('data.id');

        $this->actingAs($finance)->postJson("/api/penawaran/{$id}/tagihan")
            ->assertStatus(422)->assertJsonValidationErrors('quotation_id');
    }

    public function test_penawaran_tidak_dapat_diterbitkan_invoice_dua_kali(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 500_000);
        $sewa = $this->sewa(['room_id' => $room->id]);
        $finance = $this->penggunaBerperan('finance');

        $id = $this->actingAs($finance)->postJson('/api/penawaran', ['rental_id' => $sewa->id])
            ->assertCreated()->json('data.id');
        $this->actingAs($finance)->postJson("/api/penawaran/{$id}/putuskan", ['keputusan' => 'disetujui'])->assertOk();
        $this->actingAs($finance)->postJson("/api/penawaran/{$id}/tagihan")->assertCreated();

        $this->actingAs($finance)->postJson("/api/penawaran/{$id}/tagihan")
            ->assertStatus(422)->assertJsonValidationErrors('quotation_id');
    }

    // --- Verifikasi pembayaran --------------------------------------------------

    public function test_pembayaran_bawaan_langsung_terverifikasi(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 1_000_000, 'paket');
        $sewa = $this->sewa(['room_id' => $room->id]);
        $finance = $this->penggunaBerperan('finance');

        $tagihan = $this->actingAs($finance)->postJson("/api/penyewaan/{$sewa->id}/tagihan")
            ->assertCreated()->json('data.id');

        $this->actingAs($finance)->postJson("/api/tagihan/{$tagihan}/pembayaran", [
            'tanggal' => now()->toDateString(), 'jumlah' => 1_000_000,
        ])->assertOk()->assertJsonPath('data.pembayaran.0.status.kode', 'terverifikasi');
    }

    public function test_pembayaran_menunggu_verifikasi_belum_dihitung_lunas(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 1_000_000, 'paket');
        $sewa = $this->sewa(['room_id' => $room->id]);
        $finance = $this->penggunaBerperan('finance');

        $tagihan = $this->actingAs($finance)->postJson("/api/penyewaan/{$sewa->id}/tagihan")
            ->assertCreated()->json('data.id');

        $this->actingAs($finance)->postJson("/api/tagihan/{$tagihan}/pembayaran", [
            'tanggal' => now()->toDateString(), 'jumlah' => 1_000_000, 'status' => 'menunggu_verifikasi',
        ])
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'terbit')   // belum "lunas"
            ->assertJsonPath('data.nilai.sisa', 1_000_000);
    }

    public function test_verifikasi_pembayaran_baru_menghitungnya_sebagai_lunas(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 1_000_000, 'paket');
        $sewa = $this->sewa(['room_id' => $room->id]);
        $finance = $this->penggunaBerperan('finance');

        $tagihan = $this->actingAs($finance)->postJson("/api/penyewaan/{$sewa->id}/tagihan")
            ->assertCreated()->json('data.id');
        $this->actingAs($finance)->postJson("/api/tagihan/{$tagihan}/pembayaran", [
            'tanggal' => now()->toDateString(), 'jumlah' => 1_000_000, 'status' => 'menunggu_verifikasi',
        ])->assertOk();

        $pembayaran = Payment::where('invoice_id', $tagihan)->firstOrFail();

        $this->actingAs($finance)->postJson("/api/pembayaran/{$pembayaran->id}/verifikasi")
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'lunas')
            ->assertJsonPath('data.nilai.sisa', 0);
    }

    public function test_daftar_pembayaran_lintas_tagihan(): void
    {
        $room = Room::factory()->create();
        $this->tarif($room, 1_000_000, 'paket');
        $sewa = $this->sewa(['room_id' => $room->id]);
        $finance = $this->penggunaBerperan('finance');

        $tagihan = $this->actingAs($finance)->postJson("/api/penyewaan/{$sewa->id}/tagihan")
            ->assertCreated()->json('data.id');
        $this->actingAs($finance)->postJson("/api/tagihan/{$tagihan}/pembayaran", [
            'tanggal' => now()->toDateString(), 'jumlah' => 400_000, 'status' => 'menunggu_verifikasi',
        ])->assertOk();

        $this->actingAs($finance)->getJson('/api/pembayaran?status=menunggu_verifikasi')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.invoice.penyewa', $sewa->penyewa);
    }
}
