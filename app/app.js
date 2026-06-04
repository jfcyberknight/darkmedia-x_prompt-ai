/* =============================================
   DarkMedia Prompt AI — Application Logic
   Dépendance : @supabase/supabase-js (CDN)
   ============================================= */

// ---- Init Supabase ----
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- State ----
let state = {
  prompts:      [],
  categories:   [],
  filter:       { category: null, tag: null, search: '', favorites: false },
  sort:         'created_at_desc',
  editingId:    null,
  viewingId:    null,
  tagInput:     [],
};

// ---- DOM refs ----
const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);

// ---- Bootstrap ----
document.addEventListener('DOMContentLoaded', async () => {
  bindLoginForm();
  bindSettingsForm();

  const { data: { session } } = await db.auth.getSession();
  if (session) {
    showApp();
  } else {
    showLoginScreen();
  }

  db.auth.onAuthStateChange((_event, session) => {
    if (session) showApp();
    else showLoginScreen();
  });
});

async function showApp() {
  $('login-overlay').style.display = 'none';
  $('app').style.visibility = 'visible';
  await Promise.all([loadCategories(), loadPrompts()]);
  renderSidebar();
  renderPrompts();
  bindEvents();
}

function showLoginScreen() {
  $('login-overlay').style.display = 'flex';
  $('app').style.visibility = 'hidden';
}

function bindLoginForm() {
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('login-btn');
    const errEl = $('login-error');
    btn.disabled = true;
    btn.textContent = 'Connexion…';
    errEl.style.display = 'none';

    const { error } = await db.auth.signInWithPassword({
      email: $('login-email').value.trim(),
      password: $('login-password').value,
    });

    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  });
}

function bindSettingsForm() {
  $('settings-overlay').addEventListener('click', e => {
    if (e.target === $('settings-overlay')) closeSettings();
  });
}

function openSettings() {
  $('settings-deepseek-key').value = localStorage.getItem('deepseek_api_key') || '';
  $('settings-overlay').classList.add('open');
}

function closeSettings() {
  $('settings-overlay').classList.remove('open');
}

function saveSettings() {
  const key = $('settings-deepseek-key').value.trim();
  if (key) localStorage.setItem('deepseek_api_key', key);
  else localStorage.removeItem('deepseek_api_key');
  closeSettings();
  showToast('Paramètres sauvegardés', 'success');
}

async function logout() {
  await db.auth.signOut();
  showToast('Déconnecté', 'success');
}

// =============================================
// DATA
// =============================================

async function loadCategories() {
  const { data, error } = await db.from('categories').select('*').order('name');
  if (error) return showToast('Erreur chargement catégories', 'error');
  state.categories = data;
}

async function loadPrompts() {
  const { data, error } = await db
    .from('prompts')
    .select('*, category:categories(id, name, color)')
    .order('created_at', { ascending: false });
  if (error) return showToast('Erreur chargement prompts', 'error');
  state.prompts = data;
}

async function savePrompt(payload) {
  if (state.editingId) {
    const { error } = await db
      .from('prompts')
      .update(payload)
      .eq('id', state.editingId);
    if (error) throw error;
    showToast('Prompt mis à jour', 'success');
  } else {
    const { error } = await db.from('prompts').insert(payload);
    if (error) throw error;
    showToast('Prompt ajouté', 'success');
  }
  await loadPrompts();
  renderSidebar();
  renderPrompts();
}

async function deletePrompt(id) {
  const { error } = await db.from('prompts').delete().eq('id', id);
  if (error) return showToast('Erreur suppression', 'error');
  state.prompts = state.prompts.filter(p => p.id !== id);
  showToast('Prompt supprimé', 'success');
  renderSidebar();
  renderPrompts();
}

async function toggleFavorite(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  const next = !p.is_favorite;
  const { error } = await db.from('prompts').update({ is_favorite: next }).eq('id', id);
  if (error) return showToast('Erreur mise à jour', 'error');
  p.is_favorite = next;
  renderPrompts();
  renderSidebar();
}

async function incrementUsage(id) {
  const p = state.prompts.find(p => p.id === id);
  if (!p) return;
  const next = (p.usage_count || 0) + 1;
  await db.from('prompts').update({ usage_count: next }).eq('id', id);
  p.usage_count = next;
}

async function loadVersions(promptId) {
  const { data } = await db
    .from('prompt_versions')
    .select('*')
    .eq('prompt_id', promptId)
    .order('version', { ascending: false })
    .limit(10);
  return data || [];
}

// =============================================
// FILTER / SORT
// =============================================

function filteredPrompts() {
  let list = [...state.prompts];

  if (state.filter.favorites) {
    list = list.filter(p => p.is_favorite);
  }

  if (state.filter.category) {
    list = list.filter(p => p.category_id === state.filter.category);
  }

  if (state.filter.tag) {
    list = list.filter(p => p.tags && p.tags.includes(state.filter.tag));
  }

  if (state.filter.search) {
    const q = state.filter.search.toLowerCase();
    list = list.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  switch (state.sort) {
    case 'created_at_desc': list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); break;
    case 'created_at_asc':  list.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)); break;
    case 'title_asc':       list.sort((a,b) => a.title.localeCompare(b.title)); break;
    case 'usage_desc':      list.sort((a,b) => (b.usage_count||0) - (a.usage_count||0)); break;
    case 'updated_desc':    list.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)); break;
  }

  return list;
}

function allTags() {
  const set = new Set();
  state.prompts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

// =============================================
// RENDER
// =============================================

function renderSidebar() {
  const sidebar = $('sidebar');
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
            <span class="cat-dot" style="background:${cat.color}"></span>
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

function renderPrompts() {
  const list = filteredPrompts();
  const grid = $('prompts-grid');
  const stats = $('stats-bar');

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

function renderCard(p) {
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
        ${cat ? `<span class="cat-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${escHtml(cat.name)}</span>` : ''}
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

// =============================================
// EVENTS
// =============================================

function bindEvents() {
  // Global delegation
  document.addEventListener('click', onGlobalClick);

  // Search
  $('search-input').addEventListener('input', e => {
    state.filter.search = e.target.value;
    renderPrompts();
  });

  // Sort
  $('sort-select').addEventListener('change', e => {
    state.sort = e.target.value;
    renderPrompts();
  });

  // Close modal on overlay click
  $('modal-overlay').addEventListener('click', e => {
    if (e.target === $('modal-overlay')) closeModal();
  });
  $('detail-overlay').addEventListener('click', e => {
    if (e.target === $('detail-overlay')) closeDetailModal();
  });
  $('confirm-overlay').addEventListener('click', e => {
    if (e.target === $('confirm-overlay')) closeConfirm();
  });

  // Modal form submit
  $('prompt-form').addEventListener('submit', onFormSubmit);

  // Tag input
  $('tag-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(e.target.value.trim());
    }
  });

  $('tag-input').addEventListener('blur', e => {
    if (e.target.value.trim()) addTag(e.target.value.trim());
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDetailModal(); closeConfirm(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      $('search-input').focus();
    }
  });
}

function onGlobalClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) {
    // Click on card body → open detail
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
    case 'logout':        logout(); break;
    case 'open-settings': openSettings(); break;
    case 'close-settings': closeSettings(); break;
    case 'save-settings': saveSettings(); break;
    case 'close-modal':  closeModal(); break;
    case 'close-detail': closeDetailModal(); break;
    case 'close-confirm': closeConfirm(); break;
    case 'confirm-delete': executeDelete(); break;
    case 'copy-detail':  copyFromDetail(); break;
    case 'edit-from-detail': openModalFromDetail(); break;
    case 'show-history': showHistory(); break;
    case 'remove-tag':   removeTag(el.dataset.tag); break;
    case 'toggle-ai-parse': toggleAiParseSection(); break;
    case 'ai-analyze':   analyzeWithDeepSeek(); break;
  }
}

function setFilter(patch) {
  Object.assign(state.filter, patch);
  renderSidebar();
  renderPrompts();
}

// =============================================
// COPY
// =============================================

async function copyPrompt(id, btn) {
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

// =============================================
// MODAL (ADD / EDIT)
// =============================================

function populateCategorySelect() {
  const sel = $('field-category');
  sel.innerHTML = '<option value="">— Aucune —</option>';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}

function openModal(id = null) {
  state.editingId = id;
  state.tagInput = [];

  const p = id ? state.prompts.find(p => p.id === id) : null;

  $('modal-title').textContent = id ? 'Modifier le prompt' : 'Nouveau prompt';
  populateCategorySelect();
  $('field-title').value        = p?.title || '';
  $('field-description').value  = p?.description || '';
  $('field-content').value      = p?.content || '';
  $('field-model').value        = p?.model || '';
  $('field-source').value       = p?.source || '';
  $('field-category').value     = p?.category_id || '';

  // Tags
  state.tagInput = [...(p?.tags || [])];
  renderTagsInput();

  $('modal-overlay').classList.add('open');
  setTimeout(() => $('field-title').focus(), 80);
}

function closeModal() {
  $('modal-overlay').classList.remove('open');
  state.editingId = null;
}

function renderTagsInput() {
  const wrap = $('tags-input-wrap');
  const input = $('tag-input');
  // Remove old chips
  wrap.querySelectorAll('.tag').forEach(el => el.remove());
  state.tagInput.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.innerHTML = `${escHtml(tag)}<button class="tag-remove" data-action="remove-tag" data-tag="${escAttr(tag)}" type="button">×</button>`;
    wrap.insertBefore(chip, input);
  });
}

function addTag(val) {
  const tag = val.toLowerCase().replace(/[^a-z0-9-_àâäéèêëîïôùûü]/g, '').trim();
  if (tag && !state.tagInput.includes(tag)) {
    state.tagInput.push(tag);
    renderTagsInput();
  }
  $('tag-input').value = '';
}

function removeTag(tag) {
  state.tagInput = state.tagInput.filter(t => t !== tag);
  renderTagsInput();
}

async function onFormSubmit(e) {
  e.preventDefault();
  const btn = $('save-btn');
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

// =============================================
// DETAIL MODAL
// =============================================

function openDetail(id) {
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
        ${cat ? `<span class="cat-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${escHtml(cat.name)}</span>` : ''}
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
      <button class="btn btn-ghost" data-action="edit-from-detail">Modifier</button>
      <button class="btn btn-primary" data-action="copy-detail">Copier le prompt</button>
    </div>
  `;

  $('detail-overlay').classList.add('open');
}

function closeDetailModal() {
  $('detail-overlay').classList.remove('open');
  state.viewingId = null;
}

async function copyFromDetail() {
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

function openModalFromDetail() {
  const id = state.viewingId;
  closeDetailModal();
  setTimeout(() => openModal(id), 150);
}

async function showHistory() {
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

// =============================================
// CONFIRM DELETE
// =============================================

let pendingDeleteId = null;

function confirmDelete(id) {
  const p = state.prompts.find(p => p.id === id);
  pendingDeleteId = id;
  $('confirm-title').textContent = `Supprimer « ${p?.title || 'ce prompt'} » ?`;
  $('confirm-overlay').classList.add('open');
}

function closeConfirm() {
  $('confirm-overlay').classList.remove('open');
  pendingDeleteId = null;
}

async function executeDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  closeConfirm();
  await deletePrompt(id);
}

// =============================================
// DEEPSEEK AI PARSE
// =============================================

function toggleAiParseSection() {
  const body = $('ai-parse-body');
  const toggle = $('ai-parse-toggle');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  toggle.classList.toggle('rotated', !isOpen);
  if (!isOpen) $('ai-paste-input').focus();
}

async function analyzeWithDeepSeek() {
  const text = $('ai-paste-input').value.trim();
  if (!text) { showToast('Colle du texte avant d\'analyser', 'error'); return; }

  const apiKey = localStorage.getItem('deepseek_api_key') || '';
  if (!apiKey) {
    showToast('Configure ta clé DeepSeek dans les Paramètres (⚙️)', 'error');
    openSettings();
    return;
  }

  const btn = $('ai-analyze-btn');
  const status = $('ai-parse-status');

  btn.disabled = true;
  btn.innerHTML = `<span class="loader"></span> Analyse en cours…`;
  status.textContent = '';

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Tu es un assistant qui extrait des informations structurées depuis un texte brut décrivant un ou plusieurs prompts IA.
Retourne UNIQUEMENT un objet JSON valide avec ces champs :
- title: string (titre court et descriptif, max 100 caractères)
- content: string (le contenu du prompt, propre et bien formaté)
- description: string (description courte de ce que fait ce prompt, max 200 caractères)
- tags: array of strings (mots-clés pertinents, max 8, en minuscules, sans espaces, ex: ["redaction","seo","marketing"])
- model: string (modèle IA mentionné dans le texte, sinon chaîne vide)
- source: string (source ou origine mentionnée, sinon chaîne vide)
Si plusieurs prompts sont détectés, extrais le plus important ou le premier.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!res.ok) throw new Error(`Erreur API : ${res.status}`);

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Réponse vide de DeepSeek');

    const parsed = JSON.parse(raw);

    // Remplir le formulaire
    if (parsed.title)       $('field-title').value       = parsed.title;
    if (parsed.description) $('field-description').value = parsed.description;
    if (parsed.content)     $('field-content').value     = parsed.content;
    if (parsed.model)       $('field-model').value       = parsed.model;
    if (parsed.source)      $('field-source').value      = parsed.source;

    if (Array.isArray(parsed.tags) && parsed.tags.length) {
      state.tagInput = [];
      parsed.tags.forEach(t => addTag(t));
    }

    // Tenter de matcher la catégorie par nom
    if (parsed.category) {
      const match = state.categories.find(c =>
        c.name.toLowerCase().includes(parsed.category.toLowerCase())
      );
      if (match) $('field-category').value = match.id;
    }

    status.textContent = '✓ Formulaire rempli automatiquement';
    status.style.color = 'var(--success, #22c55e)';

    // Refermer la section IA
    setTimeout(() => {
      $('ai-parse-body').classList.remove('open');
      $('ai-parse-toggle').classList.remove('rotated');
      $('ai-paste-input').value = '';
      status.textContent = '';
    }, 1500);

  } catch (err) {
    showToast('Erreur DeepSeek : ' + err.message, 'error');
    status.textContent = '';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Analyser avec DeepSeek`;
  }
}

// =============================================
// TOAST
// =============================================

function showToast(msg, type = 'success') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// =============================================
// HELPERS
// =============================================

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}
