/**
 * Utilitaires pour les slides Parcours
 */

/**
 * Initialise la slide avec le thème
 */
export async function initSlide() {
  // Importer et initialiser le thème
  const { initTheme } = await import('/lib/theme.js');
  initTheme();
}

/**
 * Envoie un message au viewer parent (si la slide est dans une iframe)
 * @param {string} type - Type de message
 * @param {object} data - Données du message
 */
export function sendToViewer(type, data = {}) {
  if (window.parent !== window) {
    window.parent.postMessage({ type, ...data }, '*');
  }
}

/**
 * Écoute les messages du viewer parent
 * @param {function} handler - Fonction de traitement des messages
 */
export function onViewerMessage(handler) {
  window.addEventListener('message', (event) => {
    // Vérifier l'origine si nécessaire
    if (event.data && typeof event.data === 'object') {
      handler(event.data);
    }
  });
}

/**
 * Signale que la slide est prête
 */
export function ready() {
  sendToViewer('slide:ready');
}

// ===========================================================================
// API TOC (Table des Matières intra-slide)
// ===========================================================================

/**
 * Envoie la table des matières interne au viewer.
 * La TOC sera affichée dans le menu latéral comme enfants de la slide.
 *
 * @param {Array<{id: string, label: string, icon?: string, level?: number}>} items
 *
 * @example
 * import { sendTOC } from '../../../../../parcours/_shared/slide-utils.js';
 *
 * sendTOC([
 *   { id: 'intro', label: 'Introduction', icon: '🎯' },
 *   { id: 'neuron', label: 'Le Neurone', icon: '⚡' },
 *   { id: 'backprop', label: 'Backpropagation', icon: '⬅️', level: 2 },
 *   { id: 'lab', label: 'Laboratoire', icon: '🧪' }
 * ]);
 */
export function sendTOC(items) {
  if (!Array.isArray(items)) {
    console.warn('sendTOC: items doit être un tableau');
    return;
  }
  sendToViewer('slide:toc', { items });
}

/**
 * Efface la TOC du viewer.
 * Appelé automatiquement au changement de slide par le viewer.
 */
export function clearTOC() {
  sendToViewer('slide:toc:clear');
}

/**
 * Détecte automatiquement la TOC depuis les headings de la page.
 *
 * @param {string} [selector='h2[id], h3[id]'] - Sélecteur CSS pour les headings
 * @returns {Array<{id: string, label: string, level: number}>} Liste d'items détectés
 *
 * @example
 * import { autoDetectTOC, sendTOC } from '...';
 *
 * // Détection automatique des h2/h3 avec id
 * sendTOC(autoDetectTOC());
 *
 * // Ou avec un sélecteur custom
 * sendTOC(autoDetectTOC('.section-title'));
 */
export function autoDetectTOC(selector = 'h2[id], h3[id]') {
  const headings = document.querySelectorAll(selector);
  const items = [];

  headings.forEach((heading) => {
    const id = heading.id;
    if (!id) return;

    const label = heading.textContent?.trim() || id;
    const tagName = heading.tagName.toLowerCase();
    const level = tagName === 'h3' ? 2 : 1;

    items.push({ id, label, level });
  });

  return items;
}

/**
 * Configure la réception des messages du viewer et le scroll vers les ancres.
 * Doit être appelé une fois au chargement de la slide.
 *
 * @example
 * import { initSlide, sendTOC, setupScrollHandler } from '...';
 *
 * initSlide();
 * setupScrollHandler();
 * sendTOC([...]);
 */
export function setupScrollHandler() {
  onViewerMessage((data) => {
    if (data.type === 'viewer:scroll-to' && data.anchor) {
      scrollToAnchor(data.anchor);
    }
  });
}

/**
 * Scrolle vers une ancre dans la page.
 *
 * @param {string} anchorId - ID de l'ancre (sans le #)
 */
export function scrollToAnchor(anchorId) {
  const element = document.getElementById(anchorId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Met en évidence un élément avec une animation
 * @param {string} selector - Sélecteur CSS
 */
export function highlight(selector) {
  const el = document.querySelector(selector);
  if (el) {
    el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 2000);
  }
}

/**
 * Copie du texte dans le presse-papier
 * @param {string} text - Texte à copier
 * @returns {Promise<boolean>} - Succès de la copie
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback pour les navigateurs plus anciens
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

/**
 * Ajoute un bouton de copie aux blocs de code
 */
export function addCopyButtons() {
  document.querySelectorAll('pre code').forEach((codeBlock) => {
    const pre = codeBlock.parentElement;
    if (pre.querySelector('.copy-btn')) return; // Déjà ajouté

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copier';
    btn.setAttribute('aria-label', 'Copier le code');

    btn.addEventListener('click', async () => {
      const success = await copyToClipboard(codeBlock.textContent);
      btn.textContent = success ? 'Copié !' : 'Erreur';
      setTimeout(() => {
        btn.textContent = 'Copier';
      }, 2000);
    });

    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
}

// Style pour le bouton de copie (injecté dynamiquement)
const copyBtnStyle = document.createElement('style');
copyBtnStyle.textContent = `
  .copy-btn {
    position: absolute;
    top: var(--space-sm, 0.5rem);
    right: var(--space-sm, 0.5rem);
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    background: var(--color-bg, #1a1a2e);
    color: var(--color-text-muted, #888);
    border: 1px solid var(--color-border, #333);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: all 0.2s;
  }
  .copy-btn:hover {
    background: var(--color-accent, #e94560);
    color: white;
    border-color: var(--color-accent, #e94560);
  }
  .highlight {
    animation: highlight-pulse 0.5s ease-out 3;
  }
  @keyframes highlight-pulse {
    0%, 100% { background-color: transparent; }
    50% { background-color: rgba(233, 69, 96, 0.2); }
  }
`;
document.head.appendChild(copyBtnStyle);
