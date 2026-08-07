import { $, APP_VERSION } from './config.js';
import { showToast } from './toast.js';

let deferredPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`)
      .then(reg => console.log('Service Worker registered successfully:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

export function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function refreshInstallUI() {
  const installed = isAppInstalled();
  const topBtn = $('pwa-install-btn');
  const landingWrap = $('landing-install-wrap');
  if (topBtn) topBtn.style.display = installed ? 'none' : '';
  if (landingWrap) landingWrap.style.display = installed ? 'none' : '';
}

export async function triggerInstall() {
  if (!deferredPrompt) {
    openPwaInstallModal();
    return;
  }
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
  } catch (err) {
    console.error('Installation failed:', err);
  } finally {
    deferredPrompt = null;
    document.querySelectorAll('.installable-pulse')
      .forEach(el => el.classList.remove('installable-pulse'));
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('pwa-install-btn')?.classList.add('installable-pulse');
  $('landing-install-btn')?.classList.add('installable-pulse');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  document.querySelectorAll('.installable-pulse')
    .forEach(el => el.classList.remove('installable-pulse'));
  refreshInstallUI();
  showToast('Application installée avec succès !', 'success');
});

export function openPwaInstallModal() {
  $('pwa-install-overlay').classList.add('open');
}

export function closePwaInstallModal() {
  $('pwa-install-overlay').classList.remove('open');
}
