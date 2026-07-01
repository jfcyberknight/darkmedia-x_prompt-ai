import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_KEY     = Deno.env.get('GEMINI_API_KEY')    ?? '';
const ANTHROPIC_KEY  = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const OPENAI_KEY     = Deno.env.get('OPENAI_API_KEY')    ?? '';
const DEEPSEEK_KEY   = Deno.env.get('DEEPSEEK_API_KEY')  ?? '';
const OPENCODE_KEY   = Deno.env.get('OPENCODE_API_KEY')  ?? '';
const OPENCODE_BASE  = Deno.env.get('OPENCODE_BASE_URL') ?? 'https://api.openai.com/v1';
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';

const DEFAULT_MODELS: Record<string, string> = {
  gemini:     'gemini-2.0-flash',
  anthropic:  'claude-haiku-4-5',
  openai:     'gpt-4o-mini',
  deepseek:   'deepseek-chat',
  opencode:   'gpt-4o-mini',
  // Llama 3.3 70B Instruct (gratuit, zéro crédit) : modèle de chat/instruct pur — pas
  // de raisonnement caché qui viderait le budget de tokens — donc fiable pour renvoyer
  // du JSON directement. Vérifié disponible via l'action « freeModels ». Surchargé par
  // OPENROUTER_MODEL (ex: 'deepseek/deepseek-chat-v3-0324' pour un payant très économique).
  openrouter: Deno.env.get('OPENROUTER_MODEL') || 'meta-llama/llama-3.3-70b-instruct:free',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es un assistant qui extrait des informations structurées depuis un texte brut décrivant un ou plusieurs prompts IA.
Retourne UNIQUEMENT un objet JSON valide avec ces champs :
- title: string (titre court et descriptif, max 100 caractères)
- content: string (le contenu du prompt, propre et bien formaté)
- description: string (description courte de ce que fait ce prompt, max 200 caractères)
- tags: array of strings (mots-clés pertinents, max 8, en minuscules, sans espaces)
- model: string (modèle IA mentionné dans le texte, sinon chaîne vide)
- source: string (source ou origine mentionnée, sinon chaîne vide)
- category: string (la catégorie la plus appropriée parmi : Général, Documentation, Code, Analyse, Créatif, Automatisation, Débogage, Formation)
Si plusieurs prompts sont détectés, extrais le plus important ou le premier.`;

const UPGRADE_PROMPT = `Tu es un ingénieur de prompt IA expert. Ton rôle est d'analyser le prompt fourni et de l'améliorer/optimiser (l'upgrader) pour qu'il donne de bien meilleurs résultats avec les LLM modernes.
Rends-le plus précis, ajoute des consignes structurées, utilise des délimiteurs (comme XML ou Markdown) si nécessaire, et améliore la clarté globale.
Retourne UNIQUEMENT un objet JSON valide avec ces champs :
- title: string (titre court et descriptif du prompt amélioré, max 100 caractères)
- content: string (le contenu du prompt entièrement amélioré et optimisé, propre et bien formaté)
- description: string (description courte de ce que fait ce prompt, max 200 caractères)
- tags: array of strings (mots-clés pertinents, max 8, en minuscules, sans espaces)
- model: string (modèle IA recommandé ou inchangé, sinon chaîne vide)
- source: string (source ou origine inchangée, sinon chaîne vide)
- category: string (la catégorie la plus appropriée parmi : Général, Documentation, Code, Analyse, Créatif, Automatisation, Débogage, Formation)`;

function stripJsonMarkdown(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

// Certains modèles (surtout via openrouter/free, qui pioche un modèle gratuit au
// hasard) ignorent la consigne "retourne UNIQUEMENT du JSON" et préfixent leur
// réponse d'un raisonnement en texte libre (ex: "We need to..."). Plutôt que de
// planter sur un JSON.parse invalide, on extrait le premier objet JSON complet
// (comptage d'accolades) trouvé dans le texte.
function extractJsonObject(text: string): string {
  const stripped = stripJsonMarkdown(text);
  try {
    JSON.parse(stripped);
    return stripped;
  } catch {
    const start = stripped.indexOf('{');
    if (start === -1) throw new Error('Réponse du modèle sans JSON exploitable');
    let depth = 0;
    for (let i = start; i < stripped.length; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') {
        depth--;
        if (depth === 0) {
          const candidate = stripped.slice(start, i + 1);
          JSON.parse(candidate);
          return candidate;
        }
      }
    }
    throw new Error('Réponse du modèle sans JSON exploitable (objet non fermé)');
  }
}

// Renvoie, pour chaque provider, si sa clé API est présente côté serveur.
// Ne renvoie jamais la valeur des clés — uniquement un booléen de présence,
// pour distinguer une clé manquante d'une clé invalide lors du diagnostic.
function keyStatus(): Record<string, boolean> {
  return {
    gemini:     !!GEMINI_KEY,
    anthropic:  !!ANTHROPIC_KEY,
    openai:     !!OPENAI_KEY,
    deepseek:   !!DEEPSEEK_KEY,
    opencode:   !!OPENCODE_KEY,
    openrouter: !!OPENROUTER_KEY,
  };
}

function errResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Diagnostic OpenRouter : interroge les endpoints /key et /credits pour connaître
// l'état réel du compte (clé valide ? crédits restants ? rate limit ?). OpenRouter
// masque le détail des erreurs 500 dans l'appel de complétion — ces endpoints, eux,
// répondent en clair. Utilisé uniquement en mode debug (bouton de test) pour
// transformer un « Internal Server Error » opaque en cause exploitable.
async function probeOpenRouter(): Promise<string> {
  if (!OPENROUTER_KEY) return 'clé OpenRouter absente côté serveur';
  const parts: string[] = [];
  try {
    const keyRes = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}` },
    });
    const keyBody = await keyRes.text();
    if (keyRes.status === 401) {
      return `clé OpenRouter invalide ou révoquée (401 sur /key : ${keyBody})`;
    }
    parts.push(`/key ${keyRes.status}: ${keyBody}`);
  } catch (e) {
    parts.push(`/key injoignable: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const credRes = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}` },
    });
    parts.push(`/credits ${credRes.status}: ${await credRes.text()}`);
  } catch (e) {
    parts.push(`/credits injoignable: ${e instanceof Error ? e.message : String(e)}`);
  }
  return `diagnostic OpenRouter — ${parts.join(' | ')}`;
}

async function callGemini(systemPrompt: string, text: string, model: string, maxTokens: number): Promise<string> {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty response from Gemini');
  return content;
}

async function callAnthropic(systemPrompt: string, text: string, model: string, maxTokens: number): Promise<string> {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.content?.[0]?.text;
  if (!content) throw new Error('Empty response from Anthropic');
  return extractJsonObject(content);
}

interface OpenAICompatOptions {
  // Désactivable si un provider/modèle ne supporte pas response_format json_object ;
  // on se repose alors sur la consigne "retourne UNIQUEMENT du JSON" du prompt et sur
  // extractJsonObject() en filet de sécurité.
  jsonFormat?: boolean;
  extraHeaders?: Record<string, string>;
}

async function callOpenAICompat(
  systemPrompt: string,
  text: string,
  model: string,
  baseUrl: string,
  apiKey: string,
  providerName: string,
  maxTokens: number,
  opts: OpenAICompatOptions = {},
): Promise<string> {
  if (!apiKey) throw new Error(`${providerName} API key not configured`);
  const { jsonFormat = true, extraHeaders = {} } = opts;

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  };
  if (jsonFormat) requestBody.response_format = { type: 'json_object' };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(requestBody),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from API');
  return extractJsonObject(content);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let debug = false;
  let provider = 'gemini';
  let action = 'extract';
  let model = '';
  try {
    const payload = await req.json();
    ({ action = 'extract', provider = 'gemini' } = payload);
    const { text, instruction = '', model: requestedModel = '', maxTokens: requestedMaxTokens } = payload;
    debug = payload.debug === true;

    model = requestedModel || DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;
    // openrouter/free est un routeur aléatoire : il tombe parfois sur un modèle de
    // raisonnement qui épuise son budget de tokens sans produire de contenu (réponse
    // vide). On le remplace par un modèle gratuit concret et fiable (chat/instruct pur).
    // NB : on ne touche PAS aux autres modèles :free choisis explicitement — l'utilisateur
    // reste libre de sélectionner un modèle gratuit précis dans le menu.
    if (provider === 'openrouter' && model === 'openrouter/free') {
      model = 'meta-llama/llama-3.3-70b-instruct:free';
    }
    // Plafond de génération. Par défaut 8000 ; un test de connexion peut demander
    // une petite valeur pour une réponse quasi instantanée. Borné entre 16 et 8000.
    const maxTokens = Math.min(Math.max(Number(requestedMaxTokens) || 8000, 16), 8000);

    // Diagnostic léger : vérifie la présence des clés sans appeler de provider.
    if (action === 'ping') {
      return new Response(JSON.stringify({ ok: true, provider, model, configured: keyStatus() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Diagnostic : liste les modèles gratuits actuellement disponibles sur OpenRouter
    // (id suffixé « :free » ou tarif prompt+completion nul). La liste change souvent —
    // c'est la source de vérité en direct plutôt qu'une liste codée en dur.
    if (action === 'freeModels') {
      const r = await fetch('https://openrouter.ai/api/v1/models', {
        headers: OPENROUTER_KEY ? { 'Authorization': `Bearer ${OPENROUTER_KEY}` } : {},
      });
      if (!r.ok) return errResponse(502, `OpenRouter /models a répondu ${r.status}`);
      const all = (await r.json()).data ?? [];
      const free = all
        .filter((m: Record<string, unknown>) => {
          const id = typeof m.id === 'string' ? m.id : '';
          const p = (m.pricing ?? {}) as Record<string, unknown>;
          const zero = Number(p.prompt) === 0 && Number(p.completion) === 0;
          return id.endsWith(':free') || zero;
        })
        .map((m: Record<string, unknown>) => ({ id: m.id, name: m.name, context: m.context_length }));
      return new Response(JSON.stringify({ count: free.length, free }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!text) return errResponse(400, 'text is required');

    let selectedPrompt = action === 'upgrade' ? UPGRADE_PROMPT : SYSTEM_PROMPT;
    if (action === 'upgrade' && typeof instruction === 'string' && instruction.trim()) {
      selectedPrompt += `\n\nCONSIGNES PRIORITAIRES DE L'UTILISATEUR pour orienter l'amélioration (respecte-les en priorité) :\n${instruction.trim()}`;
    }

    let content: string;

    switch (provider) {
      case 'gemini':
        content = await callGemini(selectedPrompt, text, model, maxTokens);
        break;
      case 'anthropic':
        content = await callAnthropic(selectedPrompt, text, model, maxTokens);
        break;
      case 'openai':
        content = await callOpenAICompat(selectedPrompt, text, model, 'https://api.openai.com/v1', OPENAI_KEY, 'OPENAI', maxTokens);
        break;
      case 'deepseek':
        content = await callOpenAICompat(selectedPrompt, text, model, 'https://api.deepseek.com/v1', DEEPSEEK_KEY, 'DEEPSEEK', maxTokens);
        break;
      case 'opencode':
        content = await callOpenAICompat(selectedPrompt, text, model, OPENCODE_BASE, OPENCODE_KEY, 'OPENCODE', maxTokens);
        break;
      case 'openrouter':
        // OpenRouter masque volontairement le détail des erreurs 500 dans l'appel de
        // complétion (voir https://openrouter.ai/docs/api/reference/errors-and-debugging).
        // En cas d'échec pendant un test (debug), on interroge /key et /credits pour
        // révéler la vraie cause (clé invalide, crédits épuisés, rate limit) au lieu de
        // renvoyer un « Internal Server Error » opaque. En-têtes recommandés par OpenRouter.
        // jsonFormat désactivé : le pool de modèles gratuits OpenRouter a un support
        // inégal de response_format json_object (certains renvoient 400/404). On se
        // repose sur la consigne « retourne UNIQUEMENT du JSON » du prompt + le filet
        // extractJsonObject(), ce qui marche avec n'importe quel modèle du catalogue.
        try {
          content = await callOpenAICompat(selectedPrompt, text, model, 'https://openrouter.ai/api/v1', OPENROUTER_KEY, 'OPENROUTER', maxTokens, {
            jsonFormat: false,
            extraHeaders: {
              'HTTP-Referer': 'https://jfcyberknight.github.io/darkmedia-x_prompt-ai',
              'X-Title': 'DarkMedia Prompt AI',
            },
          });
        } catch (orErr) {
          if (debug) {
            const diag = await probeOpenRouter();
            throw new Error(`${orErr instanceof Error ? orErr.message : String(orErr)} — ${diag}`);
          }
          throw orErr;
        }
        break;
      default:
        return errResponse(400, `Provider inconnu : ${provider}`);
    }

    return new Response(content, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // Journalisé côté serveur (visible dans les logs Supabase) pour diagnostiquer les
    // 500 sans exposer le détail de l'erreur brute au client par défaut.
    console.error(`[ai-proxy] provider=${provider} action=${action} model=${model} error=`, err);
    const body: Record<string, unknown> = { error: err.message };
    // N'expose la topologie des clés (booléens de présence) et le modèle résolu que
    // sur demande explicite (bouton de test), pour diagnostiquer sans fuiter en temps normal.
    if (debug) {
      body.configured = keyStatus();
      body.model = model;
    }
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
