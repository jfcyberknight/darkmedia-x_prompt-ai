<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Proxy IA multi-providers
    |--------------------------------------------------------------------------
    |
    | Portage de la fonction Edge Supabase « ai-proxy ». Les clés sont lues
    | dans l'environnement ; seule leur présence (booléen) est exposée au
    | client, jamais leur valeur.
    |
    */

    'keys' => [
        'gemini' => env('GEMINI_API_KEY', ''),
        'anthropic' => env('ANTHROPIC_API_KEY', ''),
        'openai' => env('OPENAI_API_KEY', ''),
        'deepseek' => env('DEEPSEEK_API_KEY', ''),
        'opencode' => env('OPENCODE_API_KEY', ''),
        'openrouter' => env('OPENROUTER_API_KEY', ''),
    ],

    'opencode_base_url' => env('OPENCODE_BASE_URL', 'https://api.openai.com/v1'),
    'openrouter_base_url' => env('OPENROUTER_API_URL', 'https://openrouter.ai/api/v1'),

    // Provider sélectionné par défaut côté serveur quand la requête n'en précise
    // aucun (le front en envoie toujours un, mais on garde une valeur cohérente
    // avec les clés réellement configurées).
    'default_provider' => env('AI_DEFAULT_PROVIDER', 'openrouter'),

    'default_models' => [
        'gemini' => 'gemini-2.0-flash',
        'anthropic' => 'claude-haiku-4-5',
        'openai' => 'gpt-4o-mini',
        'deepseek' => 'deepseek-chat',
        'opencode' => 'gpt-4o-mini',
        // Le tier gratuit OpenRouter (:free) a été retiré : on part sur un modèle
        // payant très économique par défaut. Surchargeable via OPENROUTER_MODEL.
        'openrouter' => env('OPENROUTER_MODEL', 'deepseek/deepseek-chat-v3-0324'),
    ],

    // Miroir du menu déroulant côté client. Sans cette liste, un utilisateur
    // authentifié pourrait demander n'importe quel identifiant de modèle
    // (modèle premium coûteux, ou valeur piégée interpolée dans l'URL Gemini).
    'allowed_models' => [
        'gemini' => ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
        'anthropic' => ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'],
        'openai' => ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1'],
        'deepseek' => ['deepseek-chat', 'deepseek-reasoner'],
        'opencode' => ['gpt-4o-mini', 'gpt-4o'],
        'openrouter' => [
            'deepseek/deepseek-chat-v3-0324',
            'openai/gpt-4o-mini',
            'google/gemini-2.5-flash',
            'meta-llama/llama-3.3-70b-instruct',
            'anthropic/claude-sonnet-5',
            'anthropic/claude-opus-4-8',
            'openrouter/fusion',
            // Compat : anciennes sélections « :free » sauvegardées côté client.
            // Le tier gratuit a été retiré par OpenRouter → remappées vers le
            // modèle payant par défaut dans resolveModel().
            'meta-llama/llama-3.3-70b-instruct:free',
            'openrouter/free',
        ],
    ],

    'timeout_seconds' => (int) env('AI_TIMEOUT_SECONDS', 45),

];
