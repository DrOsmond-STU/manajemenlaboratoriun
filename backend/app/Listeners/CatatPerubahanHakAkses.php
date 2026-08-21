<?php

namespace App\Listeners;

use App\Services\AuditService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Spatie\Permission\Events\PermissionAttachedEvent;
use Spatie\Permission\Events\PermissionDetachedEvent;
use Spatie\Permission\Events\RoleAttachedEvent;
use Spatie\Permission\Events\RoleDetachedEvent;

/**
 * Mencatat setiap pemberian dan pencabutan peran serta izin.
 *
 * SECURITY.md §4.3 menuntut perubahan hak akses selalu meninggalkan jejak
 * berisi nilai sebelum dan sesudah. Ini satu-satunya perubahan yang dapat
 * dipakai untuk menyembunyikan perubahan lain — seseorang yang bisa menaikkan
 * perannya sendiri tanpa jejak dapat melakukan apa pun sesudahnya dan terlihat
 * berwenang. Karena itu pencatatannya tidak boleh bergantung pada satu
 * endpoint tertentu: peristiwa dari paket izin menyala di jalur mana pun,
 * termasuk perintah artisan dan seeder.
 *
 * Menuntut `permission.events_enabled = true` pada config/permission.php.
 */
class CatatPerubahanHakAkses
{
    public function handle(
        RoleAttachedEvent|RoleDetachedEvent|PermissionAttachedEvent|PermissionDetachedEvent $event
    ): void {
        [$jenis, $diberikan] = match (true) {
            $event instanceof RoleAttachedEvent => ['peran', true],
            $event instanceof RoleDetachedEvent => ['peran', false],
            $event instanceof PermissionAttachedEvent => ['izin', true],
            default => ['izin', false],
        };

        $peran = $jenis === 'peran';

        $daftar = $this->namaTerbaca(
            $peran ? $event->rolesOrIds : $event->permissionsOrIds,
            $peran ? config('permission.models.role') : config('permission.models.permission'),
        );

        if ($daftar === []) {
            return;
        }

        $perubahan = [$jenis => $daftar];

        AuditService::catat(
            peristiwa: 'diubah',
            subjek: $event->model,
            // Arah perubahan dinyatakan lewat sisi mana yang terisi:
            // masuk ke `sesudah` berarti diberikan, masuk ke `sebelum`
            // berarti dicabut. Pemeriksa membaca keduanya berdampingan.
            sebelum: $diberikan ? [] : $perubahan,
            sesudah: $diberikan ? $perubahan : [],
        );
    }

    /**
     * Mengubah apa pun yang dilepas paket izin menjadi daftar NAMA.
     *
     * Trait HasRoles melepas id, bukan objek peran. Mencatat id apa adanya
     * menghasilkan baris berbunyi "peran 4 dicabut" — yang memaksa pemeriksa
     * menebak, dan tebakannya bisa salah karena id dapat dipakai ulang setelah
     * perannya dihapus. Karena itu id ditukar menjadi nama di sini, saat
     * perannya masih ada.
     *
     * @param  class-string<Model>  $kelas  model peran atau izin
     * @return list<string>
     */
    private function namaTerbaca(mixed $nilai, string $kelas): array
    {
        $daftar = match (true) {
            $nilai instanceof Collection => $nilai->all(),
            $nilai instanceof Model => [$nilai],
            is_array($nilai) => $nilai,
            default => [$nilai],
        };

        $nama = [];
        $id = [];

        foreach ($daftar as $item) {
            if ($item instanceof Model) {
                $nama[] = (string) ($item->name ?? $item->getKey());
            } elseif ($item !== null && $item !== '') {
                $id[] = $item;
            }
        }

        if ($id !== []) {
            $model = new $kelas;
            $ditemukan = $kelas::query()
                ->whereIn($model->getKeyName(), $id)
                ->pluck('name', $model->getKeyName());

            foreach ($id as $satu) {
                // Bila namanya tak ditemukan, id-nya tetap dicatat dengan
                // penanda. Menghilangkan barisnya justru menutupi perubahan
                // hak akses — persis yang tidak boleh terjadi di sini.
                $nama[] = (string) ($ditemukan[$satu] ?? '#'.$satu);
            }
        }

        return array_values(array_filter($nama, fn (string $n) => $n !== ''));
    }
}
