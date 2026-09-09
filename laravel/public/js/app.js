import { $, APP_VERSION } from './config.js';
import { setAppLoaderReady, showAppLoader, hideAppLoader } from './loader.js';
import { showToast } from './toast.js';
import { api } from './api-client.js';
import { loadCategories, loadPrompts } from './prompts-data.js';
import { bindSettingsForm } from './settings.js';
import { renderSidebar, renderPrompts } from './ui-renderer.js';
import { bindEvents } from './ui-events.js';
import { refreshInstallUI, triggerInstall } from './pwa.js';

// L'authentification est gérée par Cloudflare Access (Zero Trust).
// L'utilisateur arrive deja authentifie : pas de landing page, on va
// directement dans l'application. Si la session Laravel n'existe pas encore,
// le middleware cf.access la cree a partir du JWT Cloudflare Access.

export function showApp() {
  $('app').style.visibility = 'visible';
  Promise.all([loadCategories(), loadPrompts()]).then(() => {
    renderSidebar();
    renderPrompts();
    bindEvents();
    setAppLoaderReady(true);
    hideAppLoader();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  showAppLoader();
  bindSettingsForm();

  const versionEl = $('app-version');
  if (versionEl) {
    versionEl.textContent = `v${APP_VERSION}`;
    versionEl.title = `DarkMedia · Prompt AI — version ${APP_VERSION}`;
  }

  $('pwa-install-btn')?.addEventListener('click', triggerInstall);
  refreshInstallUI();

  try {
    await api('/api/me');
    showApp();
  } catch (_) {
    // Si l'API echoue (session expiree, CF Access non configure, etc.),
    // on recharge la page : CF Access redirigera vers la page de login.
    showToast('Session expirée — redirection vers Cloudflare Access.', 'error');
    setTimeout(() => window.location.reload(), 1500);
  }
});
