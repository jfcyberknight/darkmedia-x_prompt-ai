<?php

namespace Tests\Unit;

use App\Mail\Transport\DmxMailerTransport;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class DmxMailerTransportTest extends TestCase
{
    public function test_send_builds_payload_without_key(): void
    {
        Http::fake([
            'dmx-mailer.test/api/send' => Http::response(['ok' => true], 200),
        ]);

        $transport = new DmxMailerTransport('http://dmx-mailer.test', null);

        $email = (new Email())
            ->to(new Address('jf@example.com', 'Jean-François'))
            ->from(new Address('app@example.com'))
            ->replyTo(new Address('reply@example.com'))
            ->subject('Test')
            ->html('<p>Hello</p>')
            ->text('Hello');

        $envelope = new Envelope(
            new Address('app@example.com'),
            [new Address('jf@example.com', 'Jean-François')]
        );

        $transport->send($email, $envelope);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return $request->url() === 'http://dmx-mailer.test/api/send'
                && $body['subject'] === 'Test'
                && $body['to'][0]['email'] === 'jf@example.com'
                && $body['to'][0]['name'] === 'Jean-François'
                && $body['html'] === '<p>Hello</p>'
                && $body['text'] === 'Hello'
                && $body['from']['email'] === 'app@example.com'
                && $body['replyTo']['email'] === 'reply@example.com';
        });
    }

    public function test_send_includes_api_key_when_configured(): void
    {
        Http::fake([
            'dmx-mailer.test/api/send' => Http::response(['ok' => true], 200),
        ]);

        $transport = new DmxMailerTransport('http://dmx-mailer.test', 'secret-key');

        $email = (new Email())
            ->to(new Address('jf@example.com'))
            ->from(new Address('app@example.com'))
            ->subject('Test')
            ->text('Hello');

        $envelope = new Envelope(new Address('app@example.com'), [new Address('jf@example.com')]);

        $transport->send($email, $envelope);

        Http::assertSent(function ($request) {
            return $request->hasHeader('X-API-Key', 'secret-key');
        });
    }

    public function test_send_throws_on_failure(): void
    {
        Http::fake([
            'dmx-mailer.test/api/send' => Http::response(['error' => 'down'], 503),
        ]);

        $transport = new DmxMailerTransport('http://dmx-mailer.test', null);

        $email = (new Email())
            ->to(new Address('jf@example.com'))
            ->from(new Address('app@example.com'))
            ->subject('Test')
            ->text('Hello');

        $envelope = new Envelope(new Address('app@example.com'), [new Address('jf@example.com')]);

        $this->expectException(\Symfony\Component\Mailer\Exception\TransportException::class);

        $transport->send($email, $envelope);
    }

    public function test_to_string_uses_host(): void
    {
        $transport = new DmxMailerTransport('http://dmx-mailer.test:8080', null);

        $this->assertSame('dmxmailer://dmx-mailer.test', (string) $transport);
    }

    public function test_to_string_defaults_to_dmx_mailer(): void
    {
        $transport = new DmxMailerTransport('', null);

        $this->assertSame('dmxmailer://dmx-mailer', (string) $transport);
    }
}
