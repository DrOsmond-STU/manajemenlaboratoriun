<?php

namespace App\Support;

/**
 * Identitas satuan kerja pemilik barang.
 *
 * Kode lokasi dirakit di satu tempat ini saja. Bila dirakit tersebar di banyak
 * berkas, satu saja yang keliru urutannya akan menghasilkan identitas BMN yang
 * salah namun tetap tampak masuk akal — dan baru ketahuan saat rekonsiliasi
 * dengan SIMAK-BMN.
 */
final class Satker
{
    /** Kode lokasi 15 digit: BA.Es1.Wilayah.Satker.SubSatker */
    public static function kodeLokasi(): string
    {
        return implode('.', [
            config('bmn.bagian_anggaran'),
            config('bmn.eselon1'),
            config('bmn.wilayah'),
            config('bmn.satker'),
            config('bmn.sub_satker'),
        ]);
    }

    public static function nama(): string
    {
        return (string) config('bmn.nama_satker');
    }

    public static function singkatan(): string
    {
        return (string) config('bmn.singkatan_satker');
    }
}
