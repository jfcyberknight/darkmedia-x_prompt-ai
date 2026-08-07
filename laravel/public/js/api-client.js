import { $ } from './config.js';
import { trackApiStart, trackApiEnd } from './loader.js';

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// Le cookie XSRF-TOKEN est posé par Laravel ; on le renvoie en en-tête
// X-XSRF-TOKEN pour que la protection CSRF accepte les requêtes mutantes.
function xsrfToken() {
  const match = document.cookie.match(/(?:^|;)\s*XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function api(path, options = {}) {
  const { method = 'GET', body, loadingMessage } = options;
  const headers = { 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-XSRF-TOKEN'] = xsrfToken();

  trackApiStart(loadingMessage);

  try {
    const res = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      if (typeof onUnauthorized === 'function') onUnauthorized();
      throw new Error('Session expirée — reconnecte-toi.');
    }

    let data = null;
    try { data = await res.json(); } catch (_) { /* réponse vide */ }

    if (!res.ok) {
      const msg = data?.error || data?.message || `Erreur ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } finally {
    trackApiEnd();
  }
}
