<?php

namespace App\Providers;

use App\Mail\Transport\DmxMailerTransport;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Anti-abus sur l'envoi de liens de connexion : borne par IP et par
        // adresse email demandée (empêche de spammer la boîte d'un tiers).
        RateLimiter::for('magic-link', function (Request $request) {
            return [
                Limit::perMinute(5)->by('ip:'.$request->ip()),
                Limit::perMinute(3)->by('email:'.strtolower((string) $request->input('email'))),
            ];
        });

        // Les appels IA sortants coûtent de l'argent : plafond par utilisateur.
        RateLimiter::for('ai', function (Request $request) {
            return Limit::perMinute(20)->by('user:'.($request->user()?->id ?? $request->ip()));
        });

        // Transport Mail « dmxmailer » : délègue au service e-mail privé du VPS
        // (dmx-mailer) plutôt qu'à un SMTP direct. Activé via MAIL_MAILER=dmxmailer.
        Mail::extend('dmxmailer', function (array $config) {
            return new DmxMailerTransport(
                (string) ($config['url'] ?? 'http://dmx-mailer:8080'),
                $config['key'] ?? null,
                (int) ($config['timeout'] ?? 20),
            );
        });
    }
}
