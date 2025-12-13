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
