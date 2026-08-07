import { $ } from './config.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { toggleFavorite, incrementUsage } from './prompts-data.js';
import { renderSidebar, renderPrompts } from './ui-renderer.js';
import { openModal, closeModal, onFormSubmit, addTag, removeTag } from './ui-form.js';
import { openDetail, closeDetailModal, closeConfirm, executeDelete, copyFromDetail, openModalFromDetail, showHistory, confirmDelete } from './ui-detail.js';
import { logout } from './auth.js';
import { openSettings, closeSettings, saveSettings } from './settings.js';
import { autoCategorizePrompts, testAIConnection, analyzeWithAI, improveWithAI, upgradePromptWithAI, toggleAiParseSection, toggleAiImproveSection } from './ai-features.js';
import { triggerInstall, closePwaInstallModal } from './pwa.js';

export function bindEvents() {
  document.addEventListener('click', onGlobalClick);

  $('search-input')?.addEventListener('input', e => {
    state.filter.search = e.target.value;
    renderPrompts();
  });

  $('sort-select')?.addEventListener('change', e => {
    state.sort = e.target.value;
    renderPrompts();
  });

  $('modal-overlay')?.addEventListener('click', e => {
    if (e.target === $('modal-overlay')) closeModal();
  });
  $('detail-overlay')?.addEventListener('click', e => {
    if (e.target === $('detail-overlay')) closeDetailModal();
  });
  $('confirm-overlay')?.addEventListener('click', e => {
    if (e.target === $('confirm-overlay')) closeConfirm();
  });
  $('pwa-install-overlay')?.addEventListener('click', e => {
    if (e.target === $('pwa-install-overlay')) closePwaInstallModal();
  });

  $('prompt-form')?.addEventListener('submit', onFormSubmit);

  $('tag-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(e.target.value.trim());
    }
  });

  $('tag-input')?.addEventListener('blur', e => {
    if (e.target.value.trim()) addTag(e.target.value.trim());
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeDetailModal();
      closeConfirm();
      closePwaInstallModal();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      $('search-input')?.focus();
    }
  });
}

function setFilter(patch) {
  Object.assign(state.filter, patch);
  renderSidebar();
  renderPrompts();
}

function onGlobalClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) {
    const card = e.target.closest('.prompt-card');
    if (card && !e.target.closest('button') && !e.target.closest('.tag')) {
      openDetail(card.dataset.id);
    }
    return;
  }

  const action = el.dataset.action;

  switch (action) {
    case 'new-prompt':   openModal(); break;
    case 'filter-all':   setFilter({ category: null, favorites: false, tag: null }); break;
    case 'filter-favorites': setFilter({ favorites: !state.filter.favorites, category: null }); break;
    case 'filter-cat':   setFilter({ category: el.dataset.catId, favorites: false }); break;
    case 'filter-tag':   setFilter({ tag: el.dataset.tag, favorites: false }); break;
    case 'clear-filters': setFilter({ category: null, tag: null, favorites: false, search: '' }); $('search-input').value = ''; break;
    case 'toggle-fav':   toggleFavorite(el.dataset.id); break;
    case 'copy':         copyPrompt(el.dataset.id, el); break;
    case 'edit':         openModal(el.dataset.id); break;
    case 'delete':       confirmDelete(el.dataset.id); break;
    case 'logout':       logout(); break;
    case 'open-settings': openSettings(); break;
    case 'close-settings': closeSettings(); break;
    case 'save-settings': saveSettings(); break;
    case 'auto-categorize-prompts': autoCategorizePrompts(); break;
    case 'test-ai-connection': testAIConnection(); break;
    case 'close-modal':  closeModal(); break;
    case 'close-detail': closeDetailModal(); break;
    case 'close-confirm': closeConfirm(); break;
    case 'confirm-delete': executeDelete(); break;
    case 'copy-detail':  copyFromDetail(); break;
    case 'edit-from-detail': openModalFromDetail(); break;
    case 'show-history': showHistory(); break;
    case 'remove-tag':   removeTag(el.dataset.tag); break;
    case 'toggle-ai-parse': toggleAiParseSection(); break;
    case 'ai-analyze':   analyzeWithAI(); break;
    case 'toggle-ai-improve': toggleAiImproveSection(); break;
    case 'ai-improve':   improveWithAI(); break;
    case 'upgrade-prompt-ai': upgradePromptWithAI(el.dataset.id); break;
    case 'pwa-install':  triggerInstall(); break;
    case 'close-pwa-install': closePwaInstallModal(); break;
  }
}

export async function copyPrompt(id, btn) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  try {
    await navigator.clipboard.writeText(p.content);
    btn.classList.add('copy-success');
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copié !`;
    setTimeout(() => {
      btn.classList.remove('copy-success');
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copier`;
    }, 2000);
    await incrementUsage(id);
    renderPrompts();
  } catch {
    showToast('Impossible de copier', 'error');
  }
}
