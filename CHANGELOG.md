# Changelog
Toutes les modifications notables de ce projet seront documentées dans ce fichier.

## [2.0.0] - 21 juillet 2026

### Added
- **Migration complète vers Laravel 13** (`laravel/`) : l'application PWA de gestion de prompts tourne désormais en autonome, sans Supabase.
- **Authentification par magic link** : connexion sans mot de passe par lien email signé, à usage unique, avec allowlist d'adresses (`MAGIC_LINK_ALLOWED_EMAILS`) et protection anti-énumération + rate limiting.
- **API REST** session (CSRF) : CRUD prompts, catégories, favoris, compteur d'utilisation, historique de versions.
- **Proxy IA en PHP** : portage de l'Edge Function Deno (Gemini, Anthropic, OpenAI, DeepSeek, OpenCode, OpenRouter avec chaîne de repli des modèles gratuits, allowlist de modèles, extraction JSON robuste).
- **Versioning automatique des prompts** côté Eloquent (miroir du trigger Postgres d'origine).
- **Conteneurisation prête VPS** : image unique PHP-FPM 8.4 + nginx + supervisord (worker de queue inclus), `docker-compose.yml`, volume persistant SQLite + APP_KEY, healthcheck `/up`, guide `laravel/DEPLOYMENT.md` (Traefik/nginx/Caddy).
- Suite de tests Feature (magic link, API, versioning) — 15 tests.

### Changed
- Le frontend PWA (`laravel/public/`) consomme l'API Laravel via fetch + cookie de session au lieu du SDK Supabase.
- Écran de connexion simplifié : un seul champ email (plus de mot de passe ni de réinitialisation).
- Le service worker ne met plus en cache les routes `/api/` et `/auth/`.

## [1.0.0] - 13 mars 2026

### Added
- Création du système **Prompt-AI** avec 4 rôles experts (`Analyste`, `Architecte`, `Gardien`, `Maestro`).
- Prompt `Architecte de Documentation & Changelog.md` pour le suivi SemVer.
- Prompt `Le Gardien du README.md` pour la cohérence doc/code.
- Prompt `Le Maestro de Flotte GitHub.md` pour l'orchestration multi-dépôts.
- Infrastructure d'automatisation GitHub Actions avec workflow réutilisable.
- Moteur de synchronisation `sync_engine.py` compatible **Gemini 2.0 Flash**.
- Création du `README.md` structuré et de `version.json`.

### Changed
- Refonte visuelle de tous les prompts vers un style Markdown Premium.
- Migration du moteur de synchronisation vers le SDK **google-genai**.
- Implémentation d'un mécanisme d'auto-retry pour gérer les quotas de l'API gratuite.

### Fixed
- Initialisation et configuration complète du dépôt Git/GitHub.
- Correction des erreurs de routage API (404) et d'authentification (401).
