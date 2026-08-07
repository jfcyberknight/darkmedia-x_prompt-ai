import { $ } from './config.js';

let apiLoadingCount = 0;
let appLoaderTimer = null;
let appLoaderReady = false;

export function setAppLoaderReady(value) {
  appLoaderReady = value;
}

export function isAppLoaderReady() {
  return appLoaderReady;
}

export function showAppLoader(message = '') {
  const loader = $('app-loader');
  if (!loader) return;
  const status = $('app-loader-status');
  if (status) status.textContent = message || '';
  loader.classList.remove('hidden');
}

export function hideAppLoader() {
  const loader = $('app-loader');
  if (loader) loader.classList.add('hidden');
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
