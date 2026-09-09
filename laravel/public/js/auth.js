import { $ } from './config.js';
import { api } from './api-client.js';
import { showToast } from './toast.js';

let authHandlers = {};

export function configureAuth(handlers) {
  authHandlers = { ...authHandlers, ...handlers };
}

// L'authentification est gérée par Cloudflare Access (Zero Trust).
// Pas de formulaire de login cote app — CF Access intercepte les requetes
// non authentifiees et affiche sa propre page de connexion OTP/2FA.
// Ce module ne garde que la deconnexion (qui vide la session Laravel ;
// l'utilisateur devra se reauthentifier via CF Access au prochain acces).

export function bindLoginForm() {
  // No-op : le formulaire de login n'existe plus (remplace par CF Access).
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST', loadingMessage: 'Déconnexion…' });
  } catch (_) { /* la session est peut-être déjà expirée */ }
  showToast('Déconnecté — Cloudflare Access te redirigera.', 'success');
  // Recharger la page : CF Access affichera l'ecran de connexion si besoin.
  setTimeout(() => window.location.reload(), 1000);
}
