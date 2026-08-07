import { $ } from './config.js';
import { escHtml } from './utils.js';
import { showToast } from './toast.js';

export const AI_DEFAULT_MODELS = {
  gemini:    'gemini-2.0-flash',
  anthropic: 'claude-haiku-4-5',
  openai:    'gpt-4o-mini',
  deepseek:  'deepseek-chat',
  opencode:  'gpt-4o-mini',
  openrouter: 'deepseek/deepseek-chat-v3-0324',
};

export const AI_MODELS_BY_PROVIDER = {
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (rapide)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro (avancé)' },
  ],
  anthropic: [
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rapide, économique)' },
    { value: 'claude-sonnet-5',  label: 'Claude Sonnet 5 (équilibré)' },
    { value: 'claude-opus-4-8',  label: 'Claude Opus 4.8 (le plus capable)' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (rapide, économique)' },
    { value: 'gpt-4o',      label: 'GPT-4o (équilibré)' },
    { value: 'gpt-4.1',     label: 'GPT-4.1 (avancé)' },
  ],
  deepseek: [
    { value: 'deepseek-chat',     label: 'DeepSeek Chat' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (raisonnement)' },
  ],
  opencode: [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (rapide, économique)' },
    { value: 'gpt-4o',      label: 'GPT-4o (équilibré)' },
  ],
  openrouter: [
    { value: 'deepseek/deepseek-chat-v3-0324',        label: 'DeepSeek V3 (très économique, recommandé)' },
    { value: 'openai/gpt-4o-mini',                    label: 'GPT-4o mini (rapide, économique)' },
    { value: 'google/gemini-2.5-flash',               label: 'Gemini 2.5 Flash' },
    { value: 'meta-llama/llama-3.3-70b-instruct',     label: 'Llama 3.3 70B' },
    { value: 'anthropic/claude-sonnet-5',             label: 'Claude Sonnet 5 (équilibré)' },
    { value: 'anthropic/claude-opus-4-8',             label: 'Claude Opus 4.8 (le plus capable)' },
    { value: 'openrouter/fusion',                     label: 'Fusion (panel multi-modèles)' },
  ],
};

export function getAIConfig() {
  return {
    provider: localStorage.getItem('ai_provider') || 'openrouter',
    model:    localStorage.getItem('ai_model')    || '',
  };
}

export function updateModelHint(provider) {
  const hint = $('settings-ai-model-hint');
  if (hint) hint.textContent = `Défaut : ${AI_DEFAULT_MODELS[provider] || '—'}`;
}

export function populateModelOptions(provider, selectedModel) {
  const select = $('settings-ai-model');
  if (!select) return;
  const models = AI_MODELS_BY_PROVIDER[provider] || [];
  select.innerHTML = [
    `<option value="">Par défaut (${AI_DEFAULT_MODELS[provider] || '—'})</option>`,
    ...models.map(m => `<option value="${m.value}">${escHtml(m.label)}</option>`),
  ].join('');
  select.value = selectedModel && models.some(m => m.value === selectedModel) ? selectedModel : '';
}

export function bindSettingsForm() {
  $('settings-overlay')?.addEventListener('click', e => {
    if (e.target === $('settings-overlay')) closeSettings();
  });
  $('settings-ai-provider')?.addEventListener('change', e => {
    populateModelOptions(e.target.value, '');
    updateModelHint(e.target.value);
  });
}

export function openSettings() {
  const cfg = getAIConfig();
  $('settings-ai-provider').value = cfg.provider;
  populateModelOptions(cfg.provider, cfg.model);
  updateModelHint(cfg.provider);
  $('settings-overlay').classList.add('open');
}

export function closeSettings() {
  $('settings-overlay').classList.remove('open');
}

export function saveSettings() {
  const provider = $('settings-ai-provider').value;
  const model    = $('settings-ai-model').value.trim();
  localStorage.setItem('ai_provider', provider);
  if (model) {
    localStorage.setItem('ai_model', model);
  } else {
    localStorage.removeItem('ai_model');
  }
  showToast('Paramètres sauvegardés', 'success');
  closeSettings();
}
