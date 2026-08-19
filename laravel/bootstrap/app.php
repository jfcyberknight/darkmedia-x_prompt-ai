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
        // (dont les magic links) reprennent bien le schéma https public.
        // Restreignable via TRUSTED_PROXIES (liste d'IP/CIDR séparées par des
        // virgules) — '*' par défaut, sûr tant que le port n'est exposé qu'en
        // loopback (docker-compose.vps.yml) ; à restreindre si le conteneur
        // est publié sur 0.0.0.0 (docker-compose.yml générique).
        $middleware->trustProxies(
            at: array_values(array_filter(array_map(
                'trim',
                explode(',', (string) env('TRUSTED_PROXIES', '*'))
            )))
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
