<?php

namespace App\Services;

use App\Models\ChecklistAnswer;
use App\Models\ChecklistRun;
use App\Models\ChecklistTemplate;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Pelaksanaan checklist: memulai, mengisi, dan menyelesaikan.
 */
class ChecklistService
{
    /**
     * Mulai pelaksanaan.
     *
     * @param  array<string,mixed>  $sumberDaya  salah satu dari room_id/laboratory_id/asset_id
     *
     * @throws ValidationException
     */
    public function mulai(ChecklistTemplate $templat, array $sumberDaya, User $pelaksana): ChecklistRun
    {
        if ($templat->items()->count() === 0) {
            throw ValidationException::withMessages([
                'checklist_template_id' => "Templat “{$templat->nama}” belum memiliki satu butir pun. "
                    .'Tambahkan butirnya lebih dulu — checklist kosong akan selalu selesai dengan skor sempurna '
                    .'tanpa memeriksa apa pun.',
            ]);
        }

        if (! $templat->aktif) {
            throw ValidationException::withMessages([
                'checklist_template_id' => "Templat “{$templat->nama}” sudah tidak aktif.",
            ]);
        }

        return ChecklistRun::create([
            'checklist_template_id' => $templat->id,
            ...$sumberDaya,
            'user_id' => $pelaksana->id,
            'status' => 'berjalan',
            'dimulai_pada' => now(),
            'butir_total' => $templat->items()->count(),
        ]);
    }

    /**
     * Simpan jawaban satu butir.
     *
     * @throws ValidationException
     */
    public function jawab(ChecklistRun $run, int $itemId, ?string $nilai, ?string $catatan): ChecklistAnswer
    {
        $this->pastikanMasihBerjalan($run);

        $item = $run->template->items()->whereKey($itemId)->first();

        if ($item === null) {
            throw ValidationException::withMessages([
                'checklist_item_id' => 'Butir tersebut bukan bagian dari templat pelaksanaan ini.',
            ]);
        }

        return ChecklistAnswer::updateOrCreate(
            ['checklist_run_id' => $run->id, 'checklist_item_id' => $item->id],
            ['nilai' => $nilai, 'lulus' => $item->menilaiLulus($nilai), 'catatan' => $catatan],
        );
    }

    /**
     * Selesaikan pelaksanaan.
     *
     * Butir WAJIB yang belum terjawab menahan penyelesaian. Tanpa penjagaan
     * ini, checklist dapat diselesaikan dengan separuh butir kosong dan tetap
     * tercatat sebagai "sudah diperiksa" — yang justru lebih menyesatkan
     * daripada tidak diperiksa sama sekali, karena tampak sudah beres.
     *
     * @throws ValidationException
     */
    public function selesaikan(ChecklistRun $run, ?string $catatan = null): ChecklistRun
    {
        $this->pastikanMasihBerjalan($run);

        $terjawab = $run->answers()->pluck('checklist_item_id')->all();

        $wajibBelumTerjawab = $run->template->items()
            ->where('wajib', true)
            ->whereNotIn('id', $terjawab ?: [0])
            ->pluck('teks');

        if ($wajibBelumTerjawab->isNotEmpty()) {
            throw ValidationException::withMessages([
                'butir' => 'Masih ada '.$wajibBelumTerjawab->count().' butir wajib yang belum diisi: '
                    .$wajibBelumTerjawab->take(3)->implode('; ')
                    .($wajibBelumTerjawab->count() > 3 ? '; …' : ''),
            ]);
        }

        return DB::transaction(function () use ($run, $catatan) {
            // Skor dihitung hanya dari butir yang punya makna lulus/gagal.
            // Butir angka dan teks bersifat mencatat, bukan menilai;
            // memasukkannya akan membuat skor kehilangan arti.
            $dinilai = $run->answers()->whereNotNull('lulus')->count();
            $lulus = $run->answers()->where('lulus', true)->count();

            $run->update([
                'status' => 'selesai',
                'selesai_pada' => now(),
                'butir_lulus' => $lulus,
                'skor' => $dinilai > 0 ? (int) round($lulus / $dinilai * 100) : null,
                'catatan' => $catatan ?? $run->catatan,
            ]);

            return $run->refresh();
        });
    }

    /**
     * @throws ValidationException
     */
    private function pastikanMasihBerjalan(ChecklistRun $run): void
    {
        if ($run->status !== 'berjalan') {
            throw ValidationException::withMessages([
                'status' => "Pelaksanaan sudah berstatus {$run->status} dan tidak dapat diubah lagi.",
            ]);
        }
    }
}
