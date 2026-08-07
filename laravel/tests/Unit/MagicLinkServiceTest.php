<?php

namespace Tests\Unit;

use App\Services\MagicLinkService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MagicLinkServiceTest extends TestCase
{
    private MagicLinkService $service;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.magiclink.url' => 'http://dmx-magiclink.test']);
        config(['services.magiclink.key' => 'mlk_test']);
        $this->service = new MagicLinkService();
    }

    public function test_issue_returns_token_on_success(): void
    {
        Http::fake([
            'dmx-magiclink.test/links' => Http::response(['token' => 'abc-123'], 200),
        ]);

        $this->assertSame('abc-123', $this->service->issue('test@example.com', 15));
    }

    public function test_issue_returns_null_on_connection_error(): void
    {
        Http::fake(['*' => Http::response([], 500)]);

        $this->assertNull($this->service->issue('test@example.com', 15));
    }

    public function test_issue_returns_null_on_non_200_status(): void
    {
        Http::fake([
            'dmx-magiclink.test/links' => Http::response(['error' => 'rate limit'], 429),
        ]);

        $this->assertNull($this->service->issue('test@example.com', 15));
    }

    public function test_status_returns_false_for_empty_token(): void
    {
        $this->assertFalse($this->service->status(''));
    }

    public function test_status_returns_true_when_valid(): void
    {
        Http::fake([
            'dmx-magiclink.test/links/status*' => Http::response(['valid' => true], 200),
        ]);

        $this->assertTrue($this->service->status('abc-123'));
    }

    public function test_status_returns_false_on_connection_error(): void
    {
        Http::fake(['*' => Http::response([], 500)]);

        $this->assertFalse($this->service->status('abc-123'));
    }

    public function test_consume_returns_email_on_success(): void
    {
        Http::fake([
            'dmx-magiclink.test/links/consume' => Http::response(['email' => 'test@example.com'], 200),
        ]);

        $this->assertSame('test@example.com', $this->service->consume('abc-123'));
    }

    public function test_consume_returns_null_for_empty_token(): void
    {
        $this->assertNull($this->service->consume(''));
    }

    public function test_consume_returns_null_on_non_200_status(): void
    {
        Http::fake([
            'dmx-magiclink.test/links/consume' => Http::response(['error' => 'already used'], 410),
        ]);

        $this->assertNull($this->service->consume('abc-123'));
    }
}
