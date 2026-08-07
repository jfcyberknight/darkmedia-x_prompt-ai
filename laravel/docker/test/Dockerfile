# Image de TEST locale uniquement (pipeline `make test` — voir Makefile), pas
# de rapport avec l'image de prod (../Dockerfile, PHP-FPM+nginx, --no-dev).
# L'hôte du VPS n'a que PHP 8.3 ; composer.lock exige 8.4+.
FROM php:8.4-cli-alpine

RUN apk add --no-cache \
        git unzip icu-dev libzip-dev postgresql-dev oniguruma-dev sqlite-dev \
        $PHPIZE_DEPS \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql pdo_pgsql pdo_sqlite intl zip bcmath mbstring opcache \
    && pecl install pcov \
    && docker-php-ext-enable pcov \
    && rm -rf /var/cache/apk/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
