<?php

/**
 * Identitas satuan kerja dan penomoran BMN.
 *
 * Kode lokasi 15 digit disusun menurut PMK 29/PMK.06/2010:
 *
 *     024 . 05 . 0100 . 652431 . 000
 *      │     │     │       │      └── kode sub-satker (000 bila tidak ada)
 *      │     │     │       └───────── kode satuan kerja (UAKPB)
 *      │     │     └───────────────── kode wilayah
 *      │     └─────────────────────── kode eselon I
 *      └───────────────────────────── kode bagian anggaran / kementerian
 *
 * Nilai bawaan di sini adalah CONTOH dari purwarupa. Sebelum dipakai
 * sungguhan, seluruhnya wajib diganti dengan identitas satuan kerja yang
 * sebenarnya lewat berkas .env — jangan disunting langsung di sini, agar
 * lingkungan uji dan produksi tidak tertukar.
 */
return [

    'bagian_anggaran' => env('BMN_BAGIAN_ANGGARAN', '024'),
    'eselon1' => env('BMN_ESELON1', '05'),
    'wilayah' => env('BMN_WILAYAH', '0100'),
    'satker' => env('BMN_SATKER', '652431'),
    'sub_satker' => env('BMN_SUB_SATKER', '000'),

    'nama_satker' => env('BMN_NAMA_SATKER', 'Balai Besar Laboratorium Pengujian Semesta'),
    'singkatan_satker' => env('BMN_SINGKATAN_SATKER', 'STU'),

    /** KP / KD / DK / TP / UB */
    'kewenangan' => env('BMN_KEWENANGAN', 'KD'),

    /**
     * Pola penomoran internal — penomoran kedua, bebas ditentukan satuan kerja.
     * Token yang dikenali didaftar di App\Services\KodeInternalGenerator.
     */
    'pola_internal' => env('BMN_POLA_INTERNAL', '{SATKER}/{LAB}/{KATEGORI}/{TAHUN}/{URUT}'),

];
