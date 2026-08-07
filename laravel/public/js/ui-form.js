import { $, qs } from './config.js';
import { state } from './state.js';
import { escHtml, escAttr } from './utils.js';
import { showToast } from './toast.js';
import { savePrompt } from './prompts-data.js';

export function populateCategorySelect() {
  const sel = $('field-category');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Aucune —</option>';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}

export function openModal(id = null, prefilledData = null) {
  state.editingId = id;
  state.tagInput = [];

  const p = id ? state.prompts.find(p => p.id === id) : null;

  $('modal-title').textContent = prefilledData ? 'Modifier le prompt (Optimisé par l\'AI)' : (id ? 'Modifier le prompt' : 'Nouveau prompt');
  populateCategorySelect();
  $('field-title').value        = prefilledData?.title || p?.title || '';
  $('field-description').value  = prefilledData?.description || p?.description || '';
  $('field-content').value      = prefilledData?.content || p?.content || '';
  $('field-model').value        = prefilledData?.model || p?.model || '';
  $('field-source').value       = prefilledData?.source || p?.source || '';
  let matchedCategoryId = p?.category_id || '';
  if (prefilledData?.category) {
    const match = state.categories.find(c =>
      c.name.toLowerCase().includes(prefilledData.category.toLowerCase())
    );
    if (match) matchedCategoryId = match.id;
  }
  $('field-category').value = matchedCategoryId;

  state.tagInput = prefilledData?.tags ? [...prefilledData.tags] : [...(p?.tags || [])];
  renderTagsInput();

  if ($('ai-improve-input')) $('ai-improve-input').value = '';
  if ($('ai-improve-body')) $('ai-improve-body').classList.remove('open');
  if ($('ai-improve-toggle')) $('ai-improve-toggle').classList.remove('rotated');
  if ($('ai-improve-status')) $('ai-improve-status').textContent = '';

  $('modal-overlay').classList.add('open');

  const modalBody = qs('.modal-body', $('modal-overlay'));
  if (modalBody) modalBody.scrollTop = 0;

  setTimeout(() => {
    const titleField = $('field-title');
    if (titleField) titleField.focus({ preventScroll: true });
    if (modalBody) modalBody.scrollTop = 0;
  }, 150);
}

export function closeModal() {
  $('modal-overlay').classList.remove('open');
  state.editingId = null;
}

export function renderTagsInput() {
  const wrap = $('tags-input-wrap');
  const input = $('tag-input');
  if (!wrap || !input) return;
  wrap.querySelectorAll('.tag').forEach(el => el.remove());
  state.tagInput.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.innerHTML = `${escHtml(tag)}<button class="tag-remove" data-action="remove-tag" data-tag="${escAttr(tag)}" type="button">×</button>`;
    wrap.insertBefore(chip, input);
  });
}

export function addTag(val) {
  const tag = val.toLowerCase().replace(/[^a-z0-9-_àâäéèêëîïôùûü]/g, '').trim();
  if (tag && !state.tagInput.includes(tag)) {
    state.tagInput.push(tag);
    renderTagsInput();
  }
  $('tag-input').value = '';
}

export function removeTag(tag) {
  state.tagInput = state.tagInput.filter(t => t !== tag);
  renderTagsInput();
}

export async function onFormSubmit(e) {
  e.preventDefault();
  const btn = $('save-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = `<span class="loader"></span> Sauvegarde…`;

  const payload = {
    title:       $('field-title').value.trim(),
    description: $('field-description').value.trim() || null,
    content:     $('field-content').value.trim(),
    model:       $('field-model').value.trim() || null,
    source:      $('field-source').value.trim() || null,
    category_id: $('field-category').value || null,
    tags:        state.tagInput,
  };

  try {
    await savePrompt(payload);
    closeModal();
  } catch (err) {
    showToast('Erreur : ' + (err.message || 'inconnue'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Sauvegarder`;
  }
}
