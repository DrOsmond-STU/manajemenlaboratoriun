<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Manajemen Pengguna & Peran.
 *
 * Modul paling sensitif dalam sistem — siapa punya akses apa. Dua hal
 * dijaga paling keras: hanya super-admin yang dapat menyentuhnya sama
 * sekali (peran lain mendapat 403, bukan cuma dibatasi), dan admin tidak
 * dapat mengunci dirinya sendiri keluar dari sistemnya sendiri.
 */
class ManajemenPenggunaTest extends TestCase
{
    use RefreshDatabase;

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/pengguna-kelola')->assertUnauthorized();
        $this->getJson('/api/peran')->assertUnauthorized();
    }

    /**
     * @return list<array{string}>
     */
    public static function peranSelainSuperAdmin(): array
    {
        return [
            ['facility-manager'], ['lab-manager'], ['asset-manager'], ['finance'],
            ['employee'], ['lab-technician'], ['room-administrator'], ['event-manager'],
            ['pic'], ['external-user'], ['management'],
        ];
    }

    #[DataProvider('peranSelainSuperAdmin')]
    public function test_hanya_super_admin_boleh_melihat_daftar_pengguna(string $peran): void
    {
        $this->actingAs($this->penggunaBerperan($peran))
            ->getJson('/api/pengguna-kelola')
            ->assertForbidden();
    }

    #[DataProvider('peranSelainSuperAdmin')]
    public function test_hanya_super_admin_boleh_melihat_matriks_peran(string $peran): void
    {
        $this->actingAs($this->penggunaBerperan($peran))
            ->getJson('/api/peran')
            ->assertForbidden();
    }

    public function test_super_admin_dapat_membuat_pengguna_baru(): void
    {
        $admin = $this->penggunaBerperan('super-admin');

        $respons = $this->actingAs($admin)->postJson('/api/pengguna-kelola', [
            'name' => 'Budi Santoso',
            'email' => 'budi@instansi.go.id',
            'password' => 'sandi-aman-123',
            'unit_kerja' => 'Fasilitas',
            'peran' => ['facility-manager'],
            'gedung' => ['Gedung A', 'Gedung B'],
        ]);

        $respons->assertCreated()
            ->assertJsonPath('data.nama', 'Budi Santoso')
            ->assertJsonPath('data.aktif', true)
            ->assertJsonPath('data.peran', ['facility-manager'])
            ->assertJsonPath('data.gedung', ['Gedung A', 'Gedung B']);

        $baru = User::where('email', 'budi@instansi.go.id')->firstOrFail();
        $this->assertTrue($baru->hasRole('facility-manager'));
    }

    /**
     * Sengaja tidak menggabungkan ini dengan pembuatan pengguna lewat
     * endpoint admin dalam satu metode uji yang sama: rute 'masuk' dijaga
     * middleware `guest`, dan permintaan admin sebelumnya (lewat auth:sanctum)
     * meninggalkan default guard aplikasi pada 'sanctum' untuk sisa
     * permintaan pada proses PHP yang sama — 'masuk' pun ikut dianggap
     * permintaan pengguna yang sudah masuk (dialihkan, bukan diproses).
     * Setiap metode uji mendapat aplikasi baru, sehingga memisahkannya
     * menghindari interaksi itu sama sekali.
     */
    public function test_pengguna_baru_dapat_langsung_masuk_dengan_sandinya(): void
    {
        $this->siapkanPeran();
        $baru = User::factory()->create([
            'email' => 'budi@instansi.go.id',
            'password' => Hash::make('sandi-aman-123'),
        ]);
        $baru->assignRole('employee');

        // Sanctum hanya memasang sesi bila permintaan berasal dari origin
        // yang terdaftar sebagai stateful — lihat AuthTest::setUp().
        $this->withHeader('Origin', config('app.url'))
            ->postJson('/api/masuk', [
                'email' => 'budi@instansi.go.id', 'password' => 'sandi-aman-123',
            ])->assertOk();
    }

    public function test_email_kembar_ditolak(): void
    {
        $ada = User::factory()->create(['email' => 'ada@instansi.go.id']);
        $admin = $this->penggunaBerperan('super-admin');

        $this->actingAs($admin)->postJson('/api/pengguna-kelola', [
            'name' => 'Lainnya', 'email' => 'ada@instansi.go.id',
            'password' => 'sandi-aman-123', 'peran' => ['employee'],
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_super_admin_dapat_mengubah_peran_dan_unit_kerja_pengguna_lain(): void
    {
        $admin = $this->penggunaBerperan('super-admin');
        $target = User::factory()->create();
        $target->assignRole('employee');

        $this->actingAs($admin)->putJson("/api/pengguna-kelola/{$target->id}", [
            'unit_kerja' => 'Umum & Fasilitas',
            'peran' => ['facility-manager'],
        ])->assertOk()
            ->assertJsonPath('data.unit_kerja', 'Umum & Fasilitas')
            ->assertJsonPath('data.peran', ['facility-manager']);

        $this->assertFalse($target->fresh()->hasRole('employee'));
        $this->assertTrue($target->fresh()->hasRole('facility-manager'));
    }

    public function test_super_admin_dapat_menonaktifkan_pengguna_lain(): void
    {
        $admin = $this->penggunaBerperan('super-admin');
        $target = User::factory()->create();

        $this->actingAs($admin)->putJson("/api/pengguna-kelola/{$target->id}", ['aktif' => false])
            ->assertOk()->assertJsonPath('data.aktif', false);

        $this->assertFalse($target->fresh()->aktif);
    }

    public function test_pengguna_nonaktif_tidak_dapat_masuk(): void
    {
        $this->siapkanPeran();
        $target = User::factory()->create(['email' => 'nonaktif@instansi.go.id', 'aktif' => false]);
        $target->assignRole('employee');

        // Pesan galatnya HARUS sama dengan sandi salah — lihat LoginRequest.
        $respons = $this->postJson('/api/masuk', [
            'email' => 'nonaktif@instansi.go.id', 'password' => 'password',
        ]);

        $respons->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Surel atau kata sandi tidak cocok.');
    }

    public function test_admin_tidak_dapat_menonaktifkan_akun_sendiri(): void
    {
        $admin = $this->penggunaBerperan('super-admin');

        $this->actingAs($admin)->putJson("/api/pengguna-kelola/{$admin->id}", ['aktif' => false])
            ->assertStatus(422)->assertJsonValidationErrors('aktif');

        $this->assertTrue($admin->fresh()->aktif);
    }

    public function test_admin_tidak_dapat_mencabut_peran_super_admin_dari_akun_sendiri(): void
    {
        $admin = $this->penggunaBerperan('super-admin');

        $this->actingAs($admin)->putJson("/api/pengguna-kelola/{$admin->id}", ['peran' => ['facility-manager']])
            ->assertStatus(422)->assertJsonValidationErrors('peran');

        $this->assertTrue($admin->fresh()->hasRole('super-admin'));
    }

    public function test_admin_boleh_menambah_peran_lain_pada_akun_sendiri_selama_super_admin_tetap_ada(): void
    {
        $admin = $this->penggunaBerperan('super-admin');

        $this->actingAs($admin)->putJson("/api/pengguna-kelola/{$admin->id}", [
            'peran' => ['super-admin', 'facility-manager'],
        ])->assertOk();

        $this->assertTrue($admin->fresh()->hasRole('super-admin'));
        $this->assertTrue($admin->fresh()->hasRole('facility-manager'));
    }

    public function test_tapis_pencarian_dan_status(): void
    {
        $admin = $this->penggunaBerperan('super-admin');
        User::factory()->create(['name' => 'Dewi Anggraini', 'aktif' => true])->assignRole('employee');
        User::factory()->create(['name' => 'Rudi Hartono', 'aktif' => false])->assignRole('employee');

        $this->actingAs($admin)->getJson('/api/pengguna-kelola?cari=Dewi')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'Dewi Anggraini');

        $this->actingAs($admin)->getJson('/api/pengguna-kelola?aktif=0')
            ->assertOk()
            ->assertJsonFragment(['nama' => 'Rudi Hartono']);
    }

    public function test_matriks_peran_menyebut_jumlah_pengguna_sungguhan(): void
    {
        $admin = $this->penggunaBerperan('super-admin');
        User::factory()->create()->assignRole('employee');
        User::factory()->create()->assignRole('employee');

        $respons = $this->actingAs($admin)->getJson('/api/peran')->assertOk();

        $employee = collect($respons->json('peran'))->firstWhere('kode', 'employee');
        $this->assertSame(2, $employee['jumlah_pengguna']);

        // Modul 'pengguna' sendiri hanya PENUH untuk super-admin.
        $this->assertSame('PENUH', $respons->json('matriks.super-admin.pengguna'));
        $this->assertSame('-', $respons->json('matriks.employee.pengguna'));
    }
}
