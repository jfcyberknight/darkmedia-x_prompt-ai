<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Portage PHP de la fonction Edge Supabase « ai-proxy » : appel d'un provider
 * LLM (Gemini, Anthropic, OpenAI, DeepSeek, OpenCode, OpenRouter) pour
 * extraire ou améliorer un prompt, avec réponse JSON structurée.
 */
class AiProxyService
{
    private const SYSTEM_PROMPT = <<<'PROMPT'
Tu es un assistant qui extrait des informations structurées depuis un texte brut décrivant un ou plusieurs prompts IA.
Retourne UNIQUEMENT un objet JSON valide avec ces champs :
- title: string (titre court et descriptif, max 100 caractères)
- content: string (le contenu du prompt, propre et bien formaté)
- description: string (description courte de ce que fait ce prompt, max 200 caractères)
- tags: array of strings (mots-clés pertinents, max 8, en minuscules, sans espaces)
- model: string (modèle IA mentionné dans le texte, sinon chaîne vide)
- source: string (source ou origine mentionnée, sinon chaîne vide)
- category: string (la catégorie la plus appropriée parmi : Général, Documentation, Code, Analyse, Créatif, Automatisation, Débogage, Formation)
Si plusieurs prompts sont détectés, extrais le plus important ou le premier.
PROMPT;

    private const UPGRADE_PROMPT = <<<'PROMPT'
Tu es un ingénieur de prompt IA expert. Ton rôle est d'analyser le prompt fourni et de l'améliorer/optimiser (l'upgrader) pour qu'il donne de bien meilleurs résultats avec les LLM modernes.
Rends-le plus précis, ajoute des consignes structurées, utilise des délimiteurs (comme XML ou Markdown) si nécessaire, et améliore la clarté globale.
Retourne UNIQUEMENT un objet JSON valide avec ces champs :
- title: string (titre court et descriptif du prompt amélioré, max 100 caractères)
- content: string (le contenu du prompt entièrement amélioré et optimisé, propre et bien formaté)
- description: string (description courte de ce que fait ce prompt, max 200 caractères)
- tags: array of strings (mots-clés pertinents, max 8, en minuscules, sans espaces)
- model: string (modèle IA recommandé ou inchangé, sinon chaîne vide)
- source: string (source ou origine inchangée, sinon chaîne vide)
- category: string (la catégorie la plus appropriée parmi : Général, Documentation, Code, Analyse, Créatif, Automatisation, Débogage, Formation)
PROMPT;

    /**
     * Modèles gratuits OpenRouter essayés en cascade quand l'utilisateur a
     * choisi un modèle « :free » (souvent en 429/404), puis repli payant très
     * économique qui, lui, répond toujours.
     */
    private const OPENROUTER_FREE_FALLBACKS = [
        'meta-llama/llama-3.3-70b-instruct:free',
        'openai/gpt-oss-120b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
        'nousresearch/hermes-3-llama-3.1-405b:free',
    ];

    private const OPENROUTER_PAID_FALLBACK = 'deepseek/deepseek-chat-v3-0324';

    /**
     * Présence des clés par provider (jamais leur valeur), pour distinguer
     * une clé manquante d'une clé invalide lors du diagnostic.
     *
     * @return array<string, bool>
     */
    public function keyStatus(): array
    {
        return array_map(
            fn ($key) => $key !== '' && $key !== null,
            config('ai.keys')
        );
    }

    public function resolveModel(string $provider, string $requestedModel): string
    {
        $defaults = config('ai.default_models');
        $model = $requestedModel !== '' ? $requestedModel : ($defaults[$provider] ?? $defaults['gemini']);

        // openrouter/free est un routeur aléatoire qui tombe parfois sur un
        // modèle de raisonnement à réponse vide : remplacé par un gratuit fiable.
        if ($provider === 'openrouter' && $model === 'openrouter/free') {
            $model = 'meta-llama/llama-3.3-70b-instruct:free';
        }

        return $model;
    }

    public function isModelAllowed(string $provider, string $requestedModel): bool
    {
        return in_array($requestedModel, config("ai.allowed_models.{$provider}", []), true);
    }

    public function isKnownProvider(string $provider): bool
    {
        return array_key_exists($provider, config('ai.default_models'));
    }

    /**
     * Appelle le provider et retourne la chaîne JSON produite par le modèle.
     */
    public function run(string $provider, string $action, string $text, string $instruction, string $model, int $maxTokens): string
    {
        $systemPrompt = $action === 'upgrade' ? self::UPGRADE_PROMPT : self::SYSTEM_PROMPT;

        if ($action === 'upgrade' && trim($instruction) !== '') {
            $systemPrompt .= "\n\nCONSIGNES PRIORITAIRES DE L'UTILISATEUR pour orienter l'amélioration (respecte-les en priorité) :\n".trim($instruction);
        }

        return match ($provider) {
            'gemini' => $this->callGemini($systemPrompt, $text, $model, $maxTokens),
            'anthropic' => $this->callAnthropic($systemPrompt, $text, $model, $maxTokens),
            'openai' => $this->callOpenAiCompat($systemPrompt, $text, $model, 'https://api.openai.com/v1', config('ai.keys.openai'), 'OPENAI', $maxTokens),
            'deepseek' => $this->callOpenAiCompat($systemPrompt, $text, $model, 'https://api.deepseek.com/v1', config('ai.keys.deepseek'), 'DEEPSEEK', $maxTokens),
            'opencode' => $this->callOpenAiCompat($systemPrompt, $text, $model, config('ai.opencode_base_url'), config('ai.keys.opencode'), 'OPENCODE', $maxTokens),
            'openrouter' => $this->callOpenRouter($systemPrompt, $text, $model, $maxTokens),
            default => throw new RuntimeException("Provider inconnu : {$provider}"),
        };
    }

    private function http(): PendingRequest
    {
        return Http::timeout((int) config('ai.timeout_seconds', 45))
            ->connectTimeout(15);
    }

    private function callGemini(string $systemPrompt, string $text, string $model, int $maxTokens): string
    {
        $key = config('ai.keys.gemini');
        if ($key === '') {
            throw new RuntimeException('GEMINI_API_KEY not configured');
        }

        $response = $this->http()->post(
            "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$key}",
            [
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'contents' => [['role' => 'user', 'parts' => [['text' => $text]]]],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'temperature' => 0.3,
                    'maxOutputTokens' => $maxTokens,
                ],
            ]
        );

        if ($response->failed()) {
            throw new RuntimeException("Gemini API error {$response->status()}: {$response->body()}");
        }

        $content = $response->json('candidates.0.content.parts.0.text');
        if (! is_string($content) || $content === '') {
            throw new RuntimeException('Empty response from Gemini');
        }

        return $content;
    }

    private function callAnthropic(string $systemPrompt, string $text, string $model, int $maxTokens): string
    {
        $key = config('ai.keys.anthropic');
        if ($key === '') {
            throw new RuntimeException('ANTHROPIC_API_KEY not configured');
        }

        $response = $this->http()
            ->withHeaders(['x-api-key' => $key, 'anthropic-version' => '2023-06-01'])
            ->post('https://api.anthropic.com/v1/messages', [
                'model' => $model,
                'max_tokens' => $maxTokens,
                'system' => $systemPrompt,
                'messages' => [['role' => 'user', 'content' => $text]],
            ]);

        if ($response->failed()) {
            throw new RuntimeException("Anthropic API error {$response->status()}: {$response->body()}");
        }

        $content = $response->json('content.0.text');
        if (! is_string($content) || $content === '') {
            throw new RuntimeException('Empty response from Anthropic');
        }

        return $this->extractJsonObject($content);
    }

    /**
     * @param  array{jsonFormat?: bool, extraHeaders?: array<string, string>}  $opts
     */
    private function callOpenAiCompat(
        string $systemPrompt,
        string $text,
        string $model,
        string $baseUrl,
        string $apiKey,
        string $providerName,
        int $maxTokens,
        array $opts = [],
    ): string {
        if ($apiKey === '') {
            throw new RuntimeException("{$providerName} API key not configured");
        }

        $jsonFormat = $opts['jsonFormat'] ?? true;
        $extraHeaders = $opts['extraHeaders'] ?? [];

        $body = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $text],
            ],
            'temperature' => 0.3,
            'max_tokens' => $maxTokens,
        ];

        if ($jsonFormat) {
            $body['response_format'] = ['type' => 'json_object'];
        }

        $response = $this->http()
            ->withToken($apiKey)
            ->withHeaders($extraHeaders)
            ->post(rtrim($baseUrl, '/').'/chat/completions', $body);

        if ($response->failed()) {
            throw new RuntimeException("API error {$response->status()}: {$response->body()}");
        }

        $content = $response->json('choices.0.message.content');
        if (! is_string($content) || $content === '') {
            throw new RuntimeException('Empty response from API');
        }

        return $this->extractJsonObject($content);
    }

    private function callOpenRouter(string $systemPrompt, string $text, string $model, int $maxTokens): string
    {
        $headers = [
            'HTTP-Referer' => config('app.url'),
            'X-Title' => 'DarkMedia Prompt AI',
        ];

        $isFreeSelection = str_ends_with($model, ':free') || $model === 'openrouter/free';
        $candidates = $isFreeSelection
            ? array_values(array_unique([$model, ...self::OPENROUTER_FREE_FALLBACKS, self::OPENROUTER_PAID_FALLBACK]))
            : [$model];

        $errors = [];
        foreach ($candidates as $candidate) {
            try {
                // jsonFormat désactivé : support inégal de response_format dans
                // le pool gratuit ; extractJsonObject() sert de filet de sécurité.
                return $this->callOpenAiCompat($systemPrompt, $text, $candidate, config('ai.openrouter_base_url'), config('ai.keys.openrouter'), 'OPENROUTER', $maxTokens, [
                    'jsonFormat' => false,
                    'extraHeaders' => $headers,
                ]);
            } catch (\Throwable $e) {
                $errors[] = "{$candidate}: {$e->getMessage()}";
            }
        }

        throw new RuntimeException(
            count($candidates) > 1
                ? sprintf("Aucun modèle OpenRouter n'a répondu (%d essayés) — %s", count($candidates), implode(' | ', $errors))
                : ($errors[0] ?? 'Échec OpenRouter')
        );
    }

    /**
     * Certains modèles ignorent la consigne « retourne UNIQUEMENT du JSON » et
     * préfixent leur réponse de texte libre. On extrait le premier objet JSON
     * complet (comptage d'accolades) plutôt que de planter.
     */
    private function extractJsonObject(string $text): string
    {
        $stripped = trim(preg_replace('/^```(?:json)?\s*|\s*```\s*$/i', '', trim($text)));

        json_decode($stripped);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $stripped;
        }

        $start = strpos($stripped, '{');
        if ($start === false) {
            throw new RuntimeException('Réponse du modèle sans JSON exploitable');
        }

        $depth = 0;
        $length = strlen($stripped);
        for ($i = $start; $i < $length; $i++) {
            if ($stripped[$i] === '{') {
                $depth++;
            } elseif ($stripped[$i] === '}') {
                $depth--;
                if ($depth === 0) {
                    $candidate = substr($stripped, $start, $i - $start + 1);
                    json_decode($candidate);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        return $candidate;
                    }
                    break;
                }
            }
        }

        throw new RuntimeException('Réponse du modèle sans JSON exploitable (objet non fermé)');
    }
}
