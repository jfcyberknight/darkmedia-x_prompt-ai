import { $, APP_VERSION } from './config.js';
import { setUnauthorizedHandler } from './api-client.js';
import { setAppLoaderReady, hideAppLoader } from './loader.js';
import { showToast } from './toast.js';
import { api } from './api-client.js';
import { loadCategories, loadPrompts } from './prompts-data.js';
import { bindLoginForm, configureAuth } from './auth.js';
import { bindSettingsForm } from './settings.js';
import { renderSidebar, renderPrompts } from './ui-renderer.js';
import { bindEvents } from './ui-events.js';
import { refreshInstallUI, triggerInstall } from './pwa.js';

export function showApp() {
  $('login-overlay').style.display = 'none';
  $('app').style.visibility = 'visible';
  Promise.all([loadCategories(), loadPrompts()]).then(() => {
    renderSidebar();
    renderPrompts();
    bindEvents();
    setAppLoaderReady(true);
    hideAppLoader();
  });
}

export function showLoginScreen() {
  $('login-overlay').style.display = 'flex';
  $('app').style.visibility = 'hidden';
  setAppLoaderReady(false);
  hideAppLoader();
}

setUnauthorizedHandler(showLoginScreen);
configureAuth({ showLoginScreen });

document.addEventListener('DOMContentLoaded', async () => {
  bindLoginForm();
  bindSettingsForm();

  const versionEl = $('app-version');
  if (versionEl) {
    versionEl.textContent = `v${APP_VERSION}`;
    versionEl.title = `DarkMedia · Prompt AI — version ${APP_VERSION}`;
  }

  $('pwa-install-btn')?.addEventListener('click', triggerInstall);
  $('landing-install-btn')?.addEventListener('click', triggerInstall);
  refreshInstallUI();

  const params = new URLSearchParams(window.location.search);
  if (params.get('login_error') === 'expired') {
    history.replaceState(null, '', window.location.pathname);
    showToast('Lien de connexion expiré ou déjà utilisé — redemande un lien.', 'error');
  }

  try {
    await api('/api/me');
    showApp();
  } catch (_) {
    showLoginScreen();
  }
});
