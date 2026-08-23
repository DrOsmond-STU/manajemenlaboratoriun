<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetAuditScan;
use App\Models\AssetAuditSession;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Sesi audit fisik (stock opname), pemindaian, dan ringkasannya.
 *
 * Populasi dihitung LANGSUNG dari `assets` dalam cakupan pengguna setiap
 * kali ringkasan diminta — bukan snapshot yang disimpan saat sesi dibuat.
 * Lihat docblock migrasi `asset_audit_sessions` untuk alasannya.
 */
class AssetAuditService
{
    /**
     * @param  array<string,mixed>  $data
     */
    public function mulaiSesi(array $data, User $pembuat): AssetAuditSession
    {
        return AssetAuditSession::create([
            ...$data,
            'status' => 'berjalan',
            'dibuat_oleh' => $pembuat->id,
        ]);
    }

    /**
     * Catat satu pemindaian. Kode dicocokkan ke kode_internal, bmn_id, atau
     * serial_number — auditor di lapangan tidak selalu tahu mana yang
     * tercetak di label yang mereka pindai.
     *
     * lokasi_ditemukan/kondisi_ditemukan yang TIDAK dikirim berarti auditor
     * mengonfirmasi aset ditemukan sesuai catatan — inilah kasus paling
     * umum di lapangan (dipindai persis di tempatnya), sehingga tidak perlu
     * mengetik ulang lokasi/kondisi yang sudah benar untuk setiap aset.
     *
     * Memindai ulang aset yang sama pada sesi yang sama MEMPERBARUI baris
     * yang sudah ada (indeks unik sesi+aset), bukan menambah baris baru —
     * auditor yang salah pindai dapat memindai ulang tanpa menggandakan
     * hitungan "sudah diverifikasi".
     *
     * @param  array<string,mixed>  $data
     *
     * @throws ValidationException
     */
    public function catatScan(AssetAuditSession $sesi, array $data, User $auditor): AssetAuditScan
    {
        if ($sesi->status !== 'berjalan') {
            throw ValidationException::withMessages([
                'sesi' => 'Sesi audit ini sudah ditutup dan tidak dapat menerima pemindaian baru.',
            ]);
        }

        $kode = trim((string) $data['kode']);
        $aset = Asset::query()
            ->dalamCakupan($auditor)
            ->where(fn ($q) => $q
                ->where('kode_internal', $kode)
                ->orWhere('bmn_id', $kode)
                ->orWhere('serial_number', $kode))
            ->first();

        if (! $aset) {
            throw ValidationException::withMessages([
                'kode' => 'Kode tidak dikenali — tidak ada aset yang cocok dalam cakupan Anda.',
            ]);
        }

        $lokasiTercatat = $this->lokasiAset($aset);

        return AssetAuditScan::updateOrCreate(
            ['asset_audit_session_id' => $sesi->id, 'asset_id' => $aset->id],
            [
                'lokasi_tercatat' => $lokasiTercatat,
                'lokasi_ditemukan' => $data['lokasi_ditemukan'] ?? $lokasiTercatat,
                'kondisi_tercatat' => $aset->kondisi,
                'kondisi_ditemukan' => $data['kondisi_ditemukan'] ?? $aset->kondisi,
                'auditor_id' => $auditor->id,
                'dipindai_pada' => now(),
                'catatan' => $data['catatan'] ?? null,
            ],
        );
    }

    public function tutupSesi(AssetAuditSession $sesi): AssetAuditSession
    {
        if ($sesi->status !== 'berjalan') {
            throw ValidationException::withMessages([
                'sesi' => 'Sesi audit ini sudah ditutup sebelumnya.',
            ]);
        }

        $sesi->update(['status' => 'selesai', 'selesai_pada' => now()]);

        return $sesi;
    }

    /**
     * @return array<string,mixed>
     */
    public function ringkasan(AssetAuditSession $sesi, User $pengguna): array
    {
        $populasi = Asset::query()->dalamCakupan($pengguna)->with('room:id,nama,gedung')->get(['id', 'room_id']);
        $scans = $sesi->scans()->get();
        $scannedId = $scans->pluck('asset_id')->all();

        $sesuai = 0;
        $lokasiBerbeda = 0;
        $kondisiBerbeda = 0;
        foreach ($scans as $s) {
            match ($s->temuan()) {
                'lokasi_berbeda' => $lokasiBerbeda++,
                'kondisi_berbeda' => $kondisiBerbeda++,
                default => $sesuai++,
            };
        }

        // Selisih populasi vs yang sudah dipindai. Selama sesi berjalan,
        // ini "belum diaudit" — begitu sesi ditutup, angka yang SAMA
        // berubah makna jadi "tidak ditemukan". Lihat docblock migrasi.
        $belumDipindai = $populasi->whereNotIn('id', $scannedId)->count();

        // Progres per gedung — aset tanpa ruangan dikumpulkan di "Tanpa
        // Penempatan" alih-alih hilang dari rekap.
        $perGedung = $populasi->groupBy(fn (Asset $a) => $a->room?->gedung ?: 'Tanpa Penempatan')
            ->map(function ($grup, $gedung) use ($scannedId) {
                $total = $grup->count();
                $terpindai = $grup->whereIn('id', $scannedId)->count();

                return [
                    'gedung' => $gedung,
                    'total' => $total,
                    'terpindai' => $terpindai,
                    'persentase' => $total > 0 ? (int) round(($terpindai / $total) * 100) : 0,
                ];
            })
            ->sortByDesc('total')
            ->values()
            ->all();

        return [
            'total_aset' => $populasi->count(),
            'sudah_diverifikasi' => $scans->count(),
            'sesuai' => $sesuai,
            'lokasi_berbeda' => $lokasiBerbeda,
            'kondisi_berbeda' => $kondisiBerbeda,
            'belum_diaudit' => $sesi->status === 'berjalan' ? $belumDipindai : 0,
            'tidak_ditemukan' => $sesi->status === 'selesai' ? $belumDipindai : 0,
            'per_gedung' => $perGedung,
        ];
    }

    private function lokasiAset(Asset $aset): ?string
    {
        if (! $aset->room) {
            return null;
        }

        return $aset->room->gedung
            ? "{$aset->room->gedung} / {$aset->room->nama}"
            : $aset->room->nama;
    }
}
