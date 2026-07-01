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
  // Fusion : panel multi-modèles + synthèse (voir https://openrouter.ai/openrouter/fusion).
  // Surchargé par le secret OPENROUTER_MODEL s'il est défini.
  openrouter: Deno.env.get('OPENROUTER_MODEL') || 'openrouter/fusion',
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
  return stripJsonMarkdown(content);
}

interface OpenAICompatOptions {
  // Certains routeurs (ex : openrouter/auto) gèrent mal response_format json_object
  // et renvoient une 500 : on peut le désactiver et se reposer sur la consigne
  // "retourne UNIQUEMENT du JSON" du prompt.
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
  // Défensif : quand response_format n'est pas imposé, certains modèles encadrent
  // le JSON dans un bloc Markdown ```json … ``` — on le retire.
  return stripJsonMarkdown(content);
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
    // Plafond de génération. Par défaut 8000 ; un test de connexion peut demander
    // une petite valeur pour une réponse quasi instantanée. Borné entre 16 et 8000.
    const maxTokens = Math.min(Math.max(Number(requestedMaxTokens) || 8000, 16), 8000);

    // Diagnostic léger : vérifie la présence des clés sans appeler de provider.
    if (action === 'ping') {
      return new Response(JSON.stringify({ ok: true, provider, model, configured: keyStatus() }), {
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
        // Diagnostic : HTTP-Referer/X-Title retirés temporairement pour vérifier si
        // un filtrage par referrer côté OpenRouter cause le 500 générique observé
        // avec tous les modèles testés (auto, gpt-4o-mini, fusion).
        content = await callOpenAICompat(selectedPrompt, text, model, 'https://openrouter.ai/api/v1', OPENROUTER_KEY, 'OPENROUTER', maxTokens, {
          jsonFormat: false,
        });
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
