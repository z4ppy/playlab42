/**
 * Utilitaires pour les slides Parcours
 * @see openspec/specs/parcours/spec.md
 */

import { ParcoursGlossary } from '../../lib/parcours/ParcoursGlossary.js';

/** @type {ParcoursGlossary|null} Instance globale du glossaire pour la slide */
let _glossaryInstance = null;

/**
 * Initialise la slide avec le thème et la numérotation automatique du footer.
 *
 * Le footer sera automatiquement mis à jour avec le format :
 * "Titre de l'epic — Titre de la slide (X/Y)"
 *
 * Pour que cela fonctionne, le footer doit contenir un élément avec
 * l'attribut `data-slide-footer` ou être un élément `.dl-footer p`.
 *
 * @example
 * <footer class="dl-footer">
 *   <p data-slide-footer></p>
 * </footer>
 */
export async function initSlide() {
  // Importer et initialiser le thème
  const { initTheme } = await import('../../lib/theme.js');
  initTheme();

  // Initialiser la numérotation du footer
  await initSlideFooter();

  // Configurer le handler pour les clics TOC du viewer
  setupScrollHandler();
}

/**
 * Extrait les IDs de slides depuis la structure content de l'epic.
 * Gère les structures imbriquées (sections avec content).
 *
 * @param {Array} content - Structure content de l'epic
 * @returns {string[]} Liste ordonnée des IDs de slides
 */
function extractSlideIds(content) {
  const ids = [];

  for (const item of content) {
    if (item.content && Array.isArray(item.content)) {
      // Section avec sous-éléments (ex: { id: "theorie", content: [...] })
      ids.push(...extractSlideIds(item.content));
    } else if (item.id) {
      // Slide directe (ex: { id: "01-introduction" })
      ids.push(item.id);
    }
  }

  return ids;
}

/**
 * Initialise le footer de la slide avec la numérotation automatique.
 * Charge epic.json et slide.json pour déterminer la position.
 */
async function initSlideFooter() {
  try {
    // Détecter l'epic et la slide depuis l'URL
    // URL typique : /parcours/epics/mon-epic/slides/01-intro/index.html
    const pathMatch = window.location.pathname.match(
      /\/parcours\/epics\/([^/]+)\/slides\/([^/]+)\//,
    );
    if (!pathMatch) {return;}

    const [, epicId, slideId] = pathMatch;

    // Charger epic.json et slide.json en parallèle
    const [epicResponse, slideResponse] = await Promise.all([
      fetch('../../epic.json'),
      fetch('./slide.json'),
    ]);

    if (!epicResponse.ok || !slideResponse.ok) {return;}

    const [epicData, slideData] = await Promise.all([
      epicResponse.json(),
      slideResponse.json(),
    ]);

    // Extraire la liste ordonnée des slides depuis la structure content
    const slideIds = extractSlideIds(epicData.content || []);

    // Trouver la position de la slide courante
    const currentIndex = slideIds.indexOf(slideId);
    if (currentIndex === -1) {return;}

    const slideNumber = currentIndex + 1;
    const totalSlides = slideIds.length;

    // Construire le texte du footer
    const epicTitle = epicData.title || epicId;
    const slideTitle = slideData.title || slideId;
    const footerText = `${epicTitle} — ${slideTitle} (${slideNumber}/${totalSlides})`;

    // Mettre à jour le footer
    const footerElement =
      document.querySelector('[data-slide-footer]') ||
      document.querySelector('.dl-footer p');

    if (footerElement) {
      footerElement.textContent = footerText;
    }
  } catch (error) {
    // Silencieux en cas d'erreur (fallback sur le contenu statique)
    console.debug('[slide-utils] Footer auto-numbering failed:', error.message);
  }
}

/**
 * Initialise le glossaire pour la slide courante.
 * Charge les définitions depuis l'epic et le glossaire global,
 * puis attache les tooltips aux éléments <dfn>.
 *
 * @param {Object} [options] - Options de configuration
 * @param {string} [options.container='body'] - Sélecteur du conteneur où attacher les tooltips
 * @returns {Promise<ParcoursGlossary|null>} Instance du glossaire ou null si erreur
 *
 * @example
 * import { initSlide, initGlossary } from '../../../../../parcours/_shared/slide-utils.js';
 *
 * initSlide();
 * await initGlossary();
 */
export async function initGlossary(options = {}) {
  try {
    // Déterminer le chemin de l'epic à partir de l'URL de la slide
    // URL typique : /parcours/epics/mon-epic/slides/01-intro/index.html
    const pathMatch = window.location.pathname.match(/\/parcours\/epics\/([^/]+)\//);
    if (!pathMatch) {
      console.warn('[Glossary] Impossible de déterminer l\'epic depuis l\'URL');
      return null;
    }

    const epicId = pathMatch[1];
    // Chemin relatif vers le dossier de l'epic depuis la slide
    // Une slide est dans /parcours/epics/<epic>/slides/<slide>/
    // L'epic est dans /parcours/epics/<epic>/
    const epicPath = '../../'; // Chemin relatif depuis la slide vers l'epic

    // Créer et charger le glossaire
    _glossaryInstance = new ParcoursGlossary(epicId, epicPath);
    await _glossaryInstance.load();

    // Attacher les tooltips au conteneur spécifié
    const container = document.querySelector(options.container || 'body');
    if (container) {
      _glossaryInstance.attachTooltips(container);
    }

    return _glossaryInstance;
  } catch (error) {
    console.error('[Glossary] Erreur d\'initialisation:', error);
    return null;
  }
}

/**
 * Récupère l'instance du glossaire initialisée.
 * @returns {ParcoursGlossary|null}
 */
export function getGlossary() {
  return _glossaryInstance;
}

/**
 * Nettoie le glossaire (à appeler avant de quitter la slide si nécessaire).
 */
export function cleanupGlossary() {
  if (_glossaryInstance) {
    _glossaryInstance.detachTooltips();
    _glossaryInstance = null;
  }
}

/**
 * Transforme la syntaxe wiki `[[terme]]` en balises `<dfn>` dans le contenu HTML.
 * Utile pour convertir du contenu Markdown transformé contenant cette syntaxe.
 *
 * Syntaxe supportée :
 * - `[[terme]]` → `<dfn>terme</dfn>`
 * - `[[terme|texte affiché]]` → `<dfn data-term="terme">texte affiché</dfn>`
 *
 * @param {HTMLElement|string} containerOrSelector - Élément ou sélecteur CSS
 * @returns {number} Nombre de termes transformés
 *
 * @example
 * // Dans une slide, après le chargement du contenu Markdown
 * import { initSlide, initGlossary, transformWikiTerms } from '...';
 *
 * initSlide();
 * transformWikiTerms('.prose-content'); // Transforme [[terme]] en <dfn>
 * await initGlossary(); // Attache les tooltips
 */
export function transformWikiTerms(containerOrSelector) {
  const container = typeof containerOrSelector === 'string'
    ? document.querySelector(containerOrSelector)
    : containerOrSelector;

  if (!container) {
    console.warn('[Glossary] Conteneur non trouvé:', containerOrSelector);
    return 0;
  }

  let count = 0;

  // Regex pour [[terme]] ou [[terme|texte]]
  // Groupe 1: terme, Groupe 2: texte affiché (optionnel)
  const wikiTermRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

  // Parcourir tous les nœuds texte du conteneur
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Ignorer les nœuds dans script, style, code, pre, dfn
        const parent = node.parentElement;
        if (!parent) {return NodeFilter.FILTER_REJECT;}
        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'code', 'pre', 'dfn', 'textarea'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        // Accepter si contient le pattern
        if (wikiTermRegex.test(node.textContent)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    },
  );

  const nodesToProcess = [];
  let node;
  while ((node = walker.nextNode())) {
    nodesToProcess.push(node);
  }

  // Traiter les nœuds (en sens inverse pour ne pas invalider les références)
  nodesToProcess.forEach((textNode) => {
    const text = textNode.textContent;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    // Reset regex state
    wikiTermRegex.lastIndex = 0;

    let match;
    while ((match = wikiTermRegex.exec(text)) !== null) {
      // Ajouter le texte avant le match
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      // Créer l'élément dfn
      const term = match[1].trim();
      const displayText = match[2]?.trim() || term;

      const dfn = document.createElement('dfn');
      if (match[2]) {
        dfn.setAttribute('data-term', term);
      }
      dfn.textContent = displayText;
      fragment.appendChild(dfn);

      lastIndex = match.index + match[0].length;
      count++;
    }

    // Ajouter le reste du texte
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    // Remplacer le nœud texte par le fragment
    textNode.parentNode.replaceChild(fragment, textNode);
  });

  return count;
}

/**
 * Marque automatiquement les occurrences de termes du glossaire dans le contenu.
 * Seule la première occurrence de chaque terme est marquée.
 *
 * ⚠️ À utiliser avec précaution : peut créer des faux positifs.
 * Préférer le marquage explicite avec `<dfn>` ou `[[terme]]`.
 *
 * @param {HTMLElement|string} containerOrSelector - Élément ou sélecteur CSS
 * @param {string[]} terms - Liste des termes à marquer
 * @param {Object} [options] - Options
 * @param {boolean} [options.firstOnly=true] - Marquer uniquement la première occurrence
 * @returns {number} Nombre de termes marqués
 */
export function autoMarkTerms(containerOrSelector, terms, options = {}) {
  const { firstOnly = true } = options;

  const container = typeof containerOrSelector === 'string'
    ? document.querySelector(containerOrSelector)
    : containerOrSelector;

  if (!container || !terms?.length) {return 0;}

  let count = 0;
  const markedTerms = new Set();

  // Trier les termes par longueur décroissante pour éviter les chevauchements
  const sortedTerms = [...terms].sort((a, b) => b.length - a.length);

  // Créer un pattern pour tous les termes (insensible à la casse)
  const escapedTerms = sortedTerms.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) {return NodeFilter.FILTER_REJECT;}
        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'code', 'pre', 'dfn', 'textarea'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (pattern.test(node.textContent)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    },
  );

  const nodesToProcess = [];
  let node;
  while ((node = walker.nextNode())) {
    nodesToProcess.push(node);
  }

  nodesToProcess.forEach((textNode) => {
    const text = textNode.textContent;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const matchedTerm = match[1].toLowerCase();

      // Si firstOnly et déjà marqué, ignorer
      if (firstOnly && markedTerms.has(matchedTerm)) {
        continue;
      }

      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const dfn = document.createElement('dfn');
      dfn.textContent = match[1];
      fragment.appendChild(dfn);

      lastIndex = match.index + match[0].length;
      markedTerms.add(matchedTerm);
      count++;
    }

    if (lastIndex > 0 && lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    if (lastIndex > 0) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });

  return count;
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
    if (!id) {return;}

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
    if (pre.querySelector('.copy-btn')) {return;} // Déjà ajouté

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

// ===========================================================================
// Styles Glossaire (injectés dynamiquement)
// @see openspec/changes/add-glossary-system
// ===========================================================================
const glossaryStyle = document.createElement('style');
glossaryStyle.textContent = `
  /* Termes du glossaire (<dfn> ou .glossary-term) */
  dfn,
  [data-term],
  .glossary-term {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-decoration-color: var(--color-accent, #e94560);
    text-underline-offset: 3px;
    text-decoration-thickness: 2px;
    cursor: help;
    font-style: normal;
    transition: text-decoration-color 0.15s;
  }

  dfn:hover,
  [data-term]:hover,
  .glossary-term:hover {
    text-decoration-color: var(--color-text, #eee);
  }

  dfn:focus,
  [data-term]:focus,
  .glossary-term:focus {
    outline: 2px solid var(--color-accent, #e94560);
    outline-offset: 2px;
    border-radius: 2px;
  }

  /* Tooltip */
  .glossary-tooltip {
    position: absolute;
    max-width: 320px;
    min-width: 200px;
    padding: 0;
    background: var(--color-bg, #1a1a2e);
    border: 1px solid var(--color-border, #333);
    border-radius: var(--radius-md, 0.5rem);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3),
                0 8px 10px -6px rgba(0, 0, 0, 0.3);
    z-index: 1100;
    pointer-events: none;
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .glossary-tooltip[role="tooltip"] {
    pointer-events: auto;
  }

  .glossary-tooltip-header {
    padding: var(--space-sm, 0.5rem) var(--space-md, 0.75rem);
    background: var(--color-bg-secondary, #16213e);
    border-bottom: 1px solid var(--color-border, #333);
    border-radius: var(--radius-md, 0.5rem) var(--radius-md, 0.5rem) 0 0;
    font-weight: 600;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-accent, #e94560);
  }

  .glossary-tooltip-short {
    margin: 0;
    padding: var(--space-sm, 0.5rem) var(--space-md, 0.75rem);
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.5;
    color: var(--color-text, #eee);
  }

  .glossary-tooltip-see {
    margin: 0;
    padding: var(--space-xs, 0.25rem) var(--space-md, 0.75rem) var(--space-sm, 0.5rem);
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-muted, #888);
    border-top: 1px solid var(--color-border, #333);
  }

  .glossary-tooltip--below::before {
    top: -6px;
    bottom: auto;
    border-width: 0 6px 6px 6px;
    border-color: transparent transparent var(--color-border, #333) transparent;
  }

  /* Animation accessible */
  @media (prefers-reduced-motion: reduce) {
    .glossary-tooltip {
      transition: opacity 0.1s;
      transform: none !important;
    }

    dfn,
    [data-term],
    .glossary-term {
      transition: none;
    }
  }
`;
document.head.appendChild(glossaryStyle);
