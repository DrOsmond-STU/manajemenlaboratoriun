<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use App\Services\NupAllocator;
use App\Support\Satker;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pasangan dari BookingRaceConditionTest, untuk aturan yang berbeda.
 *
 * NUP kembar berarti dua barang berbeda memiliki identitas BMN yang sama, dan
 * itu baru ketahuan saat rekonsiliasi dengan SIMAK-BMN — jauh setelah datanya
 * telanjur dipakai. Uji ini memastikan dua pendaftaran bersamaan tidak bisa
 * mengklaim NUP yang sama, dan bahwa indeks unik tetap menjadi benteng
 * terakhir bila ada kode yang memberi nomor dengan cara lain.
 */
class NupRaceConditionTest extends TestCase
{
    use RefreshDatabase;

    public function test_dua_pendaftaran_bersamaan_tidak_mendapat_nup_kembar(): void
    {
        $kode = '3.08.01.03.001';
        BmnKodeBarang::factory()->kode($kode)->create();
        $lokasi = Satker::kodeLokasi();

        // Uji ini butuh dua transaksi sungguhan, sementara RefreshDatabase
        // membungkus uji dalam satu transaksi. Datanya di-commit lebih dulu.
        DB::commit();
        DB::beginTransaction();

        config([
            'database.connections.uji_nup_a' => config('database.connections.pgsql'),
            'database.connections.uji_nup_b' => config('database.connections.pgsql'),
        ]);

        $a = DB::connection('uji_nup_a');
        $b = DB::connection('uji_nup_b');

        $klaim = fn ($koneksi) => (int) $koneksi->selectOne('
            INSERT INTO bmn_nup_counters (kode_lokasi, kode_barang, nup_terakhir, created_at, updated_at)
            VALUES (?, ?, 1, now(), now())
            ON CONFLICT (kode_lokasi, kode_barang)
            DO UPDATE SET nup_terakhir = bmn_nup_counters.nup_terakhir + 1, updated_at = now()
            RETURNING nup_terakhir
        ', [$lokasi, $kode])->nup_terakhir;

        // A mengklaim lebih dulu tetapi belum commit.
        $a->beginTransaction();
        $nupA = $klaim($a);

        // B memakai koneksi terpisah. Tanpa pernyataan atomik, B akan membaca
        // nilai basi dan mengklaim nomor yang sama.
        $b->statement("SET lock_timeout = '5s'");
        $b->beginTransaction();

        $a->commit();          // A selesai; kunci baris pencatat dilepas.
        $nupB = $klaim($b);
        $b->commit();

        $this->assertSame(1, $nupA);
        $this->assertSame(2, $nupB, "NUP kedua harus 2, bukan {$nupB} — pencatat membaca nilai basi.");

        $a->table('bmn_nup_counters')->where('kode_lokasi', $lokasi)->delete();
        $a->table('bmn_kode_barang')->where('kode', $kode)->delete();
    }

    public function test_identitas_bmn_kembar_ditolak_basis_data(): void
    {
        $kode = '3.08.01.03.001';
        BmnKodeBarang::factory()->kode($kode)->create();

        $baris = fn (string $kodeInternal) => [
            'kode_lokasi' => Satker::kodeLokasi(),
            'kode_barang' => $kode,
            'nup' => 7,                       // ← NUP yang sama, disengaja
            'kode_internal' => $kodeInternal,
            'nama' => 'Alat uji',
            'tgl_perolehan' => '2022-01-01',
            'nilai_perolehan' => 1_000_000,
            'kuantitas' => 1,
            'satuan' => 'Unit',
            'kondisi' => 'B',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        DB::table('assets')->insert($baris('STU/A/0001'));

        $this->expectException(QueryException::class);

        // Kode internal berbeda, jadi yang menolak pastilah indeks identitas BMN.
        DB::table('assets')->insert($baris('STU/B/0002'));
    }

    public function test_penyelarasan_nup_setelah_impor_data_lama(): void
    {
        $kode = '3.08.01.03.001';
        BmnKodeBarang::factory()->kode($kode)->create();
        $lokasi = Satker::kodeLokasi();

        // Impor massal menulis aset langsung, tanpa melewati pemberi nomor —
        // sehingga pencatat tertinggal di nol.
        Asset::factory()->kodeBarang($kode)->nup(41)->create();

        $allocator = app(NupAllocator::class);

        $this->assertSame(41, $allocator->selaraskan($lokasi, $kode));
        $this->assertSame(42, $allocator->berikutnya($lokasi, $kode),
            'Setelah diselaraskan, nomor berikutnya harus melanjutkan data impor.');
    }
}
