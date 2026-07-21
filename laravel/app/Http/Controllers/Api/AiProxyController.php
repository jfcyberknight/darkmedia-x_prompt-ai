<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiProxyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class AiProxyController extends Controller
{
    public function __construct(private readonly AiProxyService $ai) {}

    /**
     * Point d'entrée unique du proxy IA (portage de l'Edge Function ai-proxy).
     * Actions : extract (défaut), upgrade, ping. Réservé aux utilisateurs
     * authentifiés (middleware auth sur la route).
     */
    public function __invoke(Request $request): JsonResponse|Response
    {
        $validated = $request->validate([
            'text' => ['nullable', 'string', 'max:100000'],
            'action' => ['nullable', 'string', 'in:extract,upgrade,ping'],
            'provider' => ['nullable', 'string', 'max:40'],
            'model' => ['nullable', 'string', 'max:120'],
            'instruction' => ['nullable', 'string', 'max:10000'],
            'maxTokens' => ['nullable', 'integer'],
            'debug' => ['nullable', 'boolean'],
        ]);

        $action = $validated['action'] ?? 'extract';
        $provider = $validated['provider'] ?? 'gemini';
        $requestedModel = $validated['model'] ?? '';
        $debug = (bool) ($validated['debug'] ?? false);
        $text = $validated['text'] ?? '';
        $instruction = $validated['instruction'] ?? '';

        // Plafond de génération borné entre 16 et 8000 (un test de connexion
        // demande une petite valeur pour une réponse quasi instantanée).
        $maxTokens = min(max((int) ($validated['maxTokens'] ?? 8000) ?: 8000, 16), 8000);

        if (! $this->ai->isKnownProvider($provider)) {
            return response()->json(['error' => "Provider inconnu : {$provider}"], 400);
        }

        if ($requestedModel !== '' && ! $this->ai->isModelAllowed($provider, $requestedModel)) {
            return response()->json(['error' => "Modèle non autorisé pour {$provider} : {$requestedModel}"], 400);
        }

        $model = $this->ai->resolveModel($provider, $requestedModel);

        if ($action === 'ping') {
            return response()->json([
                'ok' => true,
                'provider' => $provider,
                'model' => $model,
                'configured' => $this->ai->keyStatus(),
            ]);
        }

        if ($text === '') {
            return response()->json(['error' => 'text is required'], 400);
        }

        try {
            $content = $this->ai->run($provider, $action, $text, $instruction, $model, $maxTokens);

            return response($content, 200, ['Content-Type' => 'application/json']);
        } catch (\Throwable $e) {
            // Journalisé côté serveur pour diagnostiquer sans exposer le détail
            // de la topologie des clés au client, sauf demande debug explicite.
            Log::error('[ai-proxy] error', [
                'provider' => $provider,
                'action' => $action,
                'model' => $model,
                'error' => $e->getMessage(),
            ]);

            $body = ['error' => $e->getMessage()];
            if ($debug) {
                $body['configured'] = $this->ai->keyStatus();
                $body['model'] = $model;
            }

            return response()->json($body, 500);
        }
    }
}
