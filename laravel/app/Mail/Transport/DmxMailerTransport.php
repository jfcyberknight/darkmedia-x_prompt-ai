<?php

namespace App\Mail\Transport;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\MessageConverter;

/**
 * Transport Mail Laravel « dmxmailer » : délègue l'envoi au service e-mail privé
 * du VPS (dmx-mailer, http://dmx-mailer:8080) au lieu d'un SMTP direct. L'app ne
 * détient plus de secret SMTP — seulement la clé d'API du service.
 *
 * Le message Symfony (déjà rendu par le Mailable) est traduit vers le contrat
 * natif `POST /api/send` du service.
 */
class DmxMailerTransport extends AbstractTransport
{
    public function __construct(
        private string $baseUrl,
        private ?string $apiKey,
        private int $timeout = 20,
    ) {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());

        $to = array_map(
            fn ($addr) => array_filter([
                'email' => $addr->getAddress(),
                'name' => $addr->getName() ?: null,
            ]),
            $email->getTo(),
        );

        $from = $email->getFrom()[0] ?? null;
        $replyTo = $email->getReplyTo()[0] ?? null;

        $attachments = [];
        foreach ($email->getAttachments() as $part) {
            $attachments[] = [
                'name' => $part->getFilename() ?: 'attachment',
                'contentBase64' => base64_encode($part->getBody()),
                'contentType' => $part->getMediaType().'/'.$part->getMediaSubtype(),
            ];
        }

        $payload = array_filter([
            'to' => $to,
            'subject' => $email->getSubject() ?? '',
            'html' => $email->getHtmlBody(),
            'text' => $email->getTextBody(),
            'from' => $from ? array_filter([
                'email' => $from->getAddress(),
                'name' => $from->getName() ?: null,
            ]) : null,
            'replyTo' => $replyTo ? array_filter([
                'email' => $replyTo->getAddress(),
                'name' => $replyTo->getName() ?: null,
            ]) : null,
            'attachments' => $attachments ?: null,
        ], fn ($v) => $v !== null);

        $request = Http::timeout($this->timeout)->acceptJson();
        if ($this->apiKey) {
            $request = $request->withHeaders(['X-API-Key' => $this->apiKey]);
        }

        $response = $request->post(rtrim($this->baseUrl, '/').'/api/send', $payload);

        if ($response->failed()) {
            throw new TransportException(
                "dmx-mailer a répondu HTTP {$response->status()} : ".$response->body()
            );
        }
    }

    public function __toString(): string
    {
        return 'dmxmailer://'.(parse_url($this->baseUrl, PHP_URL_HOST) ?: 'dmx-mailer');
    }
}
