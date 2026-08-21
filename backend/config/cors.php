<?php

/**
 * CORS untuk SPA lintas subdomain.
 *
 * Antarmuka berada di lab.semestateknologiutama.com sementara API di
 * api.lab.semestateknologiutama.com. Bagi peramban itu ASAL YANG BERBEDA,
 * sehingga tanpa berkas ini permintaannya tunduk pada bawaan Laravel —
 * `supports_credentials => false` — dan cookie sesi tidak pernah ikut
 * terkirim. Akibatnya bukan galat CORS yang jelas, melainkan setiap
 * permintaan setelah login mengembalikan 401 seolah sandinya salah.
 */
return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    /**
     * Daftar asal yang tegas, bukan '*'.
     *
     * Bukan sekadar praktik baik: spesifikasi CORS MELARANG '*' bersama
     * kredensial. Peramban akan menolak jawabannya, dan gejalanya justru
     * membingungkan — permintaan tanpa kredensial berhasil, yang membawa
     * kredensial diam-diam gagal.
     */
    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CORS_ASAL_DIIZINKAN', 'http://localhost:5173,http://localhost:8000')),
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    // Menyimpan hasil preflight satu jam. Tanpa ini peramban melakukan
    // OPTIONS untuk hampir setiap permintaan, dan latensi dashboard —
    // yang memuat banyak widget sekaligus — berlipat.
    'max_age' => 3600,

    /**
     * Inti berkas ini. Sanctum memakai cookie sesi, bukan token bearer;
     * tanpa ini cookie tidak pernah menyeberang antar subdomain.
     */
    'supports_credentials' => true,

];
