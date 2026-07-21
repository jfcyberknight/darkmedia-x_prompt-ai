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

    'default_models' => [
        'gemini' => 'gemini-2.0-flash',
        'anthropic' => 'claude-haiku-4-5',
        'openai' => 'gpt-4o-mini',
        'deepseek' => 'deepseek-chat',
        'opencode' => 'gpt-4o-mini',
        'openrouter' => env('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free'),
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
            'meta-llama/llama-3.3-70b-instruct:free',
            'openai/gpt-oss-120b:free',
            'qwen/qwen3-next-80b-a3b-instruct:free',
            'deepseek/deepseek-chat-v3-0324',
            'openai/gpt-4o-mini',
            'google/gemini-2.5-flash',
            'anthropic/claude-sonnet-5',
            'anthropic/claude-opus-4-8',
            'openrouter/fusion',
            'openrouter/free', // compat : anciennes configs sauvegardées côté client
        ],
    ],

    'timeout_seconds' => (int) env('AI_TIMEOUT_SECONDS', 45),

];
