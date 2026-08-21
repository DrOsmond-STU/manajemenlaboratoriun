<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\EquipmentLoan;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Peminjaman alat: pengajuan, serah terima, dan pengembalian.
 *
 * Menerjemahkan bentrok basis data menjadi pesan yang dapat ditindaklanjuti,
 * dan menegakkan aturan yang tidak dapat dinyatakan sebagai batasan kolom.
 */
class EquipmentLoanService
{
    /** SQLSTATE pelanggaran eksklusi — dipakai pemicu anti-bentrok. */
    private const SQLSTATE_EXCLUSION_VIOLATION = '23P01';

    /**
     * Ajukan peminjaman.
     *
     * @param  array<string,mixed>  $data
     *
     * @throws ValidationException
     */
    public function ajukan(array $data, User $pemohon): EquipmentLoan
    {
        $asset = Asset::findOrFail($data['asset_id']);

        $this->pastikanAlatLayakDipinjam($asset);

        $data['user_id'] = $pemohon->id;
        // Disalin dari pemohon, bukan diterima dari permintaan — bila dikirim
        // pemanggil, penapisan cakupan dapat dilewati.
        $data['unit_kerja'] = $pemohon->unit_kerja;
        $data['status'] = 'menunggu';

        try {
            return DB::transaction(fn () => EquipmentLoan::create($data));
        } catch (QueryException $e) {
            throw $this->terjemahkanBentrok($e, $data);
        }
    }

    /**
     * Serah terima: alat diambil peminjam.
     *
     * Kondisi alat diperiksa ULANG di sini, bukan hanya saat pengajuan. Antara
     * pengajuan dan pengambilan bisa berselang berhari-hari, dan alat dapat
     * rusak dalam rentang itu — meloloskannya berarti menyerahkan alat rusak
     * berat kepada peminjam yang tidak tahu apa-apa.
     *
     * @throws ValidationException
     */
    public function serahkan(EquipmentLoan $peminjaman): EquipmentLoan
    {
        if (! in_array($peminjaman->status, ['menunggu', 'disetujui'], true)) {
            throw ValidationException::withMessages([
                'status' => 'Hanya peminjaman berstatus menunggu atau disetujui yang dapat diserahterimakan. '
                    ."Status sekarang: {$peminjaman->status}.",
            ]);
        }

        $this->pastikanAlatLayakDipinjam($peminjaman->asset);

        $peminjaman->update([
            'status' => 'dipinjam',
            'diambil_pada' => now(),
        ]);

        return $peminjaman->refresh();
    }

    /**
     * Pengembalian.
     *
     * Kondisi alat saat kembali ikut dicatat, dan bila berubah, kondisi pada
     * master aset diperbarui sekalian — beserta riwayatnya. Tanpa itu, alat
     * yang rusak selama dipinjam tetap tercatat "Baik" sampai ada yang
     * kebetulan memeriksanya.
     *
     * @throws ValidationException
     */
    public function kembalikan(
        EquipmentLoan $peminjaman,
        ?string $kondisi,
        ?string $catatan,
        AssetService $aset,
        ?User $pelaku = null,
    ): EquipmentLoan {
        if ($peminjaman->status !== 'dipinjam') {
            throw ValidationException::withMessages([
                'status' => 'Hanya peminjaman yang sedang berjalan yang dapat dikembalikan. '
                    ."Status sekarang: {$peminjaman->status}.",
            ]);
        }

        return DB::transaction(function () use ($peminjaman, $kondisi, $catatan, $aset, $pelaku) {
            $peminjaman->update([
                'status' => 'dikembalikan',
                'dikembalikan_pada' => now(),
                'kondisi_saat_kembali' => $kondisi,
                'catatan' => $catatan ?? $peminjaman->catatan,
            ]);

            if ($kondisi !== null && $kondisi !== $peminjaman->asset->kondisi) {
                $aset->ubah(
                    $peminjaman->asset,
                    ['kondisi' => $kondisi],
                    $pelaku,
                    'Perubahan kondisi saat pengembalian peminjaman #'.$peminjaman->id,
                );
            }

            return $peminjaman->refresh();
        });
    }

    /**
     * @throws ValidationException bila alat tidak layak dipinjam
     */
    private function pastikanAlatLayakDipinjam(Asset $asset): void
    {
        if ($asset->kondisi === 'RB') {
            throw ValidationException::withMessages([
                'asset_id' => "Alat {$asset->nama} berkondisi Rusak Berat dan tidak dapat dipinjamkan. "
                    .'Perbaiki dan perbarui kondisinya lebih dulu.',
            ]);
        }

        if ($asset->status_penggunaan === 'Dihapuskan') {
            throw ValidationException::withMessages([
                'asset_id' => "Alat {$asset->nama} sudah dihapuskan dan tidak dapat dipinjamkan.",
            ]);
        }
    }

    /**
     * @param  array<string,mixed>  $data
     */
    private function terjemahkanBentrok(QueryException $e, array $data): \Throwable
    {
        if ($e->getCode() !== self::SQLSTATE_EXCLUSION_VIOLATION
            && ! str_contains($e->getMessage(), 'equipment_loans_no_overlap')) {
            return $e;
        }

        $bentrok = isset($data['asset_id'], $data['mulai'], $data['selesai'])
            ? EquipmentLoan::query()
                ->where('asset_id', $data['asset_id'])
                ->menahan()
                ->bersinggungan((string) $data['mulai'], (string) $data['selesai'])
                ->orderBy('mulai')
                ->first()
            : null;

        $pesan = $bentrok
            ? sprintf(
                'Alat sudah dipinjam %s–%s untuk “%s”. Pilih waktu lain atau alat lain.',
                $bentrok->mulai->timezone(config('app.timezone'))->format('d/m/Y H:i'),
                $bentrok->selesai->timezone(config('app.timezone'))->format('d/m/Y H:i'),
                $bentrok->keperluan,
            )
            : 'Alat sudah dipinjam pada rentang waktu tersebut.';

        return ValidationException::withMessages(['mulai' => $pesan]);
    }
}
