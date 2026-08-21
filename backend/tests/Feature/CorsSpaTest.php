<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Antarmuka dan API berada di subdomain berbeda, sehingga bagi peramban
 * keduanya adalah asal yang berbeda. Bila jawabannya tidak membawa tajuk yang
 * tepat, gejalanya bukan galat CORS yang jelas melainkan 401 pada setiap
 * permintaan setelah login — seolah sandinya salah.
 */
class CorsSpaTest extends TestCase
{
    use RefreshDatabase;

    private const ASAL = 'https://lab.semestateknologiutama.com';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('cors.allowed_origins', [self::ASAL]);
    }

    public function test_asal_antarmuka_diizinkan_membawa_kredensial(): void
    {
        $jawaban = $this->withHeader('Origin', self::ASAL)->getJson('/api/saya');

        $this->assertSame(self::ASAL, $jawaban->headers->get('Access-Control-Allow-Origin'));

        // Tanpa tajuk ini peramban membuang cookie sesi diam-diam.
        $this->assertSame('true', $jawaban->headers->get('Access-Control-Allow-Credentials'));
    }

    public function test_asal_yang_tidak_terdaftar_tidak_mendapat_izin(): void
    {
        $penyusup = 'https://situs-lain.example';

        $jawaban = $this->withHeader('Origin', $penyusup)->getJson('/api/saya');

        // Yang menjaga BUKAN hilangnya tajuk itu — dengan satu asal terdaftar,
        // Laravel tetap mengembalikan asal terdaftar itu apa adanya. Yang
        // menjaga adalah peramban: ia membandingkan nilai tajuk dengan asalnya
        // sendiri, dan menolak begitu keduanya berbeda.
        $this->assertNotSame(
            $penyusup,
            $jawaban->headers->get('Access-Control-Allow-Origin'),
            'Asal penyusup tidak boleh dipantulkan kembali kepadanya.'
        );
    }

    public function test_dengan_beberapa_asal_terdaftar_hanya_yang_cocok_dipantulkan(): void
    {
        // Lebih dari satu asal — misalnya produksi ditambah pengembangan
        // lokal — membuat Laravel memilih berdasarkan asal permintaan.
        config()->set('cors.allowed_origins', [self::ASAL, 'http://localhost:5173']);

        $sah = $this->withHeader('Origin', 'http://localhost:5173')->getJson('/api/saya');
        $this->assertSame('http://localhost:5173', $sah->headers->get('Access-Control-Allow-Origin'));

        $penyusup = $this->withHeader('Origin', 'https://situs-lain.example')->getJson('/api/saya');
        $this->assertNull(
            $penyusup->headers->get('Access-Control-Allow-Origin'),
            'Asal tak dikenal tidak boleh mendapat izin sama sekali.'
        );
    }

    public function test_preflight_dijawab_tanpa_menuntut_autentikasi(): void
    {
        // OPTIONS dikirim peramban SEBELUM permintaan sebenarnya, tanpa
        // cookie. Bila jalur ini menuntut autentikasi, seluruh panggilan API
        // gagal sebelum sempat dikirim.
        $jawaban = $this->call('OPTIONS', '/api/masuk', [], [], [], [
            'HTTP_ORIGIN' => self::ASAL,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
        ]);

        $jawaban->assertNoContent();
        $this->assertSame(self::ASAL, $jawaban->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_bintang_tidak_pernah_dipakai_bersama_kredensial(): void
    {
        // Spesifikasi CORS melarang '*' bersama kredensial; peramban menolak
        // jawabannya, dan gejalanya membingungkan — permintaan tanpa
        // kredensial berhasil, yang membawa kredensial diam-diam gagal.
        $this->assertTrue(config('cors.supports_credentials'));
        $this->assertNotContains('*', config('cors.allowed_origins'));
    }
}
