#!/usr/bin/env bash
#
# Met en place le HTTPS public via Cloudflare Tunnel -- en UNE commande. Cree le
# tunnel, la route DNS et l'ingress via l'API Cloudflare, ecrit le .env, puis
# (re)deploie. Idempotent : reutilise le tunnel s'il existe.
#
#   CF_API_TOKEN=xxxx CF_ACCOUNT_ID=xxxx ./scripts/setup-cloudflare-tunnel.sh
#
# Variables :
#   CF_API_TOKEN    (requis) jeton API Cloudflare : Account.Cloudflare Tunnel.Edit
#                     + Zone.DNS.Edit (sur la zone du domaine).
#   CF_ACCOUNT_ID   (requis) ID de compte Cloudflare.
#   PUBLIC_HOSTNAME (defaut promptai.darkmedia-x.com) le sous-domaine public.
#                     NB : NE PAS utiliser HOSTNAME (reserve par bash).
#   TUNNEL_NAME     (defaut prompt-ai) nom du tunnel.
#   ORIGIN_SERVICE  (defaut http://app:8080) service interne cible.
#   SKIP_DEPLOY=1   config seule (le workflow lance docker compose lui-meme).
#
# Le .env est ecrit dans le repertoire courant : lancer ce script DEPUIS le
# dossier laravel/ (ou docker-compose.vps.yml et .env vivent).
#
# Prerequis : bash, curl, jq (auto-installe sur Debian/Ubuntu), docker compose.

set -euo pipefail

PUBLIC_HOSTNAME="${PUBLIC_HOSTNAME:-${CF_TUNNEL_HOSTNAME:-promptai.darkmedia-x.com}}"
TUNNEL_NAME="${TUNNEL_NAME:-prompt-ai}"
ORIGIN_SERVICE="${ORIGIN_SERVICE:-http://app:8080}"
API="https://api.cloudflare.com/client/v4"

: "${CF_API_TOKEN:?Definis CF_API_TOKEN (jeton API Cloudflare)}"
: "${CF_ACCOUNT_ID:?Definis CF_ACCOUNT_ID (ID de compte Cloudflare)}"

if ! command -v jq >/dev/null; then
  echo "> 'jq' absent : tentative d'installation..."
  if command -v apt-get >/dev/null; then
    SUDO=""; [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null && SUDO="sudo"
    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq jq || true
  fi
  command -v jq >/dev/null || { echo "ERREUR: 'jq' requis : sudo apt-get install -y jq"; exit 1; }
fi
command -v curl >/dev/null || { echo "ERREUR: 'curl' requis"; exit 1; }

ZONE_NAME="$(echo "$PUBLIC_HOSTNAME" | awk -F. '{print $(NF-1)"."$NF}')"

cf() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" --data "$body"
  else
    curl -sS -X "$method" "$API$path" -H "Authorization: Bearer $CF_API_TOKEN"
  fi
}
check() {
  echo "$1" | jq -e '.success == true' >/dev/null 2>&1 || {
    echo "ERREUR API Cloudflare :"; echo "$1" | jq -r '.errors' 2>/dev/null || echo "$1"; exit 1; }
}

echo "> Zone Cloudflare pour $ZONE_NAME..."
ZONE_JSON="$(cf GET "/zones?name=$ZONE_NAME")"; check "$ZONE_JSON"
ZONE_ID="$(echo "$ZONE_JSON" | jq -r '.result[0].id // empty')"
[ -n "$ZONE_ID" ] || { echo "ERREUR: Zone $ZONE_NAME introuvable sur ce compte."; exit 1; }

echo "> Tunnel << $TUNNEL_NAME >>..."
LIST="$(cf GET "/accounts/$CF_ACCOUNT_ID/cfd_tunnel?name=$TUNNEL_NAME&is_deleted=false")"; check "$LIST"
TUNNEL_ID="$(echo "$LIST" | jq -r '.result[0].id // empty')"
if [ -z "$TUNNEL_ID" ]; then
  echo "  -> creation"
  CREATE="$(cf POST "/accounts/$CF_ACCOUNT_ID/cfd_tunnel" \
    "{\"name\":\"$TUNNEL_NAME\",\"config_src\":\"cloudflare\"}")"; check "$CREATE"
  TUNNEL_ID="$(echo "$CREATE" | jq -r '.result.id')"
else
  echo "  -> deja existant ($TUNNEL_ID)"
fi

echo "> Jeton d'execution du tunnel..."
TOKEN_JSON="$(cf GET "/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token")"; check "$TOKEN_JSON"
TUNNEL_TOKEN="$(echo "$TOKEN_JSON" | jq -r '.result')"

echo "> Configuration de l'ingress ($PUBLIC_HOSTNAME -> $ORIGIN_SERVICE)..."
CFG="$(cf PUT "/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" \
  "{\"config\":{\"ingress\":[{\"hostname\":\"$PUBLIC_HOSTNAME\",\"service\":\"$ORIGIN_SERVICE\"},{\"service\":\"http_status:404\"}]}}")"; check "$CFG"

echo "> Route DNS ($PUBLIC_HOSTNAME -> tunnel)..."
CNAME_TARGET="$TUNNEL_ID.cfargotunnel.com"
REC="$(cf GET "/zones/$ZONE_ID/dns_records?name=$PUBLIC_HOSTNAME")"; check "$REC"
REC_ID="$(echo "$REC" | jq -r '.result[0].id // empty')"
DNS_BODY="{\"type\":\"CNAME\",\"name\":\"$PUBLIC_HOSTNAME\",\"content\":\"$CNAME_TARGET\",\"proxied\":true}"
if [ -z "$REC_ID" ]; then
  OUT="$(cf POST "/zones/$ZONE_ID/dns_records" "$DNS_BODY")"; check "$OUT"
else
  OUT="$(cf PUT "/zones/$ZONE_ID/dns_records/$REC_ID" "$DNS_BODY")"; check "$OUT"
fi

echo "> Ecriture du .env..."
touch .env
set_env() { if grep -q "^$1=" .env; then sed -i "s#^$1=.*#$1=$2#" .env; else echo "$1=$2" >> .env; fi; }
set_env CLOUDFLARE_TUNNEL_TOKEN "$TUNNEL_TOKEN"
set_env COMPOSE_PROFILES tunnel
set_env APP_URL "https://$PUBLIC_HOSTNAME"

if [ -n "${SKIP_DEPLOY:-}" ]; then
  echo "OK: Tunnel garanti (config + .env). Deploiement delegue a l'appelant."
  exit 0
fi

echo "> (Re)deploiement..."
COMPOSE_PROFILES=tunnel docker compose -f docker-compose.vps.yml up -d --build
echo ""
echo "OK: HTTPS reel actif : https://$PUBLIC_HOSTNAME (cert vert ~1 min)"
COMPOSE_PROFILES=tunnel docker compose -f docker-compose.vps.yml ps
