# Prompts d'abstraction — Pattern Port/Adapter

Collection de prompts réutilisables pour générer des couches d'abstraction
provider-agnostiques (Repository / Port-Adapter). Chaque prompt produit une
interface neutre côté métier, un ou plusieurs adapters concrets, une factory et
un test double.

---

## Principe commun

Toutes ces abstractions suivent le même découpage :

- **Port** : l'interface que le métier connaît (et la seule chose qu'il importe).
- **Types domaine** : modèles neutres, indépendants de tout fournisseur.
- **Adapter(s)** : implémentation concrète par fournisseur, qui mappe domaine ↔ API
  externe et normalise les erreurs.
- **Factory** : choisit l'adapter selon la configuration.
- **Test double** : implémentation en mémoire, sans I/O réseau.

### Quand abstraire — et quand ne PAS abstraire

L'abstraction n'est pas gratuite : elle ajoute de l'indirection et du
boilerplate. Elle se justifie quand au moins **une** de ces conditions est vraie :

1. **Swap plausible** — il existe un second fournisseur réaliste vers lequel
   migrer.
2. **Besoin de test** — pouvoir mocker la dépendance pour tester sans I/O.
3. **Coexistence** — plusieurs backends tournent déjà en parallèle.

Si aucune n'est vraie et que tu restes mono-fournisseur à vie, l'accès direct est
souvent le bon choix. Abstrais le jour où le besoin arrive, pas « par principe ».

### Comment utiliser ces prompts

Remplace les placeholders `[…]` (stack, langage, conventions, fournisseur) par
ton contexte avant de soumettre. Les sections **CHOIX** forcent des décisions
explicites ; les sections **PUSHBACK** demandent à l'agent de signaler les
mauvais compromis plutôt que de deviner.

Placeholders communs :

- `[STACK]` — ex. TypeScript/Next.js, Python/FastAPI, Node/Express…
- `[LANGAGE]` — ex. TypeScript, Python.
- `[CONVENTIONS]` — règles de style, nommage, secrets, anti-injection propres au projet.

---

## 1. Abstraction — Envoi de courriel

```markdown
# RÔLE
Tu es un architecte backend senior. Tu conçois une couche d'abstraction
d'envoi de courriel, provider-agnostique, où [FOURNISSEUR PRIMAIRE] est le
premier adapter.

# OBJECTIF
Découpler le code métier du fournisseur d'envoi. Le métier ne connaît qu'une
interface ; brancher/débrancher un fournisseur, un autre fournisseur, du SMTP
ou un mock = zéro changement côté appelant.

# STACK & CONVENTIONS
- [STACK].
- [Si autre langage : adapte au mécanisme d'interface idiomatique, garde le
  même découpage.]
- Pas de dépendance au SDK fournisseur en dehors de l'adapter concerné.
- Secrets via variables d'environnement.
- Aucune valeur en dur, aucun placeholder générique.
- [CONVENTIONS].

# ARCHITECTURE IMPOSÉE (Port/Adapter)
1. **Port** : interface `EmailProvider { send(msg): Promise<EmailResult> }`.
2. **Types domaine** (neutres, indépendants du fournisseur) :
   - `EmailMessage` : to[], from, replyTo?, cc[]?, bcc[]?, subject,
     html?, text?, templateId?, variables?, attachments[]?, tags[]?, headers?.
   - `EmailAddress` : { email, name? }.
   - `EmailResult` : { success, messageId?, provider, error? } (jamais d'exception
     fournisseur qui fuit — tout est normalisé).
3. **Adapter concret** : `XProvider implements EmailProvider`. Mappe
   `EmailMessage` -> payload de l'API du fournisseur (email transactionnel),
   traduit les erreurs/codes HTTP en `EmailResult.error` normalisé (type d'erreur
   + message + retryable: boolean).
4. **Factory** : `createEmailProvider()` lit la config et retourne le bon
   adapter. Défaut explicite. Throw clair si provider inconnu.
5. **Test double** : `FakeEmailProvider` qui capture les messages en mémoire
   (pour tests, sans appel réseau).

# EXIGENCES
- Appel API via client HTTP natif si possible (limiter les dépendances).
- Idempotence : accepte un `idempotencyKey?` optionnel propagé dans les headers.
- Validation des entrées (au moins un destinataire, subject, et html|text|templateId).
- Gestion explicite : timeout réseau, 4xx (non-retryable) vs 5xx/429 (retryable).
- Logs structurés (provider, messageId, durée, statut) — pas de fuite de secret.
- Typage strict, pas de type fourre-tout.

# LIVRABLES
- Arborescence claire : `email/port`, `email/types`, `email/providers/<x>`,
  `email/providers/fake`, `email/factory`, `email/index` (exports publics).
- Un exemple d'usage côté appelant (3-5 lignes).
- Tests unitaires de l'adapter (mapping + normalisation d'erreurs) et du Fake.

# DEFINITION OF DONE
- Le métier n'importe QUE depuis `email/index` (port + types + factory).
- Aucun import du fournisseur en dehors de son adapter.
- Ajouter un nouveau fournisseur = 1 fichier adapter + 1 ligne dans la factory.
- Build sans erreur, tests verts.

# PUSHBACK / HONNÊTETÉ
Si un choix d'archi est discutable (gestion des pièces jointes, templates
dynamiques côté fournisseur vs HTML local, batch sending), signale-le et propose
la meilleure option plutôt que de deviner. Si une exigence ci-dessus est sous-
optimale pour le cas réel, dis-le.
```

---

## 2. Abstraction — Persistance (Repository / ORM)

```markdown
# RÔLE
Tu es un architecte backend senior. Tu conçois une couche d'abstraction de
persistance (Repository pattern), data-store-agnostique, où un premier adapter
concret est branché (voir CHOIX).

# OBJECTIF
Découpler le code métier du mécanisme de persistance. Le métier ne connaît que
des Repositories typés sur des entités domaine ; changer d'ORM/datastore =
zéro changement côté appelant.

# CHOIX À FAIRE EXPLICITEMENT (ne devine pas)
- Datastore cible primaire : [document store | SQL via ORM | autre].
- Si plusieurs stores coexistent (ex. un document store pour l'app, du SQL
  relationnel pour un mandat spécifique), traite-les comme deux adapters
  distincts derrière le MÊME port — PAS une abstraction unique qui prétend
  masquer deux modèles de requête différents (voir PUSHBACK).

# STACK & CONVENTIONS
- [STACK].
- [Si autre langage : mécanisme d'interface idiomatique, même découpage.]
- Pas de dépendance ORM/SDK en dehors de l'adapter concerné.
- SQL : jamais de concaténation de chaînes (anti-injection), requêtes paramétrées.
- [CONVENTIONS SQL : casse des mots-clés, alias, syntaxe des paramètres.]
- Secrets via variables d'environnement. Aucune valeur en dur.

# ARCHITECTURE IMPOSÉE (Repository + Unit of Work)
1. **Entités domaine** : modèles métier purs, indépendants du schéma de stockage
   (pas de décorateurs ORM, pas de types datastore qui fuient).
2. **Port générique** : `Repository<T, ID>` :
   - findById(id), findMany(criteria), save(entity), update(id, patch),
     delete(id), exists(id).
   - `criteria` = objet de filtrage NEUTRE (champ, opérateur, valeur) + tri +
     pagination (limit/cursor), traduit par chaque adapter.
3. **Mappers** : `toDomain(row|doc) -> T` et `toPersistence(T) -> row|doc`.
   Le mapping vit UNIQUEMENT dans l'adapter.
4. **Adapters concrets** :
   - adapter document store : mappe criteria -> requêtes natives (filtres, tri,
     pagination par curseur). Documente les limites (capacités de OR, index
     composites requis).
   - adapter SQL : génère du SQL paramétré selon les conventions du projet.
5. **Unit of Work / transactions** : port `UnitOfWork { run(work): Promise<R> }`
   exposant un contexte transactionnel. Le métier orchestre via UoW, jamais
   l'ORM brut.
6. **Factory** : `createRepositories(store)` retourne les repositories câblés sur
   l'adapter choisi. Défaut explicite, throw clair si store inconnu.
7. **Test double** : `InMemoryRepository<T>` (Map interne) pour tests sans I/O.

# EXIGENCES
- Erreurs normalisées : `NotFound`, `Conflict`, `ValidationError`,
  `TransientError(retryable)` — aucune exception ORM/datastore brute qui fuit.
- Pagination par curseur (pas offset) pour cohérence cross-store.
- Validation des entités avant save/update.
- Logs structurés (repo, opération, durée, nb lignes/docs). Pas de fuite de PII
  ni de secrets.
- Typage strict. Génériques contraints correctement.

# LIVRABLES
- Arborescence : `data/domain/<entity>`, `data/port` (Repository, UnitOfWork,
  Criteria, erreurs), `data/mappers`, `data/adapters/<store>`,
  `data/adapters/in-memory`, `data/factory`, `data/index` (exports publics).
- Une entité d'exemple bout-en-bout (domaine + mapper + 1 adapter).
- Exemple d'usage côté métier (CRUD + une transaction via UoW).
- Tests : InMemory complet + tests de mapping/criteria de l'adapter primaire.

# DEFINITION OF DONE
- Le métier n'importe QUE depuis `data/index` (ports + entités + factory).
- Aucun import ORM/datastore hors de son dossier adapter.
- Ajouter un store = un dossier adapter + une branche dans la factory.
- Build sans erreur, tests verts.

# PUSHBACK / HONNÊTETÉ
- Une abstraction qui prétend unifier un document store (requêtes limitées) ET du
  SQL (relationnel, jointures) DANS UN MÊME repository est une fausse bonne idée :
  soit tu nivelles par le bas (perte des jointures et transactions riches), soit
  l'abstraction fuit. Si le besoin réel n'est PAS le multi-store, dis-le et garde
  un seul adapter — l'abstraction reste utile pour le testing et le swap futur,
  sans sur-ingénierie.
- Si `criteria` générique ne couvre pas une requête complexe (agrégations,
  jointures, full-text), signale-le et propose une méthode de repository dédiée
  plutôt que de tordre l'abstraction.
- Si l'ORM choisi fournit déjà une bonne séparation, dis si une couche Repository
  par-dessus apporte vraiment de la valeur ou juste du boilerplate.
```

---

## 3. Abstraction — Stockage de fichiers

```markdown
# RÔLE
Tu es un architecte backend senior. Tu conçois une couche d'abstraction de
stockage de fichiers (objets/blobs), provider-agnostique, où un premier adapter
concret est branché (voir CHOIX).

# OBJECTIF
Découpler le code métier du backend de stockage. Le métier ne connaît qu'une
interface ; brancher/débrancher un backend objet, un autre, ou un mock = zéro
changement côté appelant.

# CHOIX À FAIRE EXPLICITEMENT (ne devine pas)
- Backend primaire : [backend objet].
- Certains backends partagent l'API S3 (un seul adapter paramétrable couvre tous
  les backends S3-compatibles via endpoint + credentials custom). Un backend non
  S3-compatible = adapter distinct.
- Si plusieurs backends coexistent (ex. l'un pour les assets, l'autre pour les
  uploads utilisateurs), traite-les comme des adapters distincts derrière le
  MÊME port.

# STACK & CONVENTIONS
- [STACK].
- [Si autre langage : mécanisme d'interface idiomatique, même découpage.]
- SDK de stockage confiné à son adapter uniquement.
- Secrets via variables d'environnement.
- Aucune valeur en dur, aucun placeholder générique.
- [CONVENTIONS].

# ARCHITECTURE IMPOSÉE (Port/Adapter)
1. **Port** : interface `FileStorage` :
   - `put(key, body, opts)` -> StoredObject
   - `get(key)` -> { stream | buffer, metadata } | NotFound
   - `delete(key)`
   - `exists(key)` -> boolean
   - `getSignedUrl(key, { operation: 'get'|'put', expiresInSec })` -> string
   - `list(prefix, { limit, cursor })` -> { items[], nextCursor? }
   - `copy(srcKey, destKey)`
2. **Types domaine** (neutres, indépendants du fournisseur) :
   - `PutOptions` : contentType, cacheControl?, metadata?, contentDisposition?,
     visibility?: 'private'|'public'.
   - `StoredObject` : key, size, contentType, etag?, lastModified?, url? (publique
     si visibility public et base URL configurée).
   - `FileBody` : Buffer | ReadableStream | Uint8Array (gère les deux modes — ne
     force pas tout en buffer pour les gros fichiers).
3. **Adapter S3-compatible** : `S3FileStorage implements FileStorage`. Mappe
   key+opts -> commandes objets (put, get, delete, head, list, copy). URLs
   signées via presign GET et PUT.
4. **Adapter non-S3** (si retenu) : traduit visibility/signedUrl à l'équivalent
   du backend.
5. **Factory** : `createFileStorage()` lit la config, retourne l'adapter.
   Défaut explicite, throw clair si provider inconnu.
6. **Test double** : `InMemoryFileStorage` (Map clé -> bytes + metadata), URLs
   signées simulées, pour tests sans réseau.

# EXIGENCES
- Streaming-first : ne charge PAS les gros fichiers entièrement en mémoire sans
  raison. `get` peut retourner un stream ; documente quand un buffer est OK.
- Erreurs normalisées : `NotFound`, `Forbidden`, `Conflict`,
  `TransientError(retryable)` — jamais d'exception SDK brute qui fuit.
- Validation des clés (pas de path traversal, normalisation des préfixes/slash).
- URLs signées : expiration bornée et configurable, defaults raisonnables
  (ex. GET 1h, PUT 15min). Documente le upload direct client via presigned PUT.
- Idempotence du delete (delete d'une clé absente ne throw pas).
- Logs structurés (op, bucket, key hashée ou tronquée, taille, durée). Jamais de
  secret ni d'URL signée complète loggée.
- Typage strict.

# LIVRABLES
- Arborescence : `storage/port`, `storage/types`, `storage/providers/<x>`,
  `storage/providers/in-memory`, `storage/factory`, `storage/index`.
- Exemple d'usage : upload + presigned PUT pour upload client direct + génération
  d'URL de lecture.
- Tests : InMemory complet + tests de mapping/erreurs de l'adapter principal
  (mock du client SDK).

# DEFINITION OF DONE
- Le métier n'importe QUE depuis `storage/index` (port + types + factory).
- Aucun import du SDK de stockage hors de son adapter.
- Ajouter un backend = 1 fichier adapter + 1 ligne dans la factory.
- Build sans erreur, tests verts.

# PUSHBACK / HONNÊTETÉ
- Les modèles de métadonnées et d'ACL diffèrent selon les backends. Si
  `visibility: 'public'` ne se mappe pas proprement sur un backend, signale-le
  plutôt que de prétendre une équivalence parfaite.
- Le presigned upload direct (client -> storage, sans passer par le serveur) est
  le bon pattern pour les gros assets : confirme que c'est le besoin avant de
  tout router via le serveur (coût + limites de payload).
- Si tu restes mono-backend à vie, l'abstraction reste justifiée par le testing
  (InMemory) et le presign ; dis-le si tu veux simplifier en enlevant un adapter.
```

---

## 4. Abstraction — Auth / Identity

```markdown
# RÔLE
Tu es un architecte backend senior. Tu conçois une couche d'abstraction
d'authentification et d'identité, provider-agnostique, où [FOURNISSEUR PRIMAIRE]
est le premier adapter.

# OBJECTIF
Découpler le code métier du fournisseur d'identité. Le métier ne connaît qu'une
interface ; brancher/débrancher un fournisseur, un autre, ou un mock = zéro
changement côté appelant.

# AVERTISSEMENT (lire avant de coder)
Cette abstraction se divise en DEUX responsabilités à découpler nettement :
- **Verification** (validation de token côté serveur) : utile TOUJOURS, même
  mono-provider — c'est ce que le métier touche à chaque requête. Abstrais-la.
- **Identity management** (créer/modifier/supprimer users, custom claims, reset)
  : utile surtout si un swap de fournisseur est plausible. Si non, garde-la mince
  et n'invente pas d'opérations « au cas où ».
Voir CHOIX et PUSHBACK.

# CHOIX À FAIRE EXPLICITEMENT (ne devine pas)
- Fournisseur primaire : [fournisseur d'identité].
- Périmètre réel : VERIFICATION SEULE, ou VERIFICATION + MANAGEMENT ? Ne génère
  le port de management que si le besoin existe.
- Modèle de session : tokens stateless (JWT vérifié à chaque requête) vs session
  serveur. Par défaut : vérification de bearer token stateless.

# STACK & CONVENTIONS
- [STACK].
- Vérification côté serveur uniquement (jamais de clé admin côté client).
- [Si autre langage : mécanisme d'interface idiomatique, même découpage.]
- SDK admin du fournisseur confiné à son adapter.
- Secrets via variables d'environnement.
- Aucune valeur en dur, aucun placeholder générique.

# ARCHITECTURE IMPOSÉE (Port/Adapter)
1. **Identité domaine** (neutre, indépendante du fournisseur) :
   - `AuthUser` : id (identifiant neutre), email?, emailVerified, displayName?,
     roles[]?, claims?: Record<string, unknown>, provider, disabled?.
   - PAS de type fournisseur qui fuit dans le domaine.
2. **Port de vérification** : `TokenVerifier` :
   - `verify(token)` -> AuthUser | throw AuthError (token invalide/expiré/révoqué).
   - `extractFromRequest(headers)` -> token | null (parse Bearer proprement).
3. **Port de gestion** (OPTIONNEL — seulement si périmètre management) :
   `IdentityManager` :
   - getUser(id), getUserByEmail(email), createUser(input), updateUser(id, patch),
     deleteUser(id), setClaims(id, claims), revokeTokens(id).
4. **Garde / middleware** : helper `requireAuth(req, { roles? })` qui combine
   extract + verify + contrôle de rôle, et retourne `AuthUser` ou une erreur HTTP
   normalisée (401/403). C'est le SEUL point de contact du métier avec l'auth.
5. **Adapter concret** : `XTokenVerifier` (validation de token via le SDK admin),
   `XIdentityManager` (si management retenu). Mappe le token décodé / l'objet user
   -> AuthUser, traduit les erreurs.
6. **Factory** : `createAuth()` lit la config, retourne verifier (+ manager si
   applicable). Défaut explicite, throw clair si provider inconnu.
7. **Test double** : `FakeTokenVerifier` (mappe des tokens-test -> AuthUser
   prédéfinis) pour tester les routes protégées sans réseau ni vrai token.

# EXIGENCES
- Erreurs normalisées : `Unauthenticated` (token absent/invalide/expiré),
  `Forbidden` (rôle insuffisant), `TransientError(retryable)` — jamais
  d'exception SDK brute qui fuit.
- Vérification stricte : signature, expiration, révocation si pertinent,
  audience/issuer attendus.
- Rôles/claims : modèle de rôles neutre, mappé depuis les claims du fournisseur.
  Le métier raisonne en roles[], pas en claims bruts.
- Aucune fuite : ne JAMAIS logger un token complet, un email en clair dans les
  logs d'erreur, ni de claim sensible. Tronque/hash si besoin de tracer.
- Performance : mets en cache les clés publiques de signature (le SDK le fait
  généralement déjà — ne les refetch pas manuellement à chaque requête).
- Typage strict.

# LIVRABLES
- Arborescence : `auth/domain`, `auth/port` (TokenVerifier, IdentityManager?,
  AuthError), `auth/guard` (requireAuth), `auth/providers/<x>`,
  `auth/providers/fake`, `auth/factory`, `auth/index` (exports publics).
- Exemple d'usage : une route API protégée par `requireAuth` avec contrôle de
  rôle, et le test correspondant avec FakeTokenVerifier.

# DEFINITION OF DONE
- Le métier n'importe QUE depuis `auth/index` (ports + domaine + guard + factory).
  Le métier ne touche JAMAIS le SDK admin directement.
- Aucun import du SDK admin hors de son adapter.
- Ajouter un fournisseur = 1 fichier adapter + 1 ligne dans la factory.
- Build sans erreur, tests verts.

# PUSHBACK / HONNÊTETÉ
- Si le périmètre réel est un seul fournisseur à vie, le port `IdentityManager`
  complet risque d'être du boilerplate : le SDK admin est souvent déjà une API
  correcte. Dans ce cas, recommande de n'abstraire QUE `TokenVerifier` + le guard
  (vrai gain : testing des routes protégées + point de contrôle unique), et
  d'appeler le SDK directement pour les rares opérations de management. Dis-le
  franchement plutôt que de tout abstraire par principe.
- Les modèles d'identité diffèrent (custom claims vs roles/permissions vs
  metadata selon le fournisseur). Si le mapping vers `roles[]` ne couvre pas un
  cas (permissions fines, multi-tenant, organisations), signale-le et propose une
  extension ciblée plutôt que de gonfler `AuthUser`.
- Si une auth existe déjà côté framework front (middleware, cookies de session),
  dis si cette abstraction serveur doit s'articuler avec, ou si elle la remplace —
  ne duplique pas deux mécanismes de session.
```

---

## 5. Abstraction — Fournisseur LLM / IA

```markdown
# RÔLE
Tu es un architecte backend senior. Tu conçois une couche d'abstraction d'accès
aux modèles de langage (LLM), provider-agnostique, où [FOURNISSEUR PRIMAIRE] est
le premier adapter. L'abstraction supporte un routing par coût/tâche et le
fallback entre fournisseurs.

# OBJECTIF
Découpler le code métier du fournisseur de modèle. Le métier décrit une intention
(messages + paramètres + capacités requises) ; le choix du modèle, le routing, le
fallback et le comptage de tokens sont gérés par l'abstraction. Changer de
fournisseur ou de modèle = zéro changement côté appelant.

# CHOIX À FAIRE EXPLICITEMENT (ne devine pas)
- Fournisseur(s) primaire(s) : [un ou plusieurs fournisseurs LLM].
- Stratégie de routing : modèle fixe | routing par type de tâche (ex. un tier
  léger / un tier standard / un tier haut de gamme) | routing par coût plafonné.
  Si non précisé, défaut = modèle fixe explicite, routing extensible plus tard.
- Streaming requis ou non (réponse complète vs flux token par token).
- Tool/function calling requis ou non.

# STACK & CONVENTIONS
- [STACK].
- [Si autre langage : mécanisme d'interface idiomatique, même découpage.]
- Pas de dépendance au SDK fournisseur en dehors de l'adapter concerné.
- Secrets (clés API) via variables d'environnement.
- Aucune valeur en dur, aucun placeholder générique.
- [CONVENTIONS].

# ARCHITECTURE IMPOSÉE (Port/Adapter + Router)
1. **Port** : interface `LlmProvider` :
   - `complete(request)` -> CompletionResult
   - `stream(request)` -> AsyncIterable<CompletionChunk> (si streaming retenu)
2. **Types domaine** (neutres, indépendants du fournisseur) :
   - `CompletionRequest` : messages[] ({ role, content }), system?, maxTokens?,
     temperature?, stop?, tools?, responseFormat?, taskHint? (indice de routing),
     metadata?.
   - `CompletionResult` : text, toolCalls?, finishReason, model, provider, usage
     ({ promptTokens, completionTokens, totalTokens }), costEstimate?.
   - `CompletionChunk` : delta (text | toolCall), done.
   - `LlmError` normalisé : { type: 'RateLimit'|'Auth'|'InvalidRequest'|
     'ContextLength'|'Transient', retryable, message } — jamais d'exception SDK
     brute qui fuit.
3. **Adapter(s) concret(s)** : `XLlmProvider implements LlmProvider`. Mappe
   `CompletionRequest` -> payload de l'API, normalise la réponse et les erreurs
   (codes HTTP, rate limits, context length). Confine le SDK à ce fichier.
4. **Router** (si routing retenu) : `RoutingLlmProvider implements LlmProvider`
   qui choisit l'adapter/modèle selon `taskHint`, le coût ou une politique
   configurable, et applique le fallback (si fournisseur A échoue avec une erreur
   retryable, bascule sur B). Le router EST un `LlmProvider` — composition, pas
   cas particulier.
5. **Factory** : `createLlm()` lit la config et retourne soit un adapter direct,
   soit le router câblé. Défaut explicite, throw clair si config invalide.
6. **Test double** : `FakeLlmProvider` (réponses scriptées par prompt ou file
   d'attente de réponses) pour tester le métier sans appel réseau ni coût.

# EXIGENCES
- Comptage de tokens et estimation de coût exposés dans `usage`/`costEstimate`
  (par modèle, via une table de tarifs configurable — pas de prix en dur).
- Gestion explicite des erreurs : rate limit (retryable, respecte Retry-After),
  context length (non-retryable, message clair), auth, timeout réseau.
- Retry avec backoff sur erreurs retryable, plafonné ; pas de retry sur 4xx
  non-retryable.
- Fallback : ordre de fournisseurs configurable, journalisé quand il se déclenche.
- Streaming (si retenu) : propager proprement l'annulation (abort) pour ne pas
  payer des tokens inutiles.
- Logs structurés (provider, modèle, tokens, coût estimé, durée, fallback?).
  Ne JAMAIS logger le contenu complet des prompts/réponses par défaut (PII, coût
  de logs) — option de debug explicite et bornée.
- Typage strict.

# LIVRABLES
- Arborescence : `llm/port`, `llm/types`, `llm/providers/<x>`,
  `llm/providers/fake`, `llm/router`, `llm/pricing` (table de tarifs),
  `llm/factory`, `llm/index` (exports publics).
- Exemple d'usage : un appel `complete` avec `taskHint`, et un exemple de
  streaming si retenu.
- Tests : Fake complet (métier testable sans réseau) + tests du router (sélection
  + fallback) + tests de normalisation d'erreurs d'un adapter.

# DEFINITION OF DONE
- Le métier n'importe QUE depuis `llm/index` (port + types + factory).
- Aucun import du SDK fournisseur hors de son adapter.
- Ajouter un fournisseur = 1 fichier adapter + 1 entrée dans la table de tarifs
  + 1 ligne dans la factory/router.
- Changer la stratégie de routing = modifier le router uniquement, pas le métier.
- Build sans erreur, tests verts.

# PUSHBACK / HONNÊTETÉ
- Les capacités diffèrent entre fournisseurs (formats de tool calling, JSON mode,
  fenêtres de contexte, multimodal). Si une capacité demandée n'existe pas chez un
  fournisseur cible, signale-le : soit le port expose un check de capacité, soit le
  router évite ce fournisseur pour cette requête — ne prétends pas une équivalence
  qui n'existe pas.
- Si un seul fournisseur est réellement utilisé sans fallback prévu, le router est
  du sur-engineering : recommande de n'abstraire que `LlmProvider` + le Fake (vrai
  gain : testing sans coût + swap futur) et d'ajouter le router le jour où un
  second fournisseur entre en jeu.
- Le comptage de coût dépend de tarifs qui changent : garde la table de tarifs
  externe et versionnée, ne hardcode rien, et précise que les estimations peuvent
  dériver des montants réellement facturés.
```
