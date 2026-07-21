# DarkMedia Prompt AI — Application Laravel

Bibliothèque privée de prompts IA (PWA installable) avec assistance multi-providers,
migrée depuis Supabase vers une application **Laravel 13 autonome**.

## Fonctionnalités

- 🔑 **Authentification par magic link** : connexion sans mot de passe par lien
  email signé, à usage unique (15 min), restreinte à une allowlist d'adresses.
- 📚 **Gestion de prompts** : catégories colorées, tags, favoris, compteur
  d'utilisation, recherche/tri, historique de versions automatique.
- 🤖 **Proxy IA** : extraction et amélioration de prompts via Gemini, Anthropic,
  OpenAI, DeepSeek, OpenCode ou OpenRouter (clés côté serveur uniquement,
  allowlist de modèles, chaîne de repli des modèles gratuits OpenRouter).
- 📱 **PWA** : installable, cache hors-ligne, service worker versionné.
- 🐳 **Conteneur unique** : PHP-FPM 8.4 + nginx + supervisord, SQLite persistée
  dans un volume, healthcheck `/up`, prêt à s'intégrer derrière le
  reverse-proxy d'un VPS.

## Démarrage

```bash
# Docker (production / VPS)
cp .env.docker.example .env.docker   # SMTP, MAGIC_LINK_ALLOWED_EMAILS, clés IA
docker compose up -d --build         # → http://localhost:8080

# Développement local
composer install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate --seed
php artisan serve                    # magic links visibles dans storage/logs/laravel.log
```

Guide de déploiement VPS complet : [DEPLOYMENT.md](DEPLOYMENT.md)

## Tests

```bash
php artisan test        # 15 tests Feature (auth magic link, API, versioning)
./vendor/bin/pint       # style de code
```
