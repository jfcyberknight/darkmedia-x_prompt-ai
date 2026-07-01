import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_KEY    = Deno.env.get('GEMINI_KEY')    ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY') ?? '';
const OPENAI_KEY    = Deno.env.get('OPENAI_KEY')    ?? '';
const DEEPSEEK_KEY  = Deno.env.get('DEEPSEEK_KEY')  ?? '';
const OPENCODE_KEY  = Deno.env.get('OPENCODE_KEY')  ?? '';
const OPENCODE_BASE = Deno.env.get('OPENCODE_BASE_URL') ?? 'https://api.openai.com/v1';
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_KEY') ?? '';

const DEFAULT_MODELS: Record<string, string> = {
  gemini:     'gemini-2.0-flash',
  anthropic:  'claude-haiku-4-5',
  openai:     'gpt-4o-mini',
  deepseek:   'deepseek-chat',
  opencode:   'gpt-4o-mini',
  openrouter: 'openrouter/auto',
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

function errResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function callGemini(systemPrompt: string, text: string, model: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error('GEMINI_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 8000 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty response from Gemini');
  return content;
}

async function callAnthropic(systemPrompt: string, text: string, model: string): Promise<string> {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
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

async function callOpenAICompat(systemPrompt: string, text: string, model: string, baseUrl: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error(`API key not configured for provider`);
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 8000,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from API');
  return content;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, action = 'extract', instruction = '', provider = 'gemini', model: requestedModel = '' } = await req.json();

    if (!text) return errResponse(400, 'text is required');

    const model = requestedModel || DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;

    let selectedPrompt = action === 'upgrade' ? UPGRADE_PROMPT : SYSTEM_PROMPT;
    if (action === 'upgrade' && typeof instruction === 'string' && instruction.trim()) {
      selectedPrompt += `\n\nCONSIGNES PRIORITAIRES DE L'UTILISATEUR pour orienter l'amélioration (respecte-les en priorité) :\n${instruction.trim()}`;
    }

    let content: string;

    switch (provider) {
      case 'gemini':
        content = await callGemini(selectedPrompt, text, model);
        break;
      case 'anthropic':
        content = await callAnthropic(selectedPrompt, text, model);
        break;
      case 'openai':
        content = await callOpenAICompat(selectedPrompt, text, model, 'https://api.openai.com/v1', OPENAI_KEY);
        break;
      case 'deepseek':
        content = await callOpenAICompat(selectedPrompt, text, model, 'https://api.deepseek.com/v1', DEEPSEEK_KEY);
        break;
      case 'opencode':
        content = await callOpenAICompat(selectedPrompt, text, model, OPENCODE_BASE, OPENCODE_KEY);
        break;
      case 'openrouter':
        content = await callOpenAICompat(selectedPrompt, text, model, 'https://openrouter.ai/api/v1', OPENROUTER_KEY);
        break;
      default:
        return errResponse(400, `Provider inconnu : ${provider}`);
    }

    return new Response(content, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
