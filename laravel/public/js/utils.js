export function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

// La couleur de catégorie est injectée telle quelle dans un attribut style inline
// (background/color/border). On valide strictement la valeur comme une couleur hex
// avant interpolation ; toute autre valeur retombe sur la couleur d'accent par défaut.
export function safeColor(c) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(c || '')) ? c : '#6366f1';
}
