<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

/**
 * Kerangka Laravel 11+ sengaja mengosongkan kelas ini, termasuk membuang
 * trait AuthorizesRequests. Trait itu dikembalikan di sini supaya controller
 * dapat memakai `authorize()` dan `authorizeResource()` — jalur otorisasi
 * berbasis Policy, yang diperlukan ketika izin sebuah sumber daya tidak dapat
 * dinyatakan sebagai satu nama izin pada middleware `can:`.
 *
 * Contohnya ruangan: membacanya boleh dengan izin master-data ATAU
 * booking-ruangan, dan percabangan seperti itu tempatnya di Policy.
 */
abstract class Controller
{
    use AuthorizesRequests;
}
