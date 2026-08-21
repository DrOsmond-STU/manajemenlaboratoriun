<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * Pengingat jadwal dikirim sekali sehari pada pagi hari kerja.
 *
 * `withoutOverlapping` mencegah dua proses berjalan bersamaan bila yang
 * sebelumnya belum selesai. Itu lapisan kenyamanan, bukan jaminan —
 * jaminannya tetap indeks unik pada notification_logs, yang bekerja bahkan
 * bila penjadwalnya dijalankan manual dari dua tempat sekaligus.
 */
Schedule::command('flms:kirim-pengingat')
    ->dailyAt('06:30')
    ->timezone(config('app.timezone'))
    ->withoutOverlapping()
    ->onOneServer();
