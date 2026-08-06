<?php

namespace Tests\Feature;

use App\Mail\MagicLinkMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Le stockage des jetons vit dans le microservice dmx-magiclink — ces tests
 * n'appellent jamais le vrai service : Http::fake() tient lieu de contrat
 * (voir jfcyberknight/microservices-port-adapter pour les tests du service
 * lui-même, y compris l'atomicité de la consommation à usage unique).
 */
class MagicLinkAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.magiclink.url' => 'http://dmx-magiclink.test']);
        config(['services.magiclink.key' => 'mlk_test']);
    }

    /** Récupère le loginUrl du dernier MagicLinkMail envoyé, puis en extrait le jeton. */
    private function capturedLoginUrl(): string
    {
        $loginUrl = null;
        Mail::assertSent(MagicLinkMail::class, function (MagicLinkMail $mail) use (&$loginUrl) {
            $loginUrl = $mail->loginUrl;

            return true;
        });

        return (string) $loginUrl;
    }

    private function tokenFromUrl(string $url): string
    {
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        return (string) ($query['token'] ?? '');
    }

    private function fakeIssue(string $token = 'known-token'): array
    {
        return [
            'dmx-magiclink.test/links' => Http::response(['token' => $token, 'expiresAt' => now()->addMinutes(15)->toIso8601String()], 200),
        ];
    }

    public function test_allowed_email_receives_magic_link_and_can_login(): void
    {
        Mail::fake();
        Http::fake([
            ...$this->fakeIssue(),
            'dmx-magiclink.test/links/status*' => Http::response(['valid' => true, 'email' => 'jf@example.com'], 200),
            'dmx-magiclink.test/links/consume' => Http::response(['email' => 'jf@example.com'], 200),
        ]);
        config(['magiclink.allowed_emails' => ['jf@example.com']]);

        $response = $this->postJson('/auth/magic-link', ['email' => 'jf@example.com']);
        $response->assertOk();

        $user = User::where('email', 'jf@example.com')->first();
        $this->assertNotNull($user, "Le compte doit être créé à la volée pour une adresse de l'allowlist");

        $loginUrl = $this->capturedLoginUrl();

        // Étape 1 (GET) : page de confirmation, sans consommer le jeton.
        $this->get($loginUrl)->assertOk()->assertSee('Confirmer la connexion');
        $this->assertGuest();

        // Étape 2 (POST) : consommation effective + ouverture de session.
        $this->post('/auth/magic', ['token' => $this->tokenFromUrl($loginUrl)])
            ->assertRedirect('/');
        $this->assertAuthenticatedAs($user);
    }

    public function test_get_does_not_consume_the_token(): void
    {
        Mail::fake();
        Http::fake([
            ...$this->fakeIssue(),
            'dmx-magiclink.test/links/status*' => Http::response(['valid' => true, 'email' => 'jf@example.com'], 200),
            'dmx-magiclink.test/links/consume' => Http::response(['email' => 'jf@example.com'], 200),
        ]);
        config(['magiclink.allowed_emails' => ['jf@example.com']]);

        $this->postJson('/auth/magic-link', ['email' => 'jf@example.com']);
        $loginUrl = $this->capturedLoginUrl();

        // Simule les pré-visites des scanners de liens (Gmail, McAfee…) :
        // plusieurs GET successifs ne doivent jamais invalider le lien —
        // /links/status ne consomme rien côté service (voir README de
        // microservices-port-adapter).
        foreach (range(1, 3) as $i) {
            $this->get($loginUrl)->assertOk()->assertSee('Confirmer la connexion');
        }
        $this->assertGuest();

        // Le lien reste utilisable pour la vraie connexion (POST).
        $this->post('/auth/magic', ['token' => $this->tokenFromUrl($loginUrl)])
            ->assertRedirect('/');
        $this->assertAuthenticated();
    }

    public function test_magic_link_is_single_use(): void
    {
        Mail::fake();
        Http::fake([
            ...$this->fakeIssue(),
            'dmx-magiclink.test/links/consume' => Http::sequence()
                ->push(['email' => 'jf@example.com'], 200)
                ->push(['error' => 'invalid_or_expired_or_used'], 410),
            // Vérifiée seulement après la consommation : plus valide.
            'dmx-magiclink.test/links/status*' => Http::response(['valid' => false], 200),
        ]);
        config(['magiclink.allowed_emails' => ['jf@example.com']]);

        $this->postJson('/auth/magic-link', ['email' => 'jf@example.com']);
        $loginUrl = $this->capturedLoginUrl();
        $token = $this->tokenFromUrl($loginUrl);

        // Première consommation : succès.
        $this->post('/auth/magic', ['token' => $token])->assertRedirect('/');

        // Seconde utilisation du même lien : session neuve, lien déjà consommé.
        $this->post('/auth/logout');
        $this->flushSession();

        // Le GET ne montre plus la confirmation (jeton disparu) et le POST est refusé.
        $this->get($loginUrl)->assertRedirect('/?login_error=expired');
        $this->post('/auth/magic', ['token' => $token])->assertRedirect('/?login_error=expired');
        $this->assertGuest();
    }

    public function test_unallowed_email_gets_generic_response_without_mail(): void
    {
        Mail::fake();
        Http::fake();
        config(['magiclink.allowed_emails' => ['jf@example.com']]);

        $response = $this->postJson('/auth/magic-link', ['email' => 'intrus@example.com']);

        // Réponse générique identique (anti-énumération), mais aucun envoi.
        $response->assertOk();
        Mail::assertNothingSent();
        Http::assertNothingSent();
        $this->assertDatabaseMissing('users', ['email' => 'intrus@example.com']);
    }

    public function test_empty_allowlist_only_allows_existing_users(): void
    {
        Mail::fake();
        Http::fake($this->fakeIssue());
        config(['magiclink.allowed_emails' => []]);

        User::factory()->create(['email' => 'existant@example.com']);

        $this->postJson('/auth/magic-link', ['email' => 'existant@example.com'])->assertOk();
        Mail::assertSent(MagicLinkMail::class);

        Mail::fake();
        Http::fake();
        $this->postJson('/auth/magic-link', ['email' => 'nouveau@example.com'])->assertOk();
        Mail::assertNothingSent();
        Http::assertNothingSent();
    }

    public function test_invalid_token_redirects_with_error(): void
    {
        Http::fake([
            'dmx-magiclink.test/links/status*' => Http::response(['valid' => false], 200),
        ]);

        $this->get('/auth/magic?token=invalide')->assertRedirect('/?login_error=expired');
        $this->assertGuest();
    }

    public function test_logout_clears_session(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/auth/logout')->assertOk();
        $this->assertGuest();
    }
}
