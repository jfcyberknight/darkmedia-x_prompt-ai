<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\MagicLinkMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class MagicLinkController extends Controller
{
    /**
     * Demande d'un lien de connexion. Répond toujours par un message générique
     * (même adresse inconnue / non autorisée) pour empêcher l'énumération
     * d'emails ; le lien n'est réellement envoyé qu'aux adresses éligibles.
     */
    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate(['email' => ['required', 'email']]);
        $email = strtolower(trim($validated['email']));

        $user = $this->resolveUser($email);

        if ($user !== null) {
            $token = Str::random(64);
            $minutes = (int) config('magiclink.expiration_minutes', 15);

            Cache::put(
                'magic_link:'.hash('sha256', $token),
                $user->id,
                now()->addMinutes($minutes)
            );

            $loginUrl = route('magic-link.login', ['token' => $token]);

            Mail::to($user->email)->send(new MagicLinkMail($loginUrl, $minutes));
        }

        return response()->json([
            'message' => 'Si cette adresse est autorisée, un lien de connexion vient de lui être envoyé.',
        ]);
    }

    /**
     * Consommation du lien : le token est à usage unique (Cache::pull) et
     * expire automatiquement. Succès → session authentifiée + redirection SPA.
     */
    public function login(Request $request): RedirectResponse
    {
        $token = (string) $request->query('token', '');

        $userId = $token === ''
            ? null
            : Cache::pull('magic_link:'.hash('sha256', $token));

        $user = $userId !== null ? User::find($userId) : null;

        if ($user === null) {
            return redirect('/?login_error=expired');
        }

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        return redirect('/');
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'id' => $request->user()->id,
            'name' => $request->user()->name,
            'email' => $request->user()->email,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Déconnecté.']);
    }

    /**
     * Détermine si l'adresse peut se connecter :
     * - adresse dans l'allowlist → compte créé à la volée si nécessaire ;
     * - allowlist vide → seuls les comptes existants sont acceptés.
     */
    private function resolveUser(string $email): ?User
    {
        $allowed = config('magiclink.allowed_emails', []);

        if (in_array($email, $allowed, true)) {
            return User::firstOrCreate(
                ['email' => $email],
                ['name' => Str::before($email, '@')]
            );
        }

        if (empty($allowed)) {
            return User::where('email', $email)->first();
        }

        return null;
    }
}
