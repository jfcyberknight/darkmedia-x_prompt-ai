<?php

namespace Tests\Unit;

use App\Mail\MagicLinkMail;
use Tests\TestCase;

class MagicLinkMailTest extends TestCase
{
    public function test_mail_has_correct_subject_and_view(): void
    {
        $mail = new MagicLinkMail('https://example.com/login?token=abc', 15);

        $envelope = $mail->envelope();
        $content = $mail->content();

        $this->assertSame('Votre lien de connexion — DarkMedia Prompt AI', $envelope->subject);
        $this->assertSame('emails.magic-link', $content->view);
        $this->assertSame('https://example.com/login?token=abc', $mail->loginUrl);
        $this->assertSame(15, $mail->expirationMinutes);
    }
}
