# 🚀 Prompt-AI System

> Une collection de prompts spécialisés et de protocoles pour transformer l'IA en un collaborateur technique de haute précision.

---

## 📋 Présentation

Ce dépôt centralise des instructions (prompts) structurées pour guider les interactions avec les modèles de langage (LLM) dans un contexte de développement et d'analyse technique. Chaque prompt agit comme une "personnalité" ou un "rôle" spécifique avec des règles strictes.

---

## 🖥️ Application Web (Laravel)

L'application **DarkMedia Prompt AI** (bibliothèque de prompts avec assistance IA) vit dans le dossier [`laravel/`](laravel/). Elle est totalement autonome :

- **Backend Laravel 13** : API REST (prompts, catégories, favoris, historique de versions) + proxy IA multi-providers (Gemini, Anthropic, OpenAI, DeepSeek, OpenRouter).
- **Authentification par magic link** : connexion sans mot de passe via un lien email à usage unique (allowlist d'adresses via `MAGIC_LINK_ALLOWED_EMAILS`).
- **Frontend PWA** : installable, hors-ligne, identique à l'ancienne version mais branché sur l'API Laravel (plus de dépendance Supabase).
- **Conteneurisée** : une seule image Docker (PHP-FPM + nginx), volume persistant SQLite, prête à s'intégrer derrière le reverse-proxy d'un VPS.

```bash
cd laravel
cp .env.docker.example .env.docker   # configurer SMTP, emails autorisés, clés IA
docker compose up -d --build         # app disponible sur :8080
```

➡️ Guide complet : [`laravel/DEPLOYMENT.md`](laravel/DEPLOYMENT.md)

> L'ancienne version statique (`app/` + `supabase/`) est conservée pour référence et sera retirée après la bascule complète.

---

## 🧩 Structure des Prompts

| Prompt | Rôle | Description |
| :--- | :--- | :--- |
| **🔍 Analyste de Confiance** | Expert Factuel | Priorise l'exactitude, utilise la navigation web et fournit un index de certitude. |
| **🏗️ Architecte Documentation** | Release Manager | Automatise la gestion du `CHANGELOG.md` et le versionnage SemVer. |
| **🛡️ Gardien du README** | Technical Writer | Assure la synchronisation parfaite entre le code source et sa documentation. |
| **🚢 Maestro de Flotte** | Orchestrateur | Déploie et synchronise les standards sur l'ensemble de vos dépôts GitHub. |

---

## 📂 Structure du Projet

```text
prompt-ai/
├── .github/workflows/           # Workflows GitHub réutilisables
│   └── reusable-doc-sync.yml    # Moteur d'automatisation global
├── scripts/                     # Scripts utilitaires
│   └── sync_engine.py           # Orchestrateur Gemini 2.0 Flash
├── Architecte de Documentation...# Gestion SemVer & Changelog
├── L'Analyste de Confiance.md    # Analyse factuelle haute précision
├── Le Gardien du README.md       # Maintenance de la documentation
├── Le Maestro de Flotte...md     # Orchestration multi-dépôts
├── CHANGELOG.md                 # Historique des versions
├── README.md                    # Documentation principale (ce fichier)
└── version.json                 # Source de vérité pour la version (SemVer)
```

---

## 🚀 Utilisation

1. **Choisissez un rôle** selon votre besoin actuel.
2. **Copiez le contenu** du fichier `.md` correspondant dans votre interaction avec l'IA.
3. **Appliquez les règles** dictées par le prompt pour garantir la qualité des livrables.

---

---

## 🤖 Automatisation (GitHub Actions)

Vous pouvez automatiser la synchronisation de la documentation sur n'importe quel dépôt en utilisant notre **Workflow Réutilisable**.

### Configuration
1. Dans votre dépôt cible, créez un fichier `.github/workflows/docs-sync.yml`.
2. Ajoutez le contenu suivant :

```yaml
name: Sync Documentation
on:
  push:
    branches: [main]

jobs:
  call-sync:
    uses: jfcyberknight/prompt-ai/.github/workflows/reusable-documentation-sync.yml@main
    secrets:
      LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
      GH_PAT: ${{ secrets.GH_PAT }}
```

### Secrets et variables
- `LLM_API_KEY` : Votre clé API (OpenAI, Gemini, etc.).
- `GH_PAT` : Un *Personal Access Token* avec les droits `repo` et `workflow`.
- `AI_SMART_ROUTER_URL` (optionnel) : URL de l’API smart router. Par défaut : `https://ai-smart-router.vercel.app`.

---

## 🛠️ Maintenance & Qualité

Le projet suit les standards suivants :
- **Keep a Changelog** pour le suivi des modifications.
- **Semantic Versioning (SemVer)** pour le marquage des étapes.
- **Premium Markdown** pour une lisibilité maximale.

---

> [!NOTE]
> Ce système est conçu pour être auto-documenté. Toute modification du code source déclenche une mise à jour du `README.md` via le rôle "Gardien".
