<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Le conteneur tourne derrière le reverse-proxy du VPS : on fait
        // confiance aux en-têtes X-Forwarded-* pour que les URLs générées
        // reprennent bien le schéma https public.
        $middleware->trustProxies(
            at: array_values(array_filter(array_map(
                'trim',
                explode(',', (string) env('TRUSTED_PROXIES', '*'))
            )))
        );

        // Alias de middleware pour l'auth Cloudflare Access (Zero Trust).
        // Remplace l'auth par lien magique : Cloudflare Access valide l'identité
        // (OTP par email, 2FA, etc.) et pose le header Cf-Access-Jwt-Assertion.
        $middleware->alias([
            'cf.access' => \App\Http\Middleware\CloudflareAccessAuth::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
