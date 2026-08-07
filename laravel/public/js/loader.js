import { $ } from './config.js';

let apiLoadingCount = 0;
let appLoaderTimer = null;
let appLoaderReady = false;
let appLoaderShownAt = 0;
const MIN_LOADER_VISIBLE_MS = 800;

export function setAppLoaderReady(value) {
  appLoaderReady = value;
}

export function isAppLoaderReady() {
  return appLoaderReady;
}

export function showAppLoader(message = '') {
  const loader = $('app-loader');
  if (!loader) return;
  appLoaderShownAt = Date.now();
  const status = $('app-loader-status');
  if (status) status.textContent = message || '';
  loader.classList.remove('hidden');
}

export function hideAppLoader() {
  const loader = $('app-loader');
  if (!loader) return;
  const elapsed = Date.now() - appLoaderShownAt;
  const delay = Math.max(0, MIN_LOADER_VISIBLE_MS - elapsed);
  setTimeout(() => {
    loader.classList.add('hidden');
  }, delay);
}

export function setAppLoaderMessage(message) {
  const status = $('app-loader-status');
  if (status) status.textContent = message || '';
}

export function trackApiStart(message = '') {
  apiLoadingCount++;
  if (message) setAppLoaderMessage(message);
  if (!appLoaderTimer) {
    appLoaderTimer = setTimeout(() => {
      if (apiLoadingCount > 0) showAppLoader();
    }, 300);
  }
}

export function trackApiEnd() {
  apiLoadingCount--;
  if (apiLoadingCount <= 0) {
    clearTimeout(appLoaderTimer);
    appLoaderTimer = null;
    if (appLoaderReady) hideAppLoader();
  }
}
