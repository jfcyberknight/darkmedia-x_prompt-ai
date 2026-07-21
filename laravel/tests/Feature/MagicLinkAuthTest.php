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

    public function test_allowed_email_receives_magic_link_and_can_login(): void
    {
        Mail::fake();
        config(['magiclink.allowed_emails' => ['jf@example.com']]);

        $response = $this->postJson('/auth/magic-link', ['email' => 'jf@example.com']);
        $response->assertOk();

        $user = User::where('email', 'jf@example.com')->first();
        $this->assertNotNull($user, "Le compte doit être créé à la volée pour une adresse de l'allowlist");

        $loginUrl = null;
        Mail::assertSent(MagicLinkMail::class, function (MagicLinkMail $mail) use (&$loginUrl) {
            $loginUrl = $mail->loginUrl;

            return true;
        });

        $this->get($loginUrl)->assertRedirect('/');
        $this->assertAuthenticatedAs($user);
    }

    public function test_magic_link_is_single_use(): void
    {
        Mail::fake();
        config(['magiclink.allowed_emails' => ['jf@example.com']]);

        $this->postJson('/auth/magic-link', ['email' => 'jf@example.com']);

        $loginUrl = null;
        Mail::assertSent(MagicLinkMail::class, function (MagicLinkMail $mail) use (&$loginUrl) {
            $loginUrl = $mail->loginUrl;

            return true;
        });

        $this->get($loginUrl)->assertRedirect('/');

        // Seconde utilisation du même lien : session neuve, lien consommé.
        $this->post('/auth/logout');
        $this->flushSession();
        $this->get($loginUrl)->assertRedirect('/?login_error=expired');
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
