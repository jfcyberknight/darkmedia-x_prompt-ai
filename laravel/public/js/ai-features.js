import { $ } from './config.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { getAIConfig } from './settings.js';
import { api } from './api-client.js';
import { addTag, openModal } from './ui-form.js';
import { closeDetailModal } from './ui-detail.js';
import { loadPrompts } from './prompts-data.js';
import { renderSidebar, renderPrompts } from './ui-renderer.js';

export function toggleAiParseSection() {
  const body = $('ai-parse-body');
  const toggle = $('ai-parse-toggle');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  toggle.classList.toggle('rotated', !isOpen);
  if (!isOpen) $('ai-paste-input').focus();
}

export async function callAiProxy(body, message = '') {
  const data = await api('/api/ai', { method: 'POST', body, loadingMessage: message });
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function analyzeWithAI() {
  const text = $('ai-paste-input').value.trim();
  if (!text) { showToast('Colle du texte avant d\'analyser', 'error'); return; }

  const btn = $('ai-analyze-btn');
  const status = $('ai-parse-status');

  btn.disabled = true;
  btn.innerHTML = `<span class="loader"></span> Analyse en cours…`;
  status.textContent = '';

  try {
    const aiCfg = getAIConfig();
    const parsed = await callAiProxy({ text, provider: aiCfg.provider, model: aiCfg.model || undefined }, 'Analyse par l\'AI en cours…');

    if (parsed.title)       $('field-title').value       = parsed.title;
    if (parsed.description) $('field-description').value = parsed.description;
    if (parsed.content)     $('field-content').value     = parsed.content;
    if (parsed.model)       $('field-model').value       = parsed.model;
    if (parsed.source)      $('field-source').value      = parsed.source;

    if (Array.isArray(parsed.tags) && parsed.tags.length) {
      state.tagInput = [];
      parsed.tags.forEach(t => addTag(t));
    }

    if (parsed.category) {
      const match = state.categories.find(c =>
        c.name.toLowerCase().includes(parsed.category.toLowerCase())
      );
      if (match) $('field-category').value = match.id;
    }

    status.textContent = '✓ Formulaire rempli automatiquement';
    status.style.color = 'var(--success, #22c55e)';

    setTimeout(() => {
      $('ai-parse-body').classList.remove('open');
      $('ai-parse-toggle').classList.remove('rotated');
      $('ai-paste-input').value = '';
      status.textContent = '';
    }, 1500);

  } catch (err) {
    showToast('Erreur AI : ' + err.message, 'error');
    status.textContent = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Analyser avec l'AI`;
  }
}

export function toggleAiImproveSection() {
  const body = $('ai-improve-body');
  const toggle = $('ai-improve-toggle');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  toggle.classList.toggle('rotated', !isOpen);
  if (!isOpen) $('ai-improve-input').focus();
}

export async function improveWithAI() {
  const content = $('field-content').value.trim();
  if (!content) {
    showToast('Ajoute d\'abord un contenu de prompt à améliorer', 'error');
    return;
  }

  const instruction = $('ai-improve-input').value.trim();
  const btn = $('ai-improve-btn');
  const status = $('ai-improve-status');
  const originalHtml = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = `<span class="loader"></span> Amélioration en cours…`;
  status.textContent = '';

  const textToOptimize = [
    `Titre actuel : ${$('field-title').value.trim()}`,
    `Description actuelle : ${$('field-description').value.trim()}`,
    `Modèle recommandé : ${$('field-model').value.trim()}`,
    `Tags actuels : ${state.tagInput.join(', ')}`,
    `Prompt à améliorer :\n${content}`,
  ].join('\n');

  try {
    const aiCfg = getAIConfig();
    const parsed = await callAiProxy({ text: textToOptimize, action: 'upgrade', instruction, provider: aiCfg.provider, model: aiCfg.model || undefined }, 'Amélioration du prompt…');

    if (parsed.title)       $('field-title').value       = parsed.title;
    if (parsed.description) $('field-description').value = parsed.description;
    if (parsed.content)     $('field-content').value     = parsed.content;
    if (parsed.model)       $('field-model').value       = parsed.model;
    if (parsed.source)      $('field-source').value      = parsed.source;

    if (Array.isArray(parsed.tags) && parsed.tags.length) {
      state.tagInput = [];
      parsed.tags.forEach(t => addTag(t));
    }

    if (parsed.category) {
      const match = state.categories.find(c =>
        c.name.toLowerCase().includes(parsed.category.toLowerCase())
      );
      if (match) $('field-category').value = match.id;
    }

    status.textContent = '✓ Prompt amélioré — vérifie puis sauvegarde';
    status.style.color = 'var(--success, #22c55e)';

    setTimeout(() => {
      $('ai-improve-body').classList.remove('open');
      $('ai-improve-toggle').classList.remove('rotated');
      status.textContent = '';
    }, 2500);

  } catch (err) {
    showToast('Erreur d\'amélioration : ' + err.message, 'error');
    status.textContent = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

export async function upgradePromptWithAI(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;

  const btn = $('detail-upgrade-btn');
  const originalHtml = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = `<span class="loader"></span> Optimisation...`;

  const textToOptimize = `Titre actuel : ${p.title}\nDescription actuelle : ${p.description || ''}\nModèle recommandé : ${p.model || ''}\nTags actuels : ${(p.tags || []).join(', ')}\nPrompt à optimiser :\n${p.content}`;

  try {
    const aiCfg = getAIConfig();
    const parsed = await callAiProxy({ text: textToOptimize, action: 'upgrade', provider: aiCfg.provider, model: aiCfg.model || undefined }, 'Optimisation du prompt…');

    closeDetailModal();
    openModal(id, parsed);
    showToast('Prompt optimisé par l\'AI (prêt à être enregistré)', 'success');

  } catch (err) {
    showToast('Erreur d\'optimisation : ' + err.message, 'error');
  } finally {
    if ($('detail-upgrade-btn')) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

export async function autoCategorizePrompts() {
  const btn = $('btn-auto-categorize');
  if (!btn) return;

  const prompts = state.prompts.filter(p => !p.category_id);

  if (prompts.length === 0) {
    showToast('Tous les prompts ont déjà une catégorie !', 'success');
    return;
  }

  const originalHtml = btn.innerHTML;
  btn.disabled = true;

  let successCount = 0;
  let firstError = null;

  try {
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      btn.innerHTML = `<span class="loader"></span> Traitement ${i + 1}/${prompts.length}...`;

      const textToAnalyze = `Titre : ${p.title}\nDescription : ${p.description || ''}\nPrompt :\n${p.content}`;

      try {
        const aiCfg = getAIConfig();
        const parsed = await callAiProxy({ text: textToAnalyze, action: 'extract', provider: aiCfg.provider, model: aiCfg.model || undefined }, `Catégorisation ${i + 1}/${prompts.length}…`);
        const categoryName = parsed.category;

        if (!categoryName) continue;

        const matchedCat = state.categories.find(c =>
          c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
          categoryName.toLowerCase().includes(c.name.toLowerCase())
        );

        if (!matchedCat) continue;

        try {
          await api(`/api/prompts/${p.id}`, {
            method: 'PUT',
            body: {
              title: p.title,
              content: p.content,
              description: p.description,
              model: p.model,
              source: p.source,
              tags: p.tags || [],
              category_id: matchedCat.id,
            },
          });
          successCount++;
        } catch (_) { /* on continue avec les suivants */ }
      } catch (e) {
        if (!firstError) firstError = e.message;
      }
    }

    if (successCount > 0) {
      showToast(`${successCount} prompt(s) catégorisé(s) avec succès !`, 'success');
      await loadPrompts();
      renderSidebar();
      renderPrompts();
    } else if (firstError) {
      showToast('Échec de la catégorisation : ' + firstError, 'error');
    } else {
      showToast('Aucun prompt n\'a pu être catégorisé.', 'warning');
    }

  } catch (err) {
    showToast('Erreur lors de la catégorisation : ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

export async function testAIConnection() {
  const btn = $('btn-test-ai');
  const statusEl = $('settings-ai-test-status');
  if (!btn) return;

  const provider = $('settings-ai-provider').value;
  const model = $('settings-ai-model').value.trim();
  const originalHtml = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = `<span class="loader"></span> Test en cours…`;
  if (statusEl) { statusEl.textContent = ''; statusEl.style.color = 'var(--text-secondary)'; }

  try {
    await callAiProxy({ text: 'Test de connexion. Réponds avec un court JSON.', action: 'extract', provider, model: model || undefined, maxTokens: 300, debug: true }, 'Test de connexion IA…');

    if (statusEl) { statusEl.textContent = `✓ Connexion réussie (${provider})`; statusEl.style.color = '#22c55e'; }
    showToast('Connexion IA réussie', 'success');
  } catch (err) {
    if (statusEl) { statusEl.textContent = `✗ ${err.message}`; statusEl.style.color = '#ef4444'; }
    showToast('Échec du test IA', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}
