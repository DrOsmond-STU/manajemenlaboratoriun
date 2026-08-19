<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\PeranIzinSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Masuk, keluar, dan ganti sandi.
 *
 * Beberapa uji di sini menjaga hal yang tidak terlihat saat dicoba manual —
 * pesan galat yang membocorkan keanggotaan, sesi yang tidak berganti identitas
 * setelah masuk, pembatas yang tidak dibersihkan. Semuanya tetap "berfungsi"
 * bagi pengguna biasa, dan hanya berarti bagi penyerang.
 */
class AuthTest extends TestCase
{
    use RefreshDatabase;

    private const SANDI = 'rahasia-panjang-2026';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PeranIzinSeeder::class);
        RateLimiter::clear('masuk:budi@contoh.test|127.0.0.1');

        // Sanctum hanya memasang sesi bila permintaan berasal dari origin yang
        // terdaftar sebagai stateful. Peramban selalu mengirim header ini pada
        // XHR lintas-origin — dan SPA memang berada di subdomain berbeda dari
        // API — sedangkan PHPUnit tidak mengirimnya sendiri. Tanpa baris ini
        // ujinya menguji keadaan yang tidak pernah terjadi di lapangan.
        $this->withHeader('Origin', config('app.url'));
    }

    /**
     * Masuk lewat endpoint sungguhan, bukan actingAs().
     *
     * actingAs() menyetel pengguna langsung pada guard tanpa membentuk sesi,
     * sehingga uji keluar dan ganti sandi — yang justru bekerja pada sesi —
     * akan lulus tanpa menguji apa pun.
     */
    private function masuk(string $sandi = self::SANDI): void
    {
        $this->postJson('/api/masuk', ['email' => 'budi@contoh.test', 'password' => $sandi])
            ->assertOk();
    }

    private function pengguna(string $peran = 'employee'): User
    {
        return User::factory()->create([
            'email' => 'budi@contoh.test',
            'password' => Hash::make(self::SANDI),
        ])->assignRole($peran);
    }

    // --- Masuk ------------------------------------------------------------

    public function test_dapat_masuk_dengan_kredensial_benar(): void
    {
        $this->pengguna();

        $this->postJson('/api/masuk', ['email' => 'budi@contoh.test', 'password' => self::SANDI])
            ->assertOk()
            ->assertJsonPath('data.email', 'budi@contoh.test')
            ->assertJsonPath('data.peran', ['employee']);

        $this->assertAuthenticated();
    }

    public function test_sandi_salah_ditolak(): void
    {
        $this->pengguna();

        $this->postJson('/api/masuk', ['email' => 'budi@contoh.test', 'password' => 'salah'])
            ->assertStatus(422);

        $this->assertGuest();
    }

    public function test_pesan_galat_tidak_membocorkan_keberadaan_surel(): void
    {
        $this->pengguna();

        $sandiSalah = $this->postJson('/api/masuk', [
            'email' => 'budi@contoh.test', 'password' => 'salah',
        ])->assertStatus(422)->json('errors.email');

        RateLimiter::clear('masuk:tidakada@contoh.test|127.0.0.1');

        $surelTidakAda = $this->postJson('/api/masuk', [
            'email' => 'tidakada@contoh.test', 'password' => 'salah',
        ])->assertStatus(422)->json('errors.email');

        // Bila berbeda, borang masuk berubah menjadi alat pemeriksa keanggotaan.
        $this->assertSame($sandiSalah, $surelTidakAda);
    }

    public function test_percobaan_berulang_ditahan(): void
    {
        $this->pengguna();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/masuk', ['email' => 'budi@contoh.test', 'password' => 'salah'])
                ->assertStatus(422);
        }

        $pesan = $this->postJson('/api/masuk', ['email' => 'budi@contoh.test', 'password' => self::SANDI])
            ->assertStatus(422)
            ->json('errors.email.0');

        $this->assertStringContainsString('Terlalu banyak percobaan', $pesan);

        // Sandi yang BENAR pun ikut ditolak selama masa tahan — itulah gunanya.
        $this->assertGuest();
    }

    public function test_pembatas_dibersihkan_setelah_berhasil(): void
    {
        $this->pengguna();

        $this->postJson('/api/masuk', ['email' => 'budi@contoh.test', 'password' => 'salah'])
            ->assertStatus(422);

        $this->postJson('/api/masuk', ['email' => 'budi@contoh.test', 'password' => self::SANDI])
            ->assertOk();

        $this->assertSame(0, RateLimiter::attempts('masuk:budi@contoh.test|127.0.0.1'));
    }

    public function test_identitas_sesi_berganti_setelah_masuk(): void
    {
        $this->pengguna();

        $this->get('/up');                       // membentuk sesi tamu
        $sebelum = session()->getId();

        $this->postJson('/api/masuk', ['email' => 'budi@contoh.test', 'password' => self::SANDI])
            ->assertOk();

        // Bila id sesi tidak berganti, penyerang yang menanamkan id sesi
        // kepada korban sebelum korban masuk ikut terautentikasi.
        $this->assertNotSame($sebelum, session()->getId());
    }

    // --- Identitas & keluar ------------------------------------------------

    public function test_saya_menampilkan_peran_dan_izin(): void
    {
        $pengguna = $this->pengguna('asset-manager');

        $data = $this->actingAs($pengguna)->getJson('/api/saya')->assertOk()->json('data');

        $this->assertSame(['asset-manager'], $data['peran']);
        $this->assertContains('aset.kelola', $data['izin']);
        $this->assertNotContains('penyewaan.kelola', $data['izin']);
    }

    public function test_jawaban_tidak_pernah_memuat_sandi(): void
    {
        $pengguna = $this->pengguna();

        $isi = $this->actingAs($pengguna)->getJson('/api/saya')->assertOk()->getContent();

        $this->assertStringNotContainsString('password', $isi);
        $this->assertStringNotContainsString($pengguna->password, $isi);
    }

    public function test_dapat_keluar(): void
    {
        $this->pengguna();
        $this->masuk();
        $this->assertAuthenticated();

        $this->postJson('/api/keluar')->assertOk();

        // Sengaja TIDAK memakai assertGuest(): pemeriksaan itu membaca keadaan
        // guard yang masih tersimpan di dalam proses uji, bukan akibat nyata
        // dari keluar. Yang benar-benar berarti adalah permintaan berikutnya
        // ditolak — persis yang dialami peramban dengan cookie sesi yang sudah
        // tidak berlaku.
        $this->getJson('/api/saya')->assertUnauthorized();
    }

    public function test_tamu_tidak_dapat_membaca_identitas(): void
    {
        $this->getJson('/api/saya')->assertUnauthorized();
    }

    // --- Ganti sandi -------------------------------------------------------

    public function test_dapat_mengganti_sandi(): void
    {
        $pengguna = $this->pengguna();
        $this->masuk();

        $this->postJson('/api/ubah-sandi', [
            'sandi_sekarang' => self::SANDI,
            'sandi_baru' => 'sandi-baru-yang-panjang-2026',
            'sandi_baru_confirmation' => 'sandi-baru-yang-panjang-2026',
        ])->assertOk();

        $this->assertTrue(Hash::check('sandi-baru-yang-panjang-2026', $pengguna->fresh()->password));
        $this->assertFalse(Hash::check(self::SANDI, $pengguna->fresh()->password),
            'Sandi lama seharusnya sudah tidak berlaku.');
    }

    public function test_ganti_sandi_menuntut_sandi_sekarang(): void
    {
        $pengguna = $this->pengguna();
        $this->masuk();

        $this->postJson('/api/ubah-sandi', [
            'sandi_sekarang' => 'tebakan-salah',
            'sandi_baru' => 'sandi-baru-yang-panjang-2026',
            'sandi_baru_confirmation' => 'sandi-baru-yang-panjang-2026',
        ])->assertStatus(422)->assertJsonValidationErrors('sandi_sekarang');

        $this->assertTrue(Hash::check(self::SANDI, $pengguna->fresh()->password));
    }

    public function test_sandi_baru_terlalu_pendek_ditolak(): void
    {
        $this->pengguna();
        $this->masuk();

        $this->postJson('/api/ubah-sandi', [
            'sandi_sekarang' => self::SANDI,
            'sandi_baru' => 'pendek1',
            'sandi_baru_confirmation' => 'pendek1',
        ])->assertStatus(422)->assertJsonValidationErrors('sandi_baru');
    }

    public function test_sandi_baru_tidak_boleh_sama_dengan_yang_sekarang(): void
    {
        $this->pengguna();
        $this->masuk();

        $this->postJson('/api/ubah-sandi', [
            'sandi_sekarang' => self::SANDI,
            'sandi_baru' => self::SANDI,
            'sandi_baru_confirmation' => self::SANDI,
        ])->assertStatus(422)->assertJsonValidationErrors('sandi_baru');
    }
}
