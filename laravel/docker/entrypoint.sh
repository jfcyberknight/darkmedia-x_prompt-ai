#!/bin/sh
set -e

cd /var/www/html

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
