/**
 * Point d'entrée de l'outil « Éditeur Markdown » : thème, styles du
 * document, puis assemblage du contrôleur.
 */

import { initTheme, toggleTheme } from '../../../../lib/theme.js';
import { DOCUMENT_CSS } from '../document-css.js';
import { SAMPLE_DOCUMENT } from '../sample.js';
import { VIEW_KEY, createDraftStore, createPreference } from '../storage.js';
import { MarkdownEditorApp } from './app.js';
import { Toast } from './toast.js';

initTheme();

/**
 * Élément obligatoire de la page.
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function byId(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Élément manquant : #${id}`);
  }
  return /** @type {T} */ (element);
}

// Même feuille de style pour l'aperçu et pour l'export HTML.
const documentStyle = document.createElement('style');
documentStyle.textContent = DOCUMENT_CSS;
document.head.append(documentStyle);

const app = new MarkdownEditorApp({
  app: byId('app'),
  source: byId('source'),
  previewPane: byId('preview-pane'),
  preview: byId('preview'),
  toolbar: byId('toolbar'),
  tocPanel: byId('toc-panel'),
  tocList: byId('toc-list'),
  tocToggle: byId('toc-toggle'),
  menuToggle: byId('menu-toggle'),
  menu: byId('file-menu'),
  fileInput: byId('file-input'),
  dropOverlay: byId('drop-overlay'),
  stats: byId('stats'),
  saveState: byId('save-state'),
  announcer: byId('announcer'),
}, {
  drafts: createDraftStore(),
  viewPreference: createPreference(VIEW_KEY, ['editor', 'preview', 'split']),
  toast: new Toast(byId('toast'), byId('toast-text'), byId('toast-action'), () => byId('source')),
  wide: window.matchMedia('(min-width: 760px)'),
  mac: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
});

byId('theme-toggle').addEventListener('click', () => toggleTheme());
app.start(SAMPLE_DOCUMENT);
