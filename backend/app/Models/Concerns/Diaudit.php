<?php

namespace App\Models\Concerns;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Pencatatan jejak audit otomatis lewat peristiwa model.
 *
 * Dipasang pada model, BUKAN dipanggil dari controller. Alasannya: jalur tulis
 * tidak hanya lewat controller — ada perintah artisan, seeder, impor massal,
 * dan layanan yang memanggil model langsung. Pemanggilan manual berarti setiap
 * jalur baru harus ingat mencatat, dan yang lupa tidak menimbulkan galat apa
 * pun; hanya perubahan yang tidak terlihat pada pemeriksaan.
 *
 * Model yang memakainya menyatakan sendiri kolom apa yang layak diaudit lewat
 * `kolomDiaudit()`, dan kolom apa yang nilainya tidak boleh ikut tercatat
 * lewat `kolomRahasia()`.
 */
trait Diaudit
{
    public static function bootDiaudit(): void
    {
        static::created(fn (Model $m) => $m->catatAudit('dibuat', [], $m->nilaiDiaudit($m->getAttributes())));

        static::updated(function (Model $m) {
            $berubah = $m->getChanges();

            // Kolom yang tidak diaudit tidak menghasilkan entri sama sekali.
            // Mencatat "diubah" tanpa menyebut apa yang berubah hanya
            // memenuhi jejak audit dengan baris yang tidak menjawab apa pun.
            $sesudah = $m->nilaiDiaudit($berubah);

            if ($sesudah === []) {
                return;
            }

            $sebelum = [];
            foreach (array_keys($sesudah) as $kolom) {
                $sebelum[$kolom] = $m->getOriginal($kolom);
            }

            $m->catatAudit('diubah', $m->samarkan($sebelum), $sesudah);
        });

        static::deleted(fn (Model $m) => $m->catatAudit('dihapus', $m->nilaiDiaudit($m->getOriginal()), []));
    }

    /**
     * Kolom yang layak diaudit. Kosong berarti seluruh kolom yang berubah.
     *
     * @return list<string>
     */
    public function kolomDiaudit(): array
    {
        return [];
    }

    /**
     * Kolom yang nilainya TIDAK boleh masuk jejak audit.
     *
     * Peristiwanya tetap tercatat, nilainya diganti penanda. Jejak audit
     * adalah tempat yang paling banyak dibaca saat pemeriksaan; menaruh
     * rahasia di sana sama saja menyebarkannya.
     *
     * @return list<string>
     */
    public function kolomRahasia(): array
    {
        return ['password', 'remember_token', 'api_token'];
    }

    /** Label singkat agar barisnya terbaca tanpa membuka modelnya. */
    public function labelAudit(): ?string
    {
        return $this->nama ?? $this->nomor ?? $this->kode ?? null;
    }

    /**
     * @param  array<string,mixed>  $atribut
     * @return array<string,mixed>
     */
    protected function nilaiDiaudit(array $atribut): array
    {
        $diaudit = $this->kolomDiaudit();

        $terpilih = $diaudit === []
            ? $atribut
            : array_intersect_key($atribut, array_flip($diaudit));

        unset($terpilih['created_at'], $terpilih['updated_at']);

        return $this->samarkan($terpilih);
    }

    /**
     * @param  array<string,mixed>  $nilai
     * @return array<string,mixed>
     */
    protected function samarkan(array $nilai): array
    {
        foreach ($this->kolomRahasia() as $rahasia) {
            if (array_key_exists($rahasia, $nilai)) {
                $nilai[$rahasia] = '[disamarkan]';
            }
        }

        return $nilai;
    }

    /**
     * @param  array<string,mixed>  $sebelum
     * @param  array<string,mixed>  $sesudah
     */
    protected function catatAudit(string $peristiwa, array $sebelum, array $sesudah): void
    {
        $pelaku = Auth::user();

        AuditLog::create([
            'peristiwa' => $peristiwa,
            'model' => class_basename($this),
            'model_id' => $this->getKey(),
            'label' => $this->labelAudit(),
            'user_id' => $pelaku?->id,
            // Nama disalin, bukan hanya id: pengguna dapat dihapus, dan
            // jejak audit yang menunjuk "pengguna #17" tanpa nama kehilangan
            // arti persis ketika paling dibutuhkan.
            'nama_pelaku' => $pelaku?->name,
            'sebelum' => $sebelum ?: null,
            'sesudah' => $sesudah ?: null,
            'ip' => Request::ip(),
            'rute' => Request::path() ? mb_substr(Request::path(), 0, 200) : null,
        ]);
    }
}
