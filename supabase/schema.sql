-- =============================================
-- DarkMedia Prompt AI — Supabase Schema
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- TABLE: categories
-- =============================================
create table if not exists categories (
  id   uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

insert into categories (name, color) values
  ('Général',         '#6366f1'),
  ('Documentation',   '#0ea5e9'),
  ('Code',            '#10b981'),
  ('Analyse',         '#f59e0b'),
  ('Créatif',         '#ec4899'),
  ('Automatisation',  '#8b5cf6'),
  ('Débogage',        '#ef4444'),
  ('Formation',       '#14b8a6')
on conflict (name) do nothing;

-- =============================================
-- TABLE: prompts
-- =============================================
create table if not exists prompts (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  content      text not null,
  description  text,
  category_id  uuid references categories(id) on delete set null,
  tags         text[] not null default '{}',
  model        text,                          -- ex: gpt-4, claude-3, gemini, etc.
  source       text,                          -- origine du prompt (url, projet, etc.)
  is_favorite  boolean not null default false,
  usage_count  integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index full-text search (French)
create index if not exists prompts_fts
  on prompts using gin(to_tsvector('french', title || ' ' || content || ' ' || coalesce(description, '')));

-- Index for fast tag filtering
create index if not exists prompts_tags on prompts using gin(tags);

-- Index for category + favorite filters
create index if not exists prompts_category on prompts(category_id);
create index if not exists prompts_favorite on prompts(is_favorite);
create index if not exists prompts_created on prompts(created_at desc);

-- =============================================
-- FUNCTION: auto-update updated_at
-- =============================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger prompts_updated_at
  before update on prompts
  for each row execute procedure set_updated_at();

-- =============================================
-- TABLE: prompt_versions  (historique des modifs)
-- =============================================
create table if not exists prompt_versions (
  id         uuid primary key default uuid_generate_v4(),
  prompt_id  uuid not null references prompts(id) on delete cascade,
  content    text not null,
  title      text not null,
  version    integer not null,
  created_at timestamptz not null default now()
);

create index if not exists prompt_versions_prompt on prompt_versions(prompt_id, version desc);

-- Fonction pour sauvegarder une version avant mise à jour
create or replace function save_prompt_version()
returns trigger language plpgsql as $$
declare
  next_version integer;
begin
  select coalesce(max(version), 0) + 1
    into next_version
    from prompt_versions
   where prompt_id = old.id;

  insert into prompt_versions (prompt_id, content, title, version)
  values (old.id, old.content, old.title, next_version);

  return new;
end;
$$;

create trigger prompts_version_on_update
  before update of content, title on prompts
  for each row execute procedure save_prompt_version();

-- =============================================
-- ROW LEVEL SECURITY (optionnel — activer si auth)
-- =============================================
-- alter table prompts enable row level security;
-- alter table categories enable row level security;
-- alter table prompt_versions enable row level security;

-- Pour usage public sans auth (accès total) :
-- create policy "public access" on prompts for all using (true) with check (true);

-- =============================================
-- DONNÉES D'EXEMPLE
-- =============================================
insert into prompts (title, content, description, tags, model, source)
values (
  'Rédiger un README complet',
  'Tu es un expert en documentation technique. Génère un README.md complet pour le projet suivant : [description du projet].

Le README doit inclure :
- Badge de version, licence et CI
- Description claire du projet
- Prérequis et installation
- Guide d''utilisation avec exemples
- Structure du projet
- Contribution et licence

Utilise des emojis pour les sections, un ton professionnel mais accessible.',
  'Prompt pour générer des README professionnels complets',
  ARRAY['documentation', 'readme', 'github'],
  'claude-3',
  'darkmedia-x_prompt-ai'
),
(
  'Analyste de code — revue de PR',
  'Tu es un ingénieur senior spécialisé en revue de code. Analyse le diff suivant et fournis :

1. **Bugs potentiels** : liste avec sévérité (critique / majeur / mineur)
2. **Problèmes de sécurité** : OWASP top 10, injections, exposition de données
3. **Performance** : goulots d''étranglement, optimisations possibles
4. **Lisibilité** : nommage, complexité, duplication
5. **Tests manquants** : cas limites non couverts

Diff :
```
[COLLER LE DIFF ICI]
```',
  'Revue approfondie de pull requests avec catégorisation des problèmes',
  ARRAY['code', 'review', 'securite', 'pr'],
  'gpt-4',
  null
),
(
  'Débogage pas à pas',
  'Tu es un expert en débogage. Aide-moi à résoudre cette erreur.

**Erreur :**
```
[MESSAGE D''ERREUR]
```

**Contexte :**
- Langage/Framework : [ex: Python 3.11 / FastAPI]
- Environnement : [local / Docker / CI]
- Derniers changements : [description]

Procède ainsi :
1. Identifie la cause racine probable
2. Explique pourquoi cette erreur se produit
3. Propose 2-3 solutions avec avantages/inconvénients
4. Donne la solution recommandée avec code corrigé',
  'Débogage structuré avec analyse de la cause racine',
  ARRAY['debug', 'erreur', 'code'],
  null,
  null
)
;
