<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventParticipant;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string,mixed>
     */
    private function isian(array $ganti = []): array
    {
        return array_merge([
            'nama' => 'National Tech Summit 2026',
            'jenis' => 'Konferensi',
            'organizer' => 'Divisi Pemasaran',
            'tanggal' => now()->addDays(10)->toDateString(),
            'jumlah_peserta' => 380,
            'anggaran' => 285_000_000,
        ], $ganti);
    }

    public function test_tamu_ditolak(): void
    {
        $this->getJson('/api/acara')->assertUnauthorized();
        $this->postJson('/api/acara', $this->isian())->assertUnauthorized();
    }

    // --- Izin JUGA mencerminkan booking-ruangan persis --------------------

    public function test_facility_manager_dan_room_administrator_penuh(): void
    {
        foreach (['facility-manager', 'room-administrator'] as $peran) {
            $user = $this->penggunaBerperan($peran);

            $data = $this->actingAs($user)
                ->postJson('/api/acara', $this->isian())
                ->assertCreated()
                ->json('data');

            $this->actingAs($user)
                ->putJson('/api/acara/'.$data['id'], ['status' => 'terkonfirmasi'])
                ->assertOk()
                ->assertJsonPath('data.status.kode', 'terkonfirmasi');
        }
    }

    public function test_event_manager_dan_pic_ubah_dapat_buat_dan_ubah(): void
    {
        foreach (['event-manager', 'pic'] as $peran) {
            $user = $this->penggunaBerperan($peran);

            $data = $this->actingAs($user)
                ->postJson('/api/acara', $this->isian())
                ->assertCreated()
                ->json('data');

            $this->actingAs($user)
                ->putJson('/api/acara/'.$data['id'], ['status' => 'terkonfirmasi'])
                ->assertOk();
        }
    }

    public function test_lihat_saja_asset_manager_finance_lab_technician_management(): void
    {
        foreach (['asset-manager', 'finance', 'lab-technician', 'management'] as $peran) {
            $user = $this->penggunaBerperan($peran);

            $this->actingAs($user)->getJson('/api/acara')->assertOk();
            $this->actingAs($user)->postJson('/api/acara', $this->isian())->assertForbidden();
        }
    }

    public function test_employee_dan_external_user_boleh_ajukan_tapi_tidak_boleh_ubah(): void
    {
        foreach (['employee', 'external-user'] as $peran) {
            $event = Event::factory()->create();
            $user = $this->penggunaBerperan($peran);

            $this->actingAs($user)
                ->postJson('/api/acara', $this->isian())
                ->assertCreated();

            $this->actingAs($user)
                ->putJson('/api/acara/'.$event->id, ['status' => 'terkonfirmasi'])
                ->assertForbidden();
        }
    }

    // --- CRUD & filter -----------------------------------------------------

    public function test_pendaftaran_mencatat_pendaftar_dan_status_awal(): void
    {
        $pic = User::factory()->create();
        $room = Room::factory()->create();
        $pendaftar = $this->penggunaBerperan('facility-manager');

        $data = $this->actingAs($pendaftar)
            ->postJson('/api/acara', $this->isian([
                'pic_id' => $pic->id,
                'room_id' => $room->id,
            ]))
            ->assertCreated()
            ->json('data');

        $this->assertSame('direncanakan', $data['status']['kode']);
        $this->assertSame($pic->id, $data['pic']['id']);
        $this->assertSame($room->id, $data['ruangan']['id']);
        $this->assertDatabaseHas('events', ['id' => $data['id'], 'dibuat_oleh' => $pendaftar->id]);
    }

    public function test_status_tidak_dapat_diatur_saat_pendaftaran(): void
    {
        // status selalu 'direncanakan' di awal, diabaikan bila dikirim klien —
        // konsisten dengan pola VisitorService yang tidak mempercayai status
        // dari permintaan pendaftaran.
        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/acara', $this->isian(['status' => 'selesai']))
            ->assertCreated()
            ->json('data');

        $this->assertSame('direncanakan', $data['status']['kode']);
    }

    public function test_daftar_dapat_dicari_dan_ditapis_status_dan_jenis(): void
    {
        $user = $this->penggunaBerperan('facility-manager');
        Event::factory()->create(['nama' => 'National Tech Summit', 'organizer' => 'Divisi Pemasaran', 'jenis' => 'Konferensi']);
        Event::factory()->terkonfirmasi()->create(['nama' => 'Pelatihan ISO 17025', 'jenis' => 'Pelatihan']);
        Event::factory()->create(['nama' => 'Gathering Mitra', 'jenis' => 'Gathering']);

        $this->actingAs($user)->getJson('/api/acara?cari=Tech Summit')
            ->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($user)->getJson('/api/acara?status=terkonfirmasi')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'Pelatihan ISO 17025');

        $this->actingAs($user)->getJson('/api/acara?jenis=Gathering')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'Gathering Mitra');
    }

    public function test_anggaran_negatif_ditolak(): void
    {
        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/acara', $this->isian(['anggaran' => -1]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('anggaran');
    }

    public function test_status_di_luar_daftar_ditolak(): void
    {
        $event = Event::factory()->create();

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/acara/'.$event->id, ['status' => 'bukan-status-sah'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_event_batal_ditandai_status_bukan_dihapus(): void
    {
        $event = Event::factory()->create();

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->putJson('/api/acara/'.$event->id, ['status' => 'dibatalkan'])
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'dibatalkan');

        $this->assertDatabaseHas('events', ['id' => $event->id, 'status' => 'dibatalkan']);
    }

    public function test_anggaran_dapat_dikosongkan(): void
    {
        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson('/api/acara', $this->isian(['anggaran' => null]))
            ->assertCreated()
            ->json('data');

        $this->assertNull($data['anggaran']);
    }

    public function test_jumlah_peserta_hanya_disertakan_bila_diminta(): void
    {
        $event = Event::factory()->create();
        EventParticipant::factory()->for($event)->create();
        EventParticipant::factory()->hadir()->for($event)->create();
        EventParticipant::factory()->hadir()->for($event)->create();
        EventParticipant::factory()->tidakHadir()->for($event)->create();

        $user = $this->penggunaBerperan('facility-manager');

        $tanpaParam = $this->actingAs($user)->getJson('/api/acara')
            ->assertOk()->json('data.0');
        $this->assertArrayNotHasKey('jumlah_peserta_terdaftar', $tanpaParam);

        $denganParam = $this->actingAs($user)->getJson('/api/acara?dengan_peserta=1')
            ->assertOk()->json('data.0');

        $this->assertSame(4, $denganParam['jumlah_peserta_terdaftar']);
        $this->assertSame(2, $denganParam['jumlah_peserta_hadir']);
    }
}
