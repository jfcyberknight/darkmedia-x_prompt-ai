<?php

namespace App\Mail;

use App\Models\Prompt;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PromptMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Prompt $prompt,
        public ?string $senderName = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Prompt : ' . $this->prompt->title,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.prompt',
        );
    }
}
