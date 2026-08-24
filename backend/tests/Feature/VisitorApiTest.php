<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use App\Models\Visitor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VisitorApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string,mixed>
     */
    private function isian(array $ganti = []): array
    {
        return array_merge([
            'nama' => 'Andi Wijaya',
            'instansi' => 'PT Kalibrasi Presisi',
            'tujuan' => 'Audit Supplier',
            'tanggal' => now()->toDateString(),
        ], $ganti);
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/pengunjung')->assertUnauthorized();
        $this->postJson('/api/pengunjung', $this->isian())->assertUnauthorized();
    }

    // --- Izin MENCERMINKAN booking-ruangan persis -----------------------

    public function test_room_administrator_penuh_dapat_mendaftar_checkin_checkout(): void
    {
        $user = $this->penggunaBerperan('room-administrator');

        $data = $this->actingAs($user)
            ->postJson('/api/pengunjung', $this->isian())
            ->assertCreated()
            ->json('data');

        $this->assertSame('terjadwal', $data['status']['kode']);

        $tamu = Visitor::find($data['id']);

        $this->actingAs($user)
            ->postJson("/api/pengunjung/{$tamu->id}/checkin", ['badge' => 'V-201'])
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'di_dalam')
            ->assertJsonPath('data.badge', 'V-201');

        $this->actingAs($user)
            ->postJson("/api/pengunjung/{$tamu->id}/checkout")
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'selesai');
    }

    public function test_event_manager_dan_pic_ubah_dapat_checkin_checkout(): void
    {
        foreach (['event-manager', 'pic'] as $peran) {
            $tamu = Visitor::factory()->create();
            $user = $this->penggunaBerperan($peran);

            $this->actingAs($user)->getJson('/api/pengunjung')->assertOk();
            $this->actingAs($user)
                ->postJson("/api/pengunjung/{$tamu->id}/checkin")
                ->assertOk();
        }
    }

    public function test_lihat_saja_asset_manager_finance_lab_technician_management(): void
    {
        foreach (['asset-manager', 'finance', 'lab-technician', 'management'] as $peran) {
            $user = $this->penggunaBerperan($peran);

            $this->actingAs($user)->getJson('/api/pengunjung')->assertOk();
            $this->actingAs($user)->postJson('/api/pengunjung', $this->isian())->assertForbidden();
        }
    }

    public function test_employee_dan_external_user_boleh_daftar_tapi_tidak_boleh_checkin(): void
    {
        foreach (['employee', 'external-user'] as $peran) {
            $tamu = Visitor::factory()->create();
            $user = $this->penggunaBerperan($peran);

            $this->actingAs($user)
                ->postJson('/api/pengunjung', $this->isian())
                ->assertCreated();

            $this->actingAs($user)
                ->postJson("/api/pengunjung/{$tamu->id}/checkin")
                ->assertForbidden();
        }
    }

    // --- CRUD & filter -----------------------------------------------------

    public function test_pendaftaran_mencatat_pendaftar_dan_status_awal(): void
    {
        $host = User::factory()->create();
        $room = Room::factory()->create();
        $pendaftar = $this->penggunaBerperan('room-administrator');

        $data = $this->actingAs($pendaftar)
            ->postJson('/api/pengunjung', $this->isian([
                'host_id' => $host->id,
                'room_id' => $room->id,
            ]))
            ->assertCreated()
            ->json('data');

        $this->assertSame('terjadwal', $data['status']['kode']);
        $this->assertSame($host->id, $data['host']['id']);
        $this->assertSame($room->id, $data['ruangan']['id']);
        $this->assertNull($data['masuk_pada']);
        $this->assertDatabaseHas('visitors', ['id' => $data['id'], 'dibuat_oleh' => $pendaftar->id]);
    }

    public function test_daftar_dapat_dicari_dan_ditapis_status_dan_tanggal(): void
    {
        $user = $this->penggunaBerperan('room-administrator');
        Visitor::factory()->create(['nama' => 'Andi Wijaya', 'instansi' => 'PT Sonic Nusantara', 'tanggal' => today()]);
        Visitor::factory()->diDalam()->create(['nama' => 'Sri Rahayu', 'instansi' => 'PT Kalibrasi Presisi', 'tanggal' => today()]);
        Visitor::factory()->create(['nama' => 'Budi Santoso', 'tanggal' => today()->subDays(3)]);

        $this->actingAs($user)->getJson('/api/pengunjung?cari=Sonic')
            ->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($user)->getJson('/api/pengunjung?status=di_dalam')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'Sri Rahayu');

        $this->actingAs($user)->getJson('/api/pengunjung?tanggal='.today()->toDateString())
            ->assertOk()->assertJsonCount(2, 'data');
    }

    // --- Transisi status -----------------------------------------------

    public function test_checkin_menolak_tamu_yang_sudah_checkin(): void
    {
        $tamu = Visitor::factory()->diDalam()->create();

        $this->actingAs($this->penggunaBerperan('room-administrator'))
            ->postJson("/api/pengunjung/{$tamu->id}/checkin")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_checkout_menolak_tamu_yang_belum_checkin(): void
    {
        $tamu = Visitor::factory()->create();

        $this->actingAs($this->penggunaBerperan('room-administrator'))
            ->postJson("/api/pengunjung/{$tamu->id}/checkout")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_checkout_menolak_tamu_yang_sudah_selesai(): void
    {
        $tamu = Visitor::factory()->selesai()->create();

        $this->actingAs($this->penggunaBerperan('room-administrator'))
            ->postJson("/api/pengunjung/{$tamu->id}/checkout")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_checkin_boleh_tanpa_badge(): void
    {
        $tamu = Visitor::factory()->create();

        $this->actingAs($this->penggunaBerperan('room-administrator'))
            ->postJson("/api/pengunjung/{$tamu->id}/checkin")
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'di_dalam')
            ->assertJsonPath('data.badge', null);
    }

    public function test_constraint_database_konsisten_dengan_factory_states(): void
    {
        // Tiga baris ini masing-masing mewakili satu tahap CHECK
        // (visitors_status_sah / visitors_masuk_bertanggal /
        // visitors_keluar_bertanggal) — kalau migrasinya salah tulis,
        // salah satu factory state ini akan gagal INSERT di sini.
        $terjadwal = Visitor::factory()->create();
        $diDalam = Visitor::factory()->diDalam()->create();
        $selesai = Visitor::factory()->selesai()->create();

        $this->assertDatabaseHas('visitors', ['id' => $terjadwal->id, 'status' => 'terjadwal']);
        $this->assertDatabaseHas('visitors', ['id' => $diDalam->id, 'status' => 'di_dalam']);
        $this->assertDatabaseHas('visitors', ['id' => $selesai->id, 'status' => 'selesai']);
        $this->assertNotNull($diDalam->fresh()->masuk_pada);
        $this->assertNotNull($selesai->fresh()->keluar_pada);
    }
}
