<?php

namespace Tests\Unit;

use App\Services\AiProxyService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiProxyServiceTest extends TestCase
{
    private AiProxyService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new AiProxyService();
    }

    public function test_key_status_reports_presence_not_values(): void
    {
        config(['ai.keys' => [
            'gemini' => 'secret',
            'openai' => '',
            'anthropic' => null,
        ]]);

        $this->assertSame([
            'gemini' => true,
            'openai' => false,
            'anthropic' => false,
        ], $this->service->keyStatus());
    }

    public function test_resolve_model_uses_requested_model(): void
    {
        config(['ai.default_models' => ['gemini' => 'gemini-default']]);

        $this->assertSame('custom-model', $this->service->resolveModel('gemini', 'custom-model'));
    }

    public function test_resolve_model_falls_back_to_default(): void
    {
        config(['ai.default_models' => ['gemini' => 'gemini-default', 'openrouter' => 'or-default']]);

        $this->assertSame('gemini-default', $this->service->resolveModel('gemini', ''));
        $this->assertSame('or-default', $this->service->resolveModel('openrouter', ''));
    }

    public function test_resolve_model_falls_back_to_gemini_for_unknown_provider(): void
    {
        config(['ai.default_models' => ['gemini' => 'gemini-default', 'openrouter' => 'or-default']]);

        $this->assertSame('gemini-default', $this->service->resolveModel('unknown', ''));
    }

    public function test_resolve_model_maps_openrouter_free_aliases(): void
    {
        config(['ai.default_models' => ['openrouter' => 'openai/gpt-4o']]);

        $this->assertSame('deepseek/deepseek-chat-v3-0324', $this->service->resolveModel('openrouter', 'openrouter/free'));
        $this->assertSame('deepseek/deepseek-chat-v3-0324', $this->service->resolveModel('openrouter', 'some:free'));
    }

    public function test_is_model_allowed(): void
    {
        config(['ai.allowed_models' => [
            'gemini' => ['gemini-pro', 'gemini-flash'],
            'openrouter' => ['openai/gpt-4o'],
        ]]);

        $this->assertTrue($this->service->isModelAllowed('gemini', 'gemini-pro'));
        $this->assertFalse($this->service->isModelAllowed('gemini', 'unknown'));
        $this->assertFalse($this->service->isModelAllowed('unknown', 'gemini-pro'));
    }

    public function test_is_known_provider(): void
    {
        config(['ai.default_models' => ['gemini' => 'x', 'openai' => 'y']]);

        $this->assertTrue($this->service->isKnownProvider('gemini'));
        $this->assertFalse($this->service->isKnownProvider('unknown'));
    }

    public function test_run_with_gemini_returns_json_string(): void
    {
        config(['ai.keys.gemini' => 'test-key']);
        config(['ai.timeout_seconds' => 5]);

        Http::fake([
            '*' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [['text' => '{"title":"Titre","content":"Contenu"}']],
                    ],
                ]],
            ], 200),
        ]);

        $result = $this->service->run('gemini', 'extract', 'texte', '', 'gemini-model', 500);

        $this->assertSame('{"title":"Titre","content":"Contenu"}', $result);
    }

    public function test_run_extracts_json_from_markdown_wrapped_openai_response(): void
    {
        config(['ai.keys.openai' => 'test-key']);

        Http::fake([
            '*' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => "Voici le résultat :\n```json\n{\"title\": \"T\"}\n```",
                    ],
                ]],
            ], 200),
        ]);

        $result = $this->service->run('openai', 'extract', 'texte', '', 'gpt-4o', 500);

        $this->assertSame('{"title": "T"}', $result);
    }

    public function test_run_extracts_first_embedded_json(): void
    {
        config(['ai.keys.anthropic' => 'test-key']);

        Http::fake([
            '*' => Http::response([
                'content' => [[
                    'text' => 'Préambule {"title": "T", "nested": {}} et du texte après.',
                ]],
            ], 200),
        ]);

        $result = $this->service->run('anthropic', 'extract', 'texte', '', 'claude', 500);

        $this->assertSame('{"title": "T", "nested": {}}', $result);
    }

    public function test_run_throws_when_response_contains_no_json(): void
    {
        config(['ai.keys.anthropic' => 'test-key']);

        Http::fake([
            '*' => Http::response([
                'content' => [['text' => 'Pas de JSON ici']],
            ], 200),
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Réponse du modèle sans JSON exploitable');

        $this->service->run('anthropic', 'extract', 'texte', '', 'claude', 500);
    }

    public function test_run_with_unknown_provider_throws(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Provider inconnu : unknown');

        $this->service->run('unknown', 'extract', 'texte', '', 'model', 500);
    }

    public function test_run_throws_on_api_error(): void
    {
        config(['ai.keys.gemini' => 'test-key']);

        Http::fake([
            '*' => Http::response(['error' => 'rate limit'], 429),
        ]);

        $this->expectException(\RuntimeException::class);

        $this->service->run('gemini', 'extract', 'texte', '', 'gemini-model', 500);
    }

    public function test_run_upgrade_appends_instruction(): void
    {
        config(['ai.keys.gemini' => 'test-key']);
        config(['ai.timeout_seconds' => 5]);

        Http::fake(function ($request) {
            $body = $request->body();
            $this->assertStringContainsString("CONSIGNES PRIORITAIRES DE L'UTILISATEUR", $body);
            $this->assertStringContainsString('sois concis', $body);

            return Http::response([
                'candidates' => [[
                    'content' => ['parts' => [['text' => '{"title":"Titre"}']]],
                ]],
            ], 200);
        });

        $this->service->run('gemini', 'upgrade', 'texte', 'sois concis', 'gemini-model', 500);
    }

    public function test_run_openrouter_uses_paid_fallback_when_primary_fails(): void
    {
        config(['ai.keys.openrouter' => 'test-key']);

        Http::fake([
            'openrouter.ai/api/v1/chat/completions' => Http::sequence()
                ->push(['error' => 'model not found'], 404)
                ->push([
                    'choices' => [[
                        'message' => ['content' => '{"title":"OK"}'],
                    ]],
                ], 200),
        ]);

        $result = $this->service->run('openrouter', 'extract', 'texte', '', 'model-quiva-échouer', 500);

        $this->assertSame('{"title":"OK"}', $result);
    }
}
