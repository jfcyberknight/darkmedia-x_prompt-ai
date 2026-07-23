<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\MagicLinkMail;
use App\Models\User;
use Illuminate\Contracts\View\View;
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
     * Étape 1 (GET) : le lien reçu par courriel n'est PAS consommé ici. Les
     * scanners de liens (Gmail, McAfee, Safe Browsing…) pré-visitent les URLs
     * des courriels ; consommer le jeton au GET rendait chaque lien « déjà
     * utilisé » avant même le clic du propriétaire. On valide donc le jeton
     * sans le détruire (Cache::has) et on affiche une page de confirmation ;
     * seule la soumission du formulaire (POST) ouvre réellement la session.
     */
    public function verify(Request $request): RedirectResponse|View
    {
        $token = (string) $request->query('token', '');

        $valid = $token !== '' && Cache::has('magic_link:'.hash('sha256', $token));

        if (! $valid) {
            return redirect('/?login_error=expired');
        }

        return view('auth.confirm', ['token' => $token]);
    }

    /**
     * Étape 2 (POST) : consommation effective du lien. Cache::pull récupère et
     * supprime le jeton de façon atomique → usage unique garanti, même sous
     * deux requêtes concurrentes. Un lien déjà utilisé (ou expiré) renvoie vers
     * la SPA avec l'invite à en redemander un nouveau. Succès → session
     * authentifiée + redirection SPA.
     */
    public function consume(Request $request): RedirectResponse
    {
        $validated = $request->validate(['token' => ['required', 'string']]);

        $userId = Cache::pull('magic_link:'.hash('sha256', $validated['token']));
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
