<?php

use App\Http\Controllers\Api\AiProxyController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\PromptController;
use Illuminate\Support\Facades\Route;

// NB : pas de closures ici — l'entrypoint du conteneur exécute
// `php artisan route:cache`, qui ne sait pas sérialiser les closures.

// SPA : une seule vue, le JS bascule entre écran de connexion et application.
// L'auth est désormais gérée par Cloudflare Access (Zero Trust) devant le tunnel :
// Cloudflare intercepte les requêtes non authentifiées et affiche la page de
// connexion OTP/2FA. Une fois l'utilisateur validé, le header Cf-Access-Jwt-Assertion
// est posé et le middleware cf.access connecte l'utilisateur Laravel automatiquement.
Route::view('/', 'app')->name('home');

Route::redirect('/login', '/')->name('login');

// ---- API (protégée par Cloudflare Access via le middleware cf.access) ----
// Le middleware cf.access valide le JWT Cloudflare Access et connecte l'utilisateur
// Laravel. Pas besoin de lien magique ni de session préalable.
Route::middleware(['cf.access'])->prefix('api')->group(function () {
    Route::get('/me', function () {
        return response()->json([
            'id' => auth()->user()->id,
            'name' => auth()->user()->name,
            'email' => auth()->user()->email,
        ]);
    });

    Route::get('/categories', [CategoryController::class, 'index']);

    Route::get('/prompts', [PromptController::class, 'index']);
    Route::post('/prompts', [PromptController::class, 'store']);
    Route::put('/prompts/{prompt}', [PromptController::class, 'update']);
    Route::delete('/prompts/{prompt}', [PromptController::class, 'destroy']);
    Route::post('/prompts/{prompt}/favorite', [PromptController::class, 'toggleFavorite']);
    Route::post('/prompts/{prompt}/usage', [PromptController::class, 'incrementUsage']);
    Route::post('/prompts/{prompt}/email', [PromptController::class, 'email']);
    Route::get('/prompts/{prompt}/versions', [PromptController::class, 'versions']);

    Route::post('/ai', AiProxyController::class)->middleware('throttle:ai');
});
