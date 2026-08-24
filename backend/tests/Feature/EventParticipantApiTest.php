<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventParticipant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventParticipantApiTest extends TestCase
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
            'email' => 'andi@kalibrasipresisi.co.id',
            'telepon' => '0812-3344-556',
        ], $ganti);
    }

    public function test_tamu_ditolak(): void
    {
        $event = Event::factory()->create();

        $this->getJson("/api/acara/{$event->id}/peserta")->assertUnauthorized();
        $this->postJson("/api/acara/{$event->id}/peserta", $this->isian())->assertUnauthorized();
    }

    // --- Izin memakai booking-ruangan.* milik event induk ------------------

    public function test_room_administrator_penuh_dapat_daftar_hadir_tidak_hadir(): void
    {
        $event = Event::factory()->create();
        $user = $this->penggunaBerperan('room-administrator');

        $data = $this->actingAs($user)
            ->postJson("/api/acara/{$event->id}/peserta", $this->isian())
            ->assertCreated()
            ->json('data');

        $this->assertSame('terdaftar', $data['status']['kode']);

        $peserta = EventParticipant::find($data['id']);

        $this->actingAs($user)
            ->postJson("/api/peserta-event/{$peserta->id}/hadir")
            ->assertOk()
            ->assertJsonPath('data.status.kode', 'hadir');
    }

    public function test_lihat_saja_asset_manager_finance_lab_technician_management(): void
    {
        $event = Event::factory()->create();

        foreach (['asset-manager', 'finance', 'lab-technician', 'management'] as $peran) {
            $user = $this->penggunaBerperan($peran);

            $this->actingAs($user)->getJson("/api/acara/{$event->id}/peserta")->assertOk();
            $this->actingAs($user)->postJson("/api/acara/{$event->id}/peserta", $this->isian())->assertForbidden();
        }
    }

    public function test_employee_boleh_daftar_tapi_tidak_boleh_tandai_hadir(): void
    {
        $event = Event::factory()->create();
        $peserta = EventParticipant::factory()->for($event)->create();
        $user = $this->penggunaBerperan('employee');

        $this->actingAs($user)
            ->postJson("/api/acara/{$event->id}/peserta", $this->isian())
            ->assertCreated();

        $this->actingAs($user)
            ->postJson("/api/peserta-event/{$peserta->id}/hadir")
            ->assertForbidden();
    }

    // --- CRUD & transisi -----------------------------------------------

    public function test_pendaftaran_selalu_mulai_terdaftar(): void
    {
        $event = Event::factory()->create();

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson("/api/acara/{$event->id}/peserta", $this->isian())
            ->assertCreated()
            ->json('data');

        $this->assertSame('terdaftar', $data['status']['kode']);
        $this->assertNull($data['hadir_pada']);
        $this->assertDatabaseHas('event_participants', ['id' => $data['id'], 'event_id' => $event->id]);
    }

    public function test_daftar_hanya_memuat_peserta_event_yang_bersangkutan(): void
    {
        $eventA = Event::factory()->create();
        $eventB = Event::factory()->create();
        EventParticipant::factory()->for($eventA)->create(['nama' => 'Peserta A']);
        EventParticipant::factory()->for($eventB)->create(['nama' => 'Peserta B']);

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->getJson("/api/acara/{$eventA->id}/peserta")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $data);
        $this->assertSame('Peserta A', $data[0]['nama']);
    }

    public function test_tandai_hadir_yang_sudah_hadir_ditolak(): void
    {
        $peserta = EventParticipant::factory()->hadir()->create();

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson("/api/peserta-event/{$peserta->id}/hadir")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_tandai_tidak_hadir_yang_sudah_diputuskan_ditolak(): void
    {
        $peserta = EventParticipant::factory()->tidakHadir()->create();

        $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson("/api/peserta-event/{$peserta->id}/tidak-hadir")
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_tandai_hadir_mencatat_waktu(): void
    {
        $peserta = EventParticipant::factory()->create();

        $data = $this->actingAs($this->penggunaBerperan('facility-manager'))
            ->postJson("/api/peserta-event/{$peserta->id}/hadir")
            ->assertOk()
            ->json('data');

        $this->assertNotNull($data['hadir_pada']);
    }

    public function test_cari_dan_tapis_status(): void
    {
        $event = Event::factory()->create();
        EventParticipant::factory()->for($event)->create(['nama' => 'Sri Rahayu', 'instansi' => 'PT Sonic Nusantara']);
        EventParticipant::factory()->hadir()->for($event)->create(['nama' => 'Budi Santoso']);

        $user = $this->penggunaBerperan('facility-manager');

        $this->actingAs($user)->getJson("/api/acara/{$event->id}/peserta?cari=Sonic")
            ->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($user)->getJson("/api/acara/{$event->id}/peserta?status=hadir")
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nama', 'Budi Santoso');
    }

    public function test_event_dihapus_ikut_menghapus_peserta(): void
    {
        // cascadeOnDelete: berbeda dari nullOnDelete di seluruh modul lain
        // window ini — peserta tanpa event tidak bermakna apa pun.
        $event = Event::factory()->create();
        $peserta = EventParticipant::factory()->for($event)->create();

        $event->delete();

        $this->assertDatabaseMissing('event_participants', ['id' => $peserta->id]);
    }

    public function test_constraint_database_konsisten_dengan_factory_states(): void
    {
        $terdaftar = EventParticipant::factory()->create();
        $hadir = EventParticipant::factory()->hadir()->create();
        $tidakHadir = EventParticipant::factory()->tidakHadir()->create();

        $this->assertDatabaseHas('event_participants', ['id' => $terdaftar->id, 'status' => 'terdaftar']);
        $this->assertDatabaseHas('event_participants', ['id' => $hadir->id, 'status' => 'hadir']);
        $this->assertDatabaseHas('event_participants', ['id' => $tidakHadir->id, 'status' => 'tidak_hadir']);
        $this->assertNotNull($hadir->fresh()->hadir_pada);
    }
}
