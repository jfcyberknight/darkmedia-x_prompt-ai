#!/bin/sh
set -e

cd /var/www/html

# Secrets via Doppler (SMTP, clés IA…) — même source que tous les autres projets.
# Si un DOPPLER_TOKEN est fourni, on relance l'entrypoint SOUS `doppler run` : toutes
# les commandes suivantes (dont `config:cache`, qui fige l'environnement dans le cache
# de config lu ensuite par PHP-FPM) voient alors les secrets injectés en variables
# d'environnement. Les secrets Doppler priment sur les valeurs du conteneur ; les
# autres variables (APP_ENV, DB_*, MAGIC_LINK_*…) sont conservées telles quelles.
if [ -n "$DOPPLER_TOKEN" ] && [ -z "$DOPPLER_INJECTED" ]; then
    export DOPPLER_INJECTED=1
    echo "[entrypoint] Injection des secrets via Doppler…"
    exec doppler run --silent -- "$0" "$@"
fi

# APP_KEY est obligatoire (chiffrement des sessions/cookies). En production on
# la fournit via l'environnement ; à défaut, une clé est générée et persistée
# dans /data pour survivre aux redémarrages du conteneur.
if [ -z "$APP_KEY" ]; then
    if [ ! -f /data/app_key ]; then
        php artisan key:generate --show > /data/app_key
        echo "[entrypoint] APP_KEY générée et persistée dans /data/app_key"
    fi
    export APP_KEY="$(cat /data/app_key)"
fi

# Base SQLite dans le volume /data (créée au premier démarrage).
if [ "$DB_CONNECTION" = "sqlite" ]; then
    DB_FILE="${DB_DATABASE:-/data/database.sqlite}"
    if [ ! -f "$DB_FILE" ]; then
        mkdir -p "$(dirname "$DB_FILE")"
        touch "$DB_FILE"
        echo "[entrypoint] Base SQLite créée : $DB_FILE"
    fi
    chown www-data:www-data "$DB_FILE" "$(dirname "$DB_FILE")"
fi

php artisan migrate --force
php artisan db:seed --force

# Caches de production (config/routes/vues) recalculés avec l'environnement réel.
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data storage bootstrap/cache

exec /usr/bin/supervisord -c /etc/supervisord.conf
