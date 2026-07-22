# 🚀 Déploiement VPS — DarkMedia Prompt AI (Laravel)

Application Laravel conteneurisée : PHP-FPM 8.4 + nginx dans une seule image,
base SQLite persistée dans un volume, authentification par **magic link**
(aucun mot de passe).

## Démarrage rapide sur le VPS

```bash
# 1. Récupérer le code
git clone https://github.com/jfcyberknight/darkmedia-x_prompt-ai.git
cd darkmedia-x_prompt-ai/laravel

# 2. Configurer l'environnement
cp .env.docker.example .env.docker
nano .env.docker   # SMTP, MAGIC_LINK_ALLOWED_EMAILS, clés IA, APP_URL

# 3. Construire et lancer
docker compose up -d --build

# 4. Vérifier
curl http://localhost:8080/up   # → 200 OK
```

Au premier démarrage, l'entrypoint :
- génère et persiste `APP_KEY` dans le volume (si non fournie) ;
- crée la base SQLite dans `/data/database.sqlite` ;
- exécute les migrations et le seeder (catégories par défaut + prompts d'exemple) ;
- met en cache config/routes/vues.

## Variables indispensables

| Variable | Rôle |
| :--- | :--- |
| `APP_URL` | URL publique (utilisée dans les liens des emails) |
| `DOPPLER_TOKEN` | Service Token Doppler — injecte SMTP + clés IA au démarrage (voir ci-dessous) |
| `MAGIC_LINK_ALLOWED_EMAILS` | Adresses autorisées, séparées par des virgules ; compte créé automatiquement à la première connexion |
| `MAIL_*` | SMTP — fourni par Doppler ; sans email configuré, aucun magic link ne part (`MAIL_MAILER=log` pour tester : le lien s'écrit dans les logs) |
| `GEMINI_API_KEY` … | Clés provider IA — fournies par Doppler |

## Secrets via Doppler

Le SMTP et les clés IA sont gérés dans **Doppler**, comme pour les autres projets.
Le conteneur embarque le CLI Doppler : si vous fournissez un `DOPPLER_TOKEN`,
l'entrypoint relance l'app sous `doppler run` et **injecte tous les secrets du
config Doppler en variables d'environnement au démarrage** (les valeurs Doppler
priment sur celles de `.env.docker`).

1. Dans le dashboard Doppler, ouvrez le projet/config de cette app et vérifiez
   que les secrets SMTP y sont, aux noms natifs Laravel : `MAIL_MAILER`,
   `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SCHEME`
   (`tls`/`ssl`/`null`), `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`. (Idéalement, les
   clés IA — `GEMINI_API_KEY`, etc. — y vivent aussi.)
2. Créez un **Service Token** (Access → Service Tokens) lié à ce config.
3. Renseignez-le comme `DOPPLER_TOKEN` dans `.env.docker`, puis
   `docker compose up -d --build`.

Le token porte déjà le projet et l'environnement — rien d'autre à préciser.
Sans `DOPPLER_TOKEN`, le conteneur retombe sur les valeurs `MAIL_*` / `*_API_KEY`
que vous auriez renseignées directement dans `.env.docker`.

Vérifier l'injection : `docker logs prompt-ai | grep Doppler` doit afficher
« Injection des secrets via Doppler… » au démarrage.

## Intégration au reverse-proxy du VPS

Le conteneur écoute en HTTP sur le port `8080` (configurable via `APP_PORT`) et
fait confiance aux en-têtes `X-Forwarded-*` : placez-le derrière votre
reverse-proxy qui termine le TLS.

**Traefik** : décommenter les labels d'exemple dans `docker-compose.yml`.

**nginx sur l'hôte** :

```nginx
server {
    server_name prompts.mondomaine.fr;
    listen 443 ssl http2;
    # ... certificats ...

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Caddy** :

```
prompts.mondomaine.fr {
    reverse_proxy 127.0.0.1:8080
}
```

## Base de données

- **SQLite (défaut)** : zéro dépendance, fichier dans le volume `prompt_ai_data`.
- **MySQL / PostgreSQL** : renseigner `DB_CONNECTION`, `DB_HOST`, etc. dans
  `.env.docker` (les drivers `pdo_mysql` et `pdo_pgsql` sont inclus dans l'image).

## Sauvegarde

Tout l'état persistant vit dans le volume `prompt_ai_data` :

```bash
docker run --rm -v prompt-ai_prompt_ai_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/prompt-ai-backup.tar.gz -C /data .
```

## Mise à jour

```bash
git pull
docker compose up -d --build   # migrations rejouées automatiquement au démarrage
```

## Connexion (magic link)

1. Ouvrir l'app → saisir son email (doit figurer dans `MAGIC_LINK_ALLOWED_EMAILS`).
2. Recevoir l'email « Votre lien de connexion » et cliquer (validité 15 min, usage unique).
3. La session dure 120 min d'inactivité (cookie « remember me » longue durée inclus).

## Développement local (sans Docker)

```bash
composer install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
php artisan serve   # http://localhost:8000 — magic links dans storage/logs/laravel.log
```
