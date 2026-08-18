<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Permintaan yang TIDAK meminta JSON.
 *
 * Seluruh uji lain memakai getJson/postJson, yang selalu mengirim
 * `Accept: application/json`. Itu menyembunyikan satu jalur penting: bawaan
 * Laravel mengalihkan tamu ke rute bernama `login` bila permintaannya tidak
 * meminta JSON — dan rute itu tidak ada pada aplikasi API. Upaya pengalihan
 * itu sendiri melempar RouteNotFoundException, sehingga jawabannya menjadi
 * 500, bukan 401.
 *
 * Cacat itu lolos dari seluruh 93 uji dan baru ketahuan saat API dipanggil
 * dengan curl biasa dari server. Uji di sini menirukan pemanggil semacam itu
 * — peramban, alat pemantau, atau siapa pun yang lupa memasang header —
 * supaya jalur tersebut tidak pernah lagi tak teruji.
 */
class ApiTanpaHeaderJsonTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return list<array{string, string}>
     */
    public static function ruteTerlindung(): array
    {
        return [
            'daftar aset' => ['get', '/api/assets'],
            'detail pengguna' => ['get', '/api/user'],
            'daftar pemesanan' => ['get', '/api/bookings'],
            'master kode barang' => ['get', '/api/bmn/kode-barang'],
        ];
    }

    #[DataProvider('ruteTerlindung')]
    public function test_tamu_menerima_401_bukan_500(string $metode, string $rute): void
    {
        // Tanpa header Accept sama sekali — persis seperti `curl <url>`.
        $respons = $this->call(strtoupper($metode), $rute);

        $this->assertSame(
            401,
            $respons->getStatusCode(),
            "{$rute} menjawab {$respons->getStatusCode()}; tamu harus menerima 401, bukan galat server.",
        );
    }

    public function test_jawaban_tamu_berupa_json(): void
    {
        $respons = $this->call('GET', '/api/assets');

        $this->assertStringContainsString('application/json', (string) $respons->headers->get('content-type'));
        $this->assertSame('Unauthenticated.', $respons->json('message'));
    }

    public function test_rute_yang_tidak_ada_menjawab_404_bukan_500(): void
    {
        $respons = $this->call('GET', '/api/tidak-ada');

        $this->assertSame(404, $respons->getStatusCode());
    }
}
