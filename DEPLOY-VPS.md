# Deploiement VPS -- DarkMedia Prompt AI

Deploiement continu sur le VPS OVH partage `vps-c4db969c.vps.ovh.ca`, aligne
sur la convention des autres apps du proprietaire (voir
[`vps-ovh`](https://github.com/jfcyberknight/vps-ovh)) : **push sur `main` ->
CI (PHPUnit) -> SSH -> `docker compose`**, exposition publique via **Cloudflare
Tunnel** uniquement.

> Regle d'or du VPS : **80/443 = CityPulse uniquement.** Cette app ne mappe
> aucun port public ; elle est joignable via le tunnel
> `promptai.darkmedia-x.com` et publie seulement un port loopback `8092`
> (diagnostic local `curl http://localhost:8092/up`).

## Pipeline

`.github/workflows/deploy-vps.yml` :

1. **`ci`** -- installe PHP 8.4 + dependances, prepare un `.env` SQLite,
   lance `php artisan test`. Barriere : rien ne se deploie si les tests echouent.
2. **`deploy`** (sur `main`, si `ci` vert) -- SSH sur le VPS : `git reset --hard`
   sur la branche de deploiement, (re)configure le tunnel Cloudflare via
   `scripts/setup-cloudflare-tunnel.sh`, puis
   `docker compose -f laravel/docker-compose.vps.yml up -d --build`.

L'app se construit dans une image unique (PHP-FPM + nginx). Au demarrage,
`docker/entrypoint.sh` genere/persiste `APP_KEY` dans le volume, cree la base
SQLite, joue migrations + seed, met en cache config/routes/vues.

## Secrets et variables GitHub (Settings -> Secrets and variables -> Actions)

| Nom | Type | Role | Defaut |
| :-- | :-- | :-- | :-- |
| `VPS_SSH_KEY` | Secret | Cle privee SSH autorisee sur le VPS | (requis) |
| `VPS_KNOWN_HOSTS` | Secret | `known_hosts` strict (sinon TOFU) | optionnel |
| `CF_API_TOKEN` | Secret | Jeton Cloudflare : `Account.Cloudflare Tunnel.Edit` + `Zone.DNS.Edit` | (requis tunnel) |
| `CF_ACCOUNT_ID` | Secret/Var | ID de compte Cloudflare | (requis tunnel) |
| `CF_TUNNEL_HOSTNAME` | Secret/Var | Sous-domaine public | `promptai.darkmedia-x.com` |
| `VPS_HOST` | Var | Hote SSH | `vps-c4db969c.vps.ovh.ca` |
| `VPS_USER` | Var | Utilisateur SSH | `ubuntu` |
| `VPS_PORT` | Var | Port SSH | `22` |
| `VPS_APP_PATH` | Var | Chemin du clone sur le VPS | `/opt/darkmedia-x_prompt-ai` |
| `DEPLOY_BRANCH` | Var | Branche deployee | `main` |

## Premiere mise en ligne (une seule fois, sur le VPS)

Le workflow met a jour un clone existant ; le clone initial et le `.env` de
prod se font a la main :

```bash
# 1. Cloner le depot au chemin attendu
sudo mkdir -p /opt/darkmedia-x_prompt-ai
sudo chown "$USER":"$USER" /opt/darkmedia-x_prompt-ai
git clone https://github.com/jfcyberknight/darkmedia-x_prompt-ai.git /opt/darkmedia-x_prompt-ai
cd /opt/darkmedia-x_prompt-ai/laravel

# 2. Provisionner le .env de prod (secrets runtime)
cp .env.vps.example .env
nano .env   # SMTP, MAGIC_LINK_ALLOWED_EMAILS, au moins une cle IA
```

Ensuite, un push sur `main` (ou un `workflow_dispatch`) suffit : la CI passe,
le deploiement SSH configure le tunnel et lance la stack. Le `.env` est
preserve d'un deploiement a l'autre (sauvegarde/restauration autour du
`git reset`).

## Verification

```bash
# Sur le VPS : sante locale (loopback)
curl -fsS http://localhost:8092/up
# Publiquement, apres propagation du tunnel (~1 min) :
curl -fsS https://promptai.darkmedia-x.com/up
```
