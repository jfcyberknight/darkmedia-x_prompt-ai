<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Client du microservice dmx-magiclink (jfcyberknight/microservices-port-adapter),
 * partagé avec apartment-repair-tracker et darkmedia-x_live_city : génère/
 * hache/expire/consomme les jetons de lien magique à usage unique.
 *
 * Reste ici : l'éligibilité (allowlist — App\Http\Controllers\Auth\
 * MagicLinkController::resolveUser), l'envoi du courriel
 * (App\Mail\MagicLinkMail) et la session.
 *
 * status() (vérification non destructive) est ce qui permet la page de
 * confirmation avant consommation — le correctif que ce dépôt avait dû
 * trouver seul (les scanners de liens des clients mail pré-visitent les GET
 * et brûlaient le jeton avant le vrai clic) est maintenant natif au service
 * partagé, plutôt qu'une particularité locale à réinventer ailleurs.
 */
class MagicLinkService
{
    public function issue(string $email, int $ttlMinutes): ?string
    {
        try {
            $response = Http::withToken(config('services.magiclink.key'))
                ->timeout(5)
                ->post(rtrim(config('services.magiclink.url'), '/').'/links', [
                    'email' => $email,
                    'ttlMinutes' => $ttlMinutes,
                ]);
        } catch (\Throwable $e) {
            Log::error('magiclink: issue request failed', ['error' => $e->getMessage()]);
            return null;
        }

        if ($response->status() !== 200) {
            Log::error('magiclink: issue request rejected', ['status' => $response->status()]);
            return null;
        }

        $token = $response->json('token');
        return is_string($token) && $token !== '' ? $token : null;
    }

    /** Vérification non destructive — pour la page de confirmation avant consommation. */
    public function status(string $token): bool
    {
        if ($token === '') {
            return false;
        }

        try {
            $response = Http::withToken(config('services.magiclink.key'))
                ->timeout(5)
                ->get(rtrim(config('services.magiclink.url'), '/').'/links/status', [
                    'token' => $token,
                ]);
        } catch (\Throwable $e) {
            Log::error('magiclink: status request failed', ['error' => $e->getMessage()]);
            return false;
        }

        return $response->status() === 200 && $response->json('valid') === true;
    }

    public function consume(string $token): ?string
    {
        if ($token === '') {
            return null;
        }

        $response = Http::withToken(config('services.magiclink.key'))
            ->timeout(5)
            ->post(rtrim(config('services.magiclink.url'), '/').'/links/consume', [
                'token' => $token,
            ]);

        if ($response->status() !== 200) {
            return null;
        }

        $email = $response->json('email');
        return is_string($email) && $email !== '' ? $email : null;
    }
}
