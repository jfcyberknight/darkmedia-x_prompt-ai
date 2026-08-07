export const state = {
  prompts:      [],
  categories:   [],
  filter:       { category: null, tag: null, search: '', favorites: false },
  sort:         'created_at_desc',
  editingId:    null,
  viewingId:    null,
  tagInput:     [],
};

export function filteredPrompts() {
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
    case 'created_at_desc': list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
    case 'created_at_asc':  list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
    case 'title_asc':       list.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'usage_desc':      list.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)); break;
    case 'updated_desc':    list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)); break;
  }

  return list;
}

export function allTags() {
  const set = new Set();
  state.prompts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}
