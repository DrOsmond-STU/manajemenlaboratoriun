<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Aplikasi ini melayani API, bukan halaman. Bawaan Laravel mengalihkan
        // tamu ke rute bernama `login`, yang tidak ada di sini — dan upaya
        // pengalihan itu sendiri melempar RouteNotFoundException, sehingga
        // permintaan tanpa autentikasi terjawab 500, bukan 401.
        //
        // Mengembalikan null berarti "jangan alihkan ke mana pun", sehingga
        // AuthenticationException diteruskan ke perender dan menjadi 401 JSON.
        //
        // Ini tidak tertangkap uji mana pun sebelumnya karena getJson/postJson
        // selalu mengirim `Accept: application/json`; jalur pengalihan hanya
        // ditempuh permintaan yang TIDAK meminta JSON.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
