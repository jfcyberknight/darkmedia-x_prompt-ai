import { api } from './api-client.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { renderSidebar, renderPrompts } from './ui-renderer.js';

export async function loadCategories() {
  try {
    state.categories = await api('/api/categories');
  } catch (_) {
    showToast('Erreur chargement catégories', 'error');
  }
}

export async function loadPrompts() {
  try {
    state.prompts = await api('/api/prompts');
  } catch (_) {
    showToast('Erreur chargement prompts', 'error');
  }
}

export async function savePrompt(payload) {
  if (state.editingId) {
    await api(`/api/prompts/${state.editingId}`, { method: 'PUT', body: payload, loadingMessage: 'Mise à jour…' });
    showToast('Prompt mis à jour', 'success');
  } else {
    await api('/api/prompts', { method: 'POST', body: payload, loadingMessage: 'Ajout…' });
    showToast('Prompt ajouté', 'success');
  }
  await loadPrompts();
  renderSidebar();
  renderPrompts();
}

export async function deletePrompt(id) {
  try {
    await api(`/api/prompts/${id}`, { method: 'DELETE', loadingMessage: 'Suppression…' });
  } catch (_) {
    return showToast('Erreur suppression', 'error');
  }
  state.prompts = state.prompts.filter(p => p.id !== id);
  showToast('Prompt supprimé', 'success');
  renderSidebar();
  renderPrompts();
}

export async function toggleFavorite(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  try {
    const data = await api(`/api/prompts/${id}/favorite`, { method: 'POST' });
    p.is_favorite = data.is_favorite;
  } catch (_) {
    return showToast('Erreur mise à jour', 'error');
  }
  renderPrompts();
  renderSidebar();
}

export async function incrementUsage(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  try {
    const data = await api(`/api/prompts/${id}/usage`, { method: 'POST' });
    p.usage_count = data.usage_count;
  } catch (_) { /* non bloquant */ }
}

export async function loadVersions(promptId) {
  try {
    return await api(`/api/prompts/${promptId}/versions`);
  } catch (_) {
    return [];
  }
}
