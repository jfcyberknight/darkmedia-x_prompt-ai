import { $ } from './config.js';
import { state, filteredPrompts, allTags } from './state.js';
import { escHtml, escAttr, safeColor } from './utils.js';

export function renderSidebar() {
  const sidebar = $('sidebar');
  if (!sidebar) return;

  const total = state.prompts.length;
  const favCount = state.prompts.filter(p => p.is_favorite).length;

  const catCounts = {};
  state.prompts.forEach(p => {
    if (p.category_id) catCounts[p.category_id] = (catCounts[p.category_id] || 0) + 1;
  });

  sidebar.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-label">Vue</div>
      <div class="sidebar-item ${!state.filter.category && !state.filter.favorites ? 'active' : ''}"
           data-action="filter-all">
        <span class="sidebar-item-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          Tous les prompts
        </span>
        <span class="badge">${total}</span>
      </div>
      <div class="sidebar-item ${state.filter.favorites ? 'active' : ''}"
           data-action="filter-favorites">
        <span class="sidebar-item-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${state.filter.favorites ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Favoris
        </span>
        <span class="badge">${favCount}</span>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label">Catégories</div>
      ${state.categories.map(cat => `
        <div class="sidebar-item ${state.filter.category === cat.id ? 'active' : ''}"
             data-action="filter-cat" data-cat-id="${cat.id}">
          <span class="sidebar-item-left">
            <span class="cat-dot" style="background:${safeColor(cat.color)}"></span>
            ${escHtml(cat.name)}
          </span>
          <span class="badge">${catCounts[cat.id] || 0}</span>
        </div>
      `).join('')}
    </div>

    ${allTags().length > 0 ? `
      <div class="sidebar-section">
        <div class="sidebar-label">Tags populaires</div>
        ${allTags().slice(0, 12).map(tag => `
          <div class="sidebar-item ${state.filter.tag === tag ? 'active' : ''}"
               data-action="filter-tag" data-tag="${escAttr(tag)}">
            <span class="sidebar-item-left">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
              </svg>
              ${escHtml(tag)}
            </span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

export function renderPrompts() {
  const grid = $('prompts-grid');
  const stats = $('stats-bar');
  if (!grid || !stats) return;

  const list = filteredPrompts();

  stats.innerHTML = `
    <strong>${list.length}</strong> prompt${list.length !== 1 ? 's' : ''}
    ${state.filter.search ? `<span>· recherche : <strong>${escHtml(state.filter.search)}</strong></span>` : ''}
    ${state.filter.category ? `<span>· catégorie filtrée</span>` : ''}
    ${state.filter.tag ? `<span>· tag : <strong>${escHtml(state.filter.tag)}</strong></span>` : ''}
    ${state.filter.favorites ? `<span>· favoris seulement</span>` : ''}
    ${state.filter.category || state.filter.tag || state.filter.favorites || state.filter.search
      ? `<button class="btn btn-ghost" style="padding:2px 8px;font-size:0.75rem;" data-action="clear-filters">Effacer les filtres</button>`
      : ''}
  `;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <h3>Aucun prompt trouvé</h3>
        <p>${state.filter.search || state.filter.category || state.filter.tag
          ? 'Essaie de modifier tes filtres ou ta recherche.'
          : 'Commence par ajouter ton premier prompt !'}</p>
        ${!state.filter.search && !state.filter.category && !state.filter.tag
          ? `<button class="btn btn-primary" data-action="new-prompt">Ajouter un prompt</button>`
          : ''}
      </div>`;
    return;
  }

  grid.innerHTML = list.map(p => renderCard(p)).join('');
}

export function renderCard(p) {
  const cat = state.categories.find(c => c.id === p.category_id);
  const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });

  return `
    <div class="prompt-card ${p.is_favorite ? 'favorite' : ''}" data-id="${p.id}">
      <div class="card-header">
        <div class="card-title">${escHtml(p.title)}</div>
        <button class="card-fav-btn ${p.is_favorite ? 'active' : ''}" data-action="toggle-fav" data-id="${p.id}" title="${p.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${p.is_favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>

      ${p.description ? `<div class="card-description">${escHtml(p.description)}</div>` : ''}

      <div class="card-preview">${escHtml(p.content)}</div>

      <div class="card-meta">
        ${cat ? (c => `<span class="cat-badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${escHtml(cat.name)}</span>`)(safeColor(cat.color)) : ''}
        ${p.model ? `<span class="model-badge">${escHtml(p.model)}</span>` : ''}
        ${(p.tags || []).slice(0, 3).map(t => `<span class="tag" data-action="filter-tag" data-tag="${escAttr(t)}">#${escHtml(t)}</span>`).join('')}
        ${(p.tags || []).length > 3 ? `<span class="tag">+${p.tags.length - 3}</span>` : ''}
      </div>

      <div class="card-footer">
        <span class="card-date">${date}${p.usage_count ? ` · ${p.usage_count} util.` : ''}</span>
        <div class="card-actions">
          <button class="icon-btn" data-action="copy" data-id="${p.id}" title="Copier">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copier
          </button>
          <button class="icon-btn" data-action="edit" data-id="${p.id}" title="Modifier">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="icon-btn danger" data-action="delete" data-id="${p.id}" title="Supprimer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}
