<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Authentification par magic link
    |--------------------------------------------------------------------------
    |
    | allowed_emails : liste d'adresses (séparées par des virgules dans l'env
    | MAGIC_LINK_ALLOWED_EMAILS) autorisées à recevoir un lien de connexion.
    | Un compte est créé automatiquement à la première connexion pour ces
    | adresses. Si la liste est vide, seuls les utilisateurs déjà présents en
    | base peuvent se connecter (aucune inscription ouverte).
    |
    */

    'allowed_emails' => array_values(array_filter(array_map(
        fn ($email) => strtolower(trim($email)),
        explode(',', (string) env('MAGIC_LINK_ALLOWED_EMAILS', ''))
    ))),

    // Durée de validité du lien de connexion, en minutes.
    'expiration_minutes' => (int) env('MAGIC_LINK_EXPIRATION_MINUTES', 15),

];
