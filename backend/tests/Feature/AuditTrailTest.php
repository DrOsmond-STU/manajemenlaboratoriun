<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AuditLog;
use App\Models\BmnKodeBarang;
use App\Models\Tariff;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuditTrailTest extends TestCase
{
    use RefreshDatabase;

    // --- Yang dituntut SECURITY.md §4.3 -------------------------------------

    public function test_perubahan_tarif_menghasilkan_entri_berisi_nilai_sebelum_dan_sesudah(): void
    {
        $petugas = $this->penggunaBerperan('finance');
        $tarif = Tariff::create([
            'nama' => 'Sewa Lab Kimia', 'satuan_waktu' => 'jam',
            'harga' => 150_000, 'segmen' => 'umum', 'aktif' => true,
        ]);

        $this->actingAs($petugas);
        $tarif->update(['harga' => 200_000]);

        $entri = AuditLog::untukModel('Tariff', $tarif->id)->where('peristiwa', 'diubah')->sole();

        $this->assertSame(150_000, $entri->sebelum['harga']);
        $this->assertSame(200_000, $entri->sesudah['harga']);
        $this->assertSame($petugas->id, $entri->user_id);
        $this->assertSame($petugas->name, $entri->nama_pelaku);
    }

    public function test_perubahan_nilai_aset_tercatat(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $aset = Asset::factory()->kodeBarang('3.08.01.03.001')->create([
            'nama' => 'HPLC Shimadzu', 'nilai_perolehan' => 850_000_000,
        ]);

        $this->actingAs($this->penggunaBerperan('asset-manager'));
        $aset->update(['nilai_perolehan' => 900_000_000, 'keterangan' => 'koreksi ketik']);

        $entri = AuditLog::untukModel('Asset', $aset->id)->where('peristiwa', 'diubah')->sole();

        $this->assertSame(850_000_000, $entri->sebelum['nilai_perolehan']);
        $this->assertSame(900_000_000, $entri->sesudah['nilai_perolehan']);
        $this->assertSame('HPLC Shimadzu', $entri->label, 'Barisnya harus terbaca tanpa membuka asetnya.');

        // `keterangan` tidak termasuk kolom yang diaudit, jadi tidak boleh
        // ikut terbawa — jejak audit aset adalah tentang uang dan status,
        // bukan tentang catatan bebas.
        $this->assertArrayNotHasKey('keterangan', $entri->sesudah);
    }

    public function test_perubahan_kolom_aset_yang_tidak_diaudit_tidak_membuat_entri(): void
    {
        BmnKodeBarang::factory()->kode('3.08.01.03.001')->create();
        $aset = Asset::factory()->kodeBarang('3.08.01.03.001')->create();

        $this->actingAs($this->penggunaBerperan('asset-manager'));
        $aset->update(['keterangan' => 'dipindah sementara ke gudang']);

        $this->assertSame(
            0,
            AuditLog::untukModel('Asset', $aset->id)->where('peristiwa', 'diubah')->count(),
            'Entri "diubah" tanpa menyebut apa yang berubah hanya memenuhi jejak audit dengan derau.'
        );
    }

    public function test_pemberian_peran_tercatat(): void
    {
        $admin = $this->penggunaBerperan('super-admin');
        $sasaran = User::factory()->create(['name' => 'Budi Santoso']);

        $this->actingAs($admin);
        $sasaran->assignRole('finance');

        $entri = AuditLog::untukModel('User', $sasaran->id)
            ->whereNotNull('sesudah')->latest('id')->first();

        $this->assertNotNull($entri, 'Perubahan hak akses wajib meninggalkan jejak.');
        $this->assertSame(['finance'], $entri->sesudah['peran']);
        $this->assertNull($entri->sebelum, 'Peran yang diberikan masuk sisi "sesudah".');
        $this->assertSame($admin->id, $entri->user_id);
        $this->assertSame('Budi Santoso', $entri->label);
    }

    public function test_pencabutan_peran_tercatat_pada_sisi_sebelum(): void
    {
        $admin = $this->penggunaBerperan('super-admin');
        $sasaran = $this->penggunaBerperan('finance');

        $this->actingAs($admin);
        $sasaran->removeRole('finance');

        $entri = AuditLog::untukModel('User', $sasaran->id)
            ->whereNotNull('sebelum')->latest('id')->first();

        $this->assertNotNull($entri);
        $this->assertSame(['finance'], $entri->sebelum['peran']);
        $this->assertNull($entri->sesudah, 'Peran yang dicabut masuk sisi "sebelum".');
    }

    // --- Sifat yang membuatnya berarti --------------------------------------

    public function test_jejak_audit_tidak_dapat_diubah_walau_lewat_basis_data(): void
    {
        $tarif = Tariff::create([
            'nama' => 'Sewa Aula', 'satuan_waktu' => 'hari',
            'harga' => 1_000_000, 'segmen' => 'umum', 'aktif' => true,
        ]);

        $id = AuditLog::untukModel('Tariff', $tarif->id)->sole()->id;

        // Menembus lapis aplikasi dengan sengaja: bila jaminannya hanya
        // "tidak ada endpoint-nya", pengujian lewat Eloquent akan lulus
        // sementara siapa pun berkredensial basis data tetap bisa menyunting.
        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/audit_logs_hanya_tambah/');

        DB::table('audit_logs')->where('id', $id)->update(['nama_pelaku' => 'orang lain']);
    }

    public function test_jejak_audit_tidak_dapat_dihapus_walau_lewat_basis_data(): void
    {
        $tarif = Tariff::create([
            'nama' => 'Sewa Aula', 'satuan_waktu' => 'hari',
            'harga' => 1_000_000, 'segmen' => 'umum', 'aktif' => true,
        ]);

        $id = AuditLog::untukModel('Tariff', $tarif->id)->sole()->id;

        $this->expectException(QueryException::class);
        $this->expectExceptionMessageMatches('/audit_logs_hanya_tambah/');

        DB::table('audit_logs')->where('id', $id)->delete();
    }

    public function test_sandi_tidak_pernah_masuk_jejak_audit(): void
    {
        $pengguna = User::factory()->create();

        $this->actingAs($this->penggunaBerperan('super-admin'));
        $pengguna->update(['password' => 'RahasiaSekali12345']);

        $entri = AuditLog::untukModel('User', $pengguna->id)
            ->where('peristiwa', 'diubah')->latest('id')->sole();

        // Peristiwanya tercatat...
        $this->assertArrayHasKey('password', $entri->sesudah);

        // ...tetapi nilainya, bahkan yang sudah di-hash, tidak.
        $this->assertSame('[disamarkan]', $entri->sesudah['password']);
        $this->assertSame('[disamarkan]', $entri->sebelum['password']);

        $mentah = DB::table('audit_logs')->where('id', $entri->id)->value('sesudah');
        $this->assertStringNotContainsString('$2y$', $mentah, 'Hash sandi tidak boleh tersimpan.');
        $this->assertStringNotContainsString('RahasiaSekali', $mentah);
    }

    public function test_jejak_bertahan_setelah_penggunanya_dihapus(): void
    {
        $petugas = $this->penggunaBerperan('finance');
        $nama = $petugas->name;

        $this->actingAs($petugas);
        $tarif = Tariff::create([
            'nama' => 'Sewa Lab', 'satuan_waktu' => 'jam',
            'harga' => 100_000, 'segmen' => 'internal', 'aktif' => true,
        ]);

        $entri = AuditLog::untukModel('Tariff', $tarif->id)->sole();

        // Penghapusan penggunanya harus BERHASIL — sempat gagal karena
        // `nullOnDelete` pada kunci asing adalah UPDATE terhadap audit_logs,
        // dan pemicu anti-ubah menolaknya. Kunci asingnya dilepas; jejaknya
        // tidak boleh ikut berubah sedikit pun.
        $idPetugas = $petugas->id;
        $petugas->delete();
        $entri->refresh();

        $this->assertSame($idPetugas, $entri->user_id, 'Jejak audit tidak boleh diubah oleh peristiwa lain.');
        $this->assertSame($nama, $entri->nama_pelaku, 'Nama yang disalin membuat barisnya tetap punya arti.');
    }

    // --- Akses ---------------------------------------------------------------

    public function test_peran_tanpa_izin_audit_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('lab-technician'))
            ->getJson('/api/audit')
            ->assertForbidden();
    }

    public function test_pemegang_izin_audit_dapat_menelusuri_jejak(): void
    {
        $tarif = Tariff::create([
            'nama' => 'Sewa Lab', 'satuan_waktu' => 'jam',
            'harga' => 100_000, 'segmen' => 'umum', 'aktif' => true,
        ]);
        $tarif->update(['harga' => 125_000]);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson('/api/audit?model=Tariff&model_id='.$tarif->id)
            ->assertOk()
            ->json('data');

        $this->assertCount(2, $data, 'Pembuatan dan perubahan sama-sama tercatat.');
        $this->assertSame('diubah', $data[0]['peristiwa']['kode']);
        $this->assertSame('Diubah', $data[0]['peristiwa']['nama']);
        $this->assertSame(100_000, $data[0]['sebelum']['harga']);
        $this->assertSame(125_000, $data[0]['sesudah']['harga']);
    }

    public function test_jejak_dapat_ditapis_per_peristiwa_dan_pelaku(): void
    {
        $petugas = $this->penggunaBerperan('finance');

        // Pemeriksa dibuat LEBIH DAHULU. Pembuatan pengguna dan pemberian
        // perannya sendiri ikut tercatat atas nama siapa pun yang sedang
        // masuk — perilaku yang memang diinginkan, tetapi akan mengotori
        // hitungan di bawah bila terjadi setelah actingAs($petugas).
        $pemeriksa = $this->penggunaBerperan('facility-manager');

        $this->actingAs($petugas);
        $tarif = Tariff::create([
            'nama' => 'Sewa Lab', 'satuan_waktu' => 'jam',
            'harga' => 100_000, 'segmen' => 'umum', 'aktif' => true,
        ]);
        $tarif->update(['harga' => 125_000]);

        $this->actingAs($pemeriksa)
            ->getJson('/api/audit?peristiwa=dibuat&model=Tariff')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.objek.label', 'Sewa Lab');

        // Hanya yang dikerjakan petugas itu, bukan yang dikerjakan pemeriksa
        // atau yang terjadi tanpa pelaku.
        $this->actingAs($pemeriksa)
            ->getJson('/api/audit?user_id='.$petugas->id)
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_penghapusan_tarif_tercatat_dengan_nilai_terakhirnya(): void
    {
        $tarif = Tariff::create([
            'nama' => 'Sewa Aula', 'satuan_waktu' => 'hari',
            'harga' => 1_000_000, 'segmen' => 'umum', 'aktif' => true,
        ]);
        $id = $tarif->id;
        $tarif->delete();

        $entri = AuditLog::untukModel('Tariff', $id)->where('peristiwa', 'dihapus')->sole();

        // Nilai terakhir sebelum lenyap adalah satu-satunya kesempatan
        // merekamnya; sesudah barisnya hilang, tidak ada tempat lain untuk
        // mengetahui tarifnya pernah berapa.
        $this->assertSame(1_000_000, $entri->sebelum['harga']);
        $this->assertSame('Sewa Aula', $entri->sebelum['nama']);
        $this->assertNull($entri->sesudah);
    }
}
