<?php

namespace App\Support;

use App\Models\User;

/**
 * Aturan cakupan data (SECURITY.md §4.2), dinyatakan di satu tempat.
 *
 * Sengaja dipisahkan dari scope Eloquent supaya keputusannya — siapa
 * dibatasi, siapa tidak — dapat dibaca dan diuji tanpa menyentuh basis data,
 * dan supaya jawabannya tidak berbeda-beda antar modul.
 */
final class CakupanData
{
    /**
     * Apa arti pengguna yang belum ditugaskan gedung mana pun.
     *
     * 'semua'      → tidak dibatasi (bawaan)
     * 'tidak ada'  → tidak melihat apa pun sampai ditugaskan
     *
     * Lihat migrasi cakupan_data_pengguna untuk pertimbangan lengkapnya.
     * Mengubah nilai ini mengubah perilaku seluruh modul sekaligus, dan itu
     * memang disengaja: aturan sepenting ini tidak boleh berbeda antar modul.
     */
    public const TANPA_PENUGASAN_BERARTI = 'semua';

    /**
     * Peran yang selalu melihat seluruh satuan kerja.
     *
     * Bukan kemudahan, melainkan kebutuhan jabatan: Asset Manager bertanggung
     * jawab saat audit BMN seluruh satker, dan Management membaca dashboard
     * lintas gedung. Membatasi keduanya per gedung membuat pekerjaan intinya
     * mustahil.
     */
    public const PERAN_LINTAS_GEDUNG = ['super-admin', 'asset-manager', 'management', 'finance'];

    /** Peran yang selalu melihat seluruh unit kerja. */
    public const PERAN_LINTAS_UNIT = ['super-admin', 'asset-manager', 'management', 'finance', 'facility-manager'];

    public static function dibatasiGedung(User $pengguna): bool
    {
        if ($pengguna->hasAnyRole(self::PERAN_LINTAS_GEDUNG)) {
            return false;
        }

        if (self::TANPA_PENUGASAN_BERARTI === 'semua' && $pengguna->gedungDiampu()->isEmpty()) {
            return false;
        }

        return true;
    }

    public static function dibatasiUnitKerja(User $pengguna): bool
    {
        if ($pengguna->hasAnyRole(self::PERAN_LINTAS_UNIT)) {
            return false;
        }

        return filled($pengguna->unit_kerja);
    }
}
