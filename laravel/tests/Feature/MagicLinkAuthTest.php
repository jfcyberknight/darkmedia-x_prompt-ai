<?php

namespace Tests\Feature;

use App\Mail\MagicLinkMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class MagicLinkAuthTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_allowed_email_receives_magic_link_and_can_login(): void
    {
        Mail::fake();
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
        config(['magiclink.allowed_emails' => ['jf@example.com']]);

        $this->postJson('/auth/magic-link', ['email' => 'jf@example.com']);
        $loginUrl = $this->capturedLoginUrl();

        // Simule les pré-visites des scanners de liens (Gmail, McAfee…) :
        // plusieurs GET successifs ne doivent jamais invalider le lien.
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
        config(['magiclink.allowed_emails' => ['jf@example.com']]);

        $response = $this->postJson('/auth/magic-link', ['email' => 'intrus@example.com']);

        // Réponse générique identique (anti-énumération), mais aucun envoi.
        $response->assertOk();
        Mail::assertNothingSent();
        $this->assertDatabaseMissing('users', ['email' => 'intrus@example.com']);
    }

    public function test_empty_allowlist_only_allows_existing_users(): void
    {
        Mail::fake();
        config(['magiclink.allowed_emails' => []]);

        User::factory()->create(['email' => 'existant@example.com']);

        $this->postJson('/auth/magic-link', ['email' => 'existant@example.com'])->assertOk();
        Mail::assertSent(MagicLinkMail::class);

        Mail::fake();
        $this->postJson('/auth/magic-link', ['email' => 'nouveau@example.com'])->assertOk();
        Mail::assertNothingSent();
    }

    public function test_invalid_token_redirects_with_error(): void
    {
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
