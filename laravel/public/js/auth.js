import { $ } from './config.js';
import { api } from './api-client.js';
import { showToast } from './toast.js';

let authHandlers = {};

export function configureAuth(handlers) {
  authHandlers = { ...authHandlers, ...handlers };
}

export function bindLoginForm() {
  $('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('login-btn');
    const errEl = $('login-error');
    const successEl = $('login-success');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Envoi…';
    errEl && (errEl.style.display = 'none');
    successEl && (successEl.style.display = 'none');

    try {
      const data = await api('/auth/magic-link', {
        method: 'POST',
        body: { email: $('login-email').value.trim() },
      });
      if (successEl) {
        successEl.textContent = data?.message || 'Lien envoyé ! Vérifie ta boîte mail et clique sur le lien pour te connecter.';
        successEl.style.display = 'block';
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Recevoir mon lien de connexion';
    }
  });
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST', loadingMessage: 'Déconnexion…' });
  } catch (_) { /* la session est peut-être déjà expirée */ }
  showToast('Déconnecté', 'success');
  if (typeof authHandlers.showLoginScreen === 'function') {
    authHandlers.showLoginScreen();
  }
}
