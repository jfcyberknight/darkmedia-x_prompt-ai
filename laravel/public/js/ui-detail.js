import { $, qs } from './config.js';
import { state } from './state.js';
import { escHtml, safeColor } from './utils.js';
import { showToast } from './toast.js';
import { loadVersions, deletePrompt, incrementUsage } from './prompts-data.js';
import { openModal } from './ui-form.js';
import { renderPrompts } from './ui-renderer.js';

let pendingDeleteId = null;

export function openDetail(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  state.viewingId = id;

  const cat = state.categories.find(c => c.id === p.category_id);
  const date = new Date(p.created_at).toLocaleString('fr-FR');
  const updated = new Date(p.updated_at).toLocaleString('fr-FR');

  $('detail-modal').innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${escHtml(p.title)}</h2>
      <button class="modal-close" data-action="close-detail">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      ${p.description ? `<div>
        <div class="detail-label">Description</div>
        <p style="font-size:0.88rem;color:var(--text-secondary)">${escHtml(p.description)}</p>
      </div>` : ''}

      <div>
        <div class="detail-label">Prompt</div>
        <div class="detail-content">${escHtml(p.content)}</div>
      </div>

      <div class="detail-meta">
        ${cat ? (c => `<span class="cat-badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${escHtml(cat.name)}</span>`)(safeColor(cat.color)) : ''}
        ${p.model ? `<span class="model-badge">${escHtml(p.model)}</span>` : ''}
        ${(p.tags || []).map(t => `<span class="tag">#${escHtml(t)}</span>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;font-size:0.82rem;">
        <div>
          <div class="detail-label">Créé le</div>
          <span style="color:var(--text-secondary)">${date}</span>
        </div>
        <div>
          <div class="detail-label">Modifié le</div>
          <span style="color:var(--text-secondary)">${updated}</span>
        </div>
        ${p.source ? `<div>
          <div class="detail-label">Source</div>
          <span style="color:var(--text-secondary)">${escHtml(p.source)}</span>
        </div>` : ''}
        <div>
          <div class="detail-label">Utilisations</div>
          <span style="color:var(--text-secondary)">${p.usage_count || 0}</span>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-action="show-history">Historique</button>
      <button class="btn btn-ghost" id="detail-upgrade-btn" data-action="upgrade-prompt-ai" data-id="${p.id}" style="color:var(--accent)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        Améliorer par l'AI
      </button>
      <button class="btn btn-ghost" data-action="edit-from-detail">Modifier</button>
      <button class="btn btn-primary" data-action="copy-detail">Copier le prompt</button>
    </div>
  `;

  $('detail-overlay').classList.add('open');
}

export function closeDetailModal() {
  $('detail-overlay').classList.remove('open');
  state.viewingId = null;
}

export async function copyFromDetail() {
  const p = state.prompts.find(p => p.id === state.viewingId);
  if (!p) return;
  try {
    await navigator.clipboard.writeText(p.content);
    showToast('Prompt copié dans le presse-papier', 'success');
    await incrementUsage(p.id);
    renderPrompts();
  } catch {
    showToast('Impossible de copier', 'error');
  }
}

export function openModalFromDetail() {
  const id = state.viewingId;
  closeDetailModal();
  setTimeout(() => openModal(id), 150);
}

export async function showHistory() {
  const versions = await loadVersions(state.viewingId);
  const historyEl = qs('[data-section="history"]', $('detail-modal')) || document.createElement('div');
  historyEl.setAttribute('data-section', 'history');
  historyEl.style.cssText = 'margin-top:0.5rem';

  if (versions.length === 0) {
    historyEl.innerHTML = `<div class="detail-label" style="margin-bottom:0.4rem">Historique</div>
      <p style="font-size:0.82rem;color:var(--text-muted)">Aucune version précédente.</p>`;
  } else {
    historyEl.innerHTML = `
      <div class="detail-label" style="margin-bottom:0.4rem">Historique des versions</div>
      <div class="version-list">
        ${versions.map(v => `
          <div class="version-item">
            <div class="version-item-left">
              <span class="version-num">v${v.version} — ${escHtml(v.title)}</span>
              <span class="version-date">${new Date(v.created_at).toLocaleString('fr-FR')}</span>
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  const body = qs('.modal-body', $('detail-modal'));
  const existing = qs('[data-section="history"]', $('detail-modal'));
  if (existing) existing.remove();
  body.appendChild(historyEl);
}

export function confirmDelete(id) {
  const p = state.prompts.find(p => p.id === id);
  pendingDeleteId = id;
  $('confirm-title').textContent = `Supprimer « ${p?.title || 'ce prompt'} » ?`;
  $('confirm-overlay').classList.add('open');
}

export function closeConfirm() {
  $('confirm-overlay').classList.remove('open');
  pendingDeleteId = null;
}

export async function executeDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  closeConfirm();
  await deletePrompt(id);
}
