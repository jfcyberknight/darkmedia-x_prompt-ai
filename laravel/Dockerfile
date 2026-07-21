# =============================================================================
# DarkMedia Prompt AI — image de production autonome
# PHP-FPM 8.4 + nginx + supervisord dans un seul conteneur, pensé pour être
# placé derrière le reverse-proxy du VPS (Traefik, Caddy, nginx…).
# =============================================================================

# ---- Étape 1 : dépendances PHP (Composer) ----
FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --no-scripts \
    --prefer-dist \
    --ignore-platform-reqs

# ---- Étape 2 : image finale ----
FROM php:8.4-fpm-alpine

# Extensions requises par Laravel + drivers BD (sqlite par défaut, mysql/pgsql
# disponibles pour un usage VPS avec base externe).
RUN apk add --no-cache \
        nginx \
        supervisor \
        sqlite \
        icu-dev \
        libzip-dev \
        postgresql-dev \
        oniguruma-dev \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        pdo_pgsql \
        intl \
        zip \
        bcmath \
        opcache \
    && rm -rf /var/cache/apk/*

WORKDIR /var/www/html

COPY . .
COPY --from=vendor /app/vendor ./vendor

COPY docker/php.ini /usr/local/etc/php/conf.d/99-app.ini
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh

# Autoload optimisé (les scripts composer ont été sautés à l'étape vendor,
# artisan n'y était pas encore disponible).
COPY --from=vendor /usr/bin/composer /usr/local/bin/composer
RUN composer dump-autoload --optimize --no-dev --no-interaction \
    && rm -f /usr/local/bin/composer \
    && chmod +x /entrypoint.sh \
    && mkdir -p /data storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache database /data

# Valeurs de production par défaut — surchargées par docker-compose / l'env du VPS.
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    DB_CONNECTION=sqlite \
    DB_DATABASE=/data/database.sqlite

EXPOSE 8080

# La base SQLite et les fichiers persistants vivent dans /data (volume).
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/up || exit 1

ENTRYPOINT ["/entrypoint.sh"]
