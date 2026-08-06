<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Microservice partagé (jfcyberknight/microservices-port-adapter) qui
    // génère/hache/expire/consomme les jetons de lien magique. Sur le VPS,
    // pointe vers l'hôte interne dmx-net (aucun port public) ; en local,
    // vers une instance lancée à côté (voir README de ce dépôt).
    'magiclink' => [
        'url' => env('MAGICLINK_SERVICE_URL', 'http://localhost:3001'),
        'key' => env('MAGICLINK_SERVICE_KEY'),
    ],

];
