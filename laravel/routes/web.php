<?php

use App\Http\Controllers\Api\AiProxyController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\PromptController;
use App\Http\Controllers\Auth\MagicLinkController;
use Illuminate\Support\Facades\Route;

// NB : pas de closures ici — l'entrypoint du conteneur exécute
// `php artisan route:cache`, qui ne sait pas sérialiser les closures.

// SPA : une seule vue, le JS bascule entre écran de connexion et application.
Route::view('/', 'app')->name('home');

// Cible du middleware auth pour les requêtes non-JSON : renvoie vers la SPA.
Route::redirect('/login', '/')->name('login');

// ---- Authentification par magic link ----
Route::post('/auth/magic-link', [MagicLinkController::class, 'send'])
    ->middleware('throttle:magic-link');

// Étape 1 (GET) : affiche la confirmation sans consommer le jeton (les
// scanners de liens pré-visitent cette URL — voir MagicLinkController::verify).
// Throttle : chaque GET interroge le microservice de jetons (appel HTTP sortant)
// et peut servir à le marteler depuis une IP.
Route::get('/auth/magic', [MagicLinkController::class, 'verify'])
    ->middleware('throttle:magic-link-verify')
    ->name('magic-link.login');

// Étape 2 (POST) : consomme le jeton (usage unique) et ouvre la session.
// Throttle : borne le bruteforce (les jetons sont à haute entropie, mais
// chaque tentative coûte un appel HTTP sortant au microservice).
Route::post('/auth/magic', [MagicLinkController::class, 'consume'])
    ->middleware('throttle:magic-link-consume')
    ->name('magic-link.consume');

Route::post('/auth/logout', [MagicLinkController::class, 'logout'])
    ->middleware('auth');

// ---- API (session + CSRF, réservée aux utilisateurs connectés) ----
Route::middleware('auth')->prefix('api')->group(function () {
    Route::get('/me', [MagicLinkController::class, 'me']);

    Route::get('/categories', [CategoryController::class, 'index']);

    Route::get('/prompts', [PromptController::class, 'index']);
    Route::post('/prompts', [PromptController::class, 'store']);
    Route::put('/prompts/{prompt}', [PromptController::class, 'update']);
    Route::delete('/prompts/{prompt}', [PromptController::class, 'destroy']);
    Route::post('/prompts/{prompt}/favorite', [PromptController::class, 'toggleFavorite']);
    Route::post('/prompts/{prompt}/usage', [PromptController::class, 'incrementUsage']);
    Route::get('/prompts/{prompt}/versions', [PromptController::class, 'versions']);

    Route::post('/ai', AiProxyController::class)->middleware('throttle:ai');
});
