/**
 * Contrôleur de l'éditeur : relie la zone de saisie, l'aperçu, la barre
 * d'outils, la table des matières, les fichiers et le brouillon.
 * Toute la logique Markdown vit dans les modules purs de `src/`.
 *
 * @module ui/app
 */

import { parse } from '../parser/index.js';
import { renderTree, toHtml } from '../render-html.js';
import { buildToc, nestToc } from '../toc.js';
import { computeStats, formatStats } from '../stats.js';
import { COMMANDS, commandForKey } from '../commands.js';
import { continueBlock, indentLines, selectionTouchesList, toggleTaskAtLine } from '../editor-commands.js';
import { buildStandaloneHtml, documentTitle, fileNameFor } from '../export.js';
import { PreviewRenderer } from './dom-render.js';
import { applyState, readState } from './textarea.js';
import { ScrollSync } from './scroll-sync.js';
import { buildToolbar } from './toolbar.js';
import { copyText, downloadText, readTextFile } from './files.js';

/** Préfixe des ancres de l'aperçu (évite toute collision avec les id de l'outil). */
export const ANCHOR_PREFIX = 'md-';
const VIEWS = /** @type {const} */ (['editor', 'preview', 'split']);
const SAVE_DELAY_MS = 700;

/**
 * @typedef {object} AppElements
 * @property {HTMLElement} app
 * @property {HTMLTextAreaElement} source
 * @property {HTMLElement} previewPane
 * @property {HTMLElement} preview
 * @property {HTMLElement} toolbar
 * @property {HTMLElement} tocPanel
 * @property {HTMLElement} tocList
 * @property {HTMLButtonElement} tocToggle
 * @property {HTMLButtonElement} menuToggle
 * @property {HTMLElement} menu
 * @property {HTMLInputElement} fileInput
 * @property {HTMLElement} dropOverlay
 * @property {HTMLElement} stats
 * @property {HTMLElement} saveState
 * @property {HTMLElement} announcer
 */

/**
 * Ancre d'un lien interne, décodée si possible (`%E0` seul n'est pas de
 * l'UTF-8 valide : l'ancre brute sert alors telle quelle).
 * @param {string} fragment
 * @returns {string}
 */
export function decodeAnchor(fragment) {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

export class MarkdownEditorApp {
  /**
   * @param {AppElements} elements
   * @param {object} services
   * @param {ReturnType<typeof import('../storage.js').createDraftStore>} services.drafts
   * @param {{ get(): string|null, set(value: string): boolean }} services.viewPreference
   * @param {import('./toast.js').Toast} services.toast
   * @param {MediaQueryList} services.wide - Écran assez large pour la vue côte à côte.
   * @param {boolean} services.mac
   */
  constructor(elements, services) {
    this.el = elements;
    this.services = services;
    this.preview = new PreviewRenderer(elements.preview);
    this.sync = new ScrollSync(elements.source, elements.previewPane, () => this.effectiveView() === 'split');
    /** @type {import('../parser/ast.js').MdNode|null} */
    this.doc = null;
    this.previewStale = true;
    this.renderTimer = 0;
    this.saveTimer = 0;
    this.lastRenderMs = 0;
    /** Après Échap, la prochaine tabulation quitte la zone au lieu d'indenter. */
    this.releaseTab = false;
    /** @type {'editor'|'preview'|'split'} */
    this.view = 'editor';
  }

  /**
   * Démarre l'éditeur avec le brouillon s'il existe, sinon avec `fallbackText`.
   * @param {string} fallbackText
   */
  start(fallbackText) {
    const draft = this.services.drafts.load();
    this.el.source.value = draft ? draft.text : fallbackText;
    this.bindEditor();
    this.bindPreview();
    this.bindChrome();
    buildToolbar(this.el.toolbar, { mac: this.services.mac, onCommand: (id) => this.runCommand(id) });
    const saved = this.services.viewPreference.get();
    this.setView(saved ?? (this.services.wide.matches ? 'split' : 'editor'), { persist: false });
    this.renderNow();
    if (draft) {
      const time = new Date(draft.savedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      this.setSaveState(`Brouillon restauré (${time})`);
      this.services.toast.show('Brouillon restauré.', { label: 'Repartir de zéro', run: () => this.newDocument() });
    } else {
      this.setSaveState('Exemple chargé');
    }
  }

  // --- Rendu -------------------------------------------------------------

  /** Planifie un rendu ; le délai s'adapte au coût du dernier rendu. */
  scheduleRender() {
    clearTimeout(this.renderTimer);
    const delay = Math.min(400, Math.max(40, this.lastRenderMs * 2));
    this.renderTimer = window.setTimeout(() => this.renderNow(), delay);
  }

  /** Analyse le texte, met à jour statistiques, sommaire et (si visible) l'aperçu. */
  renderNow() {
    clearTimeout(this.renderTimer);
    const started = performance.now();
    const text = this.el.source.value;
    this.doc = parse(text);
    this.el.stats.textContent = formatStats(computeStats(text, this.doc));
    this.renderToc();
    this.previewStale = true;
    if (this.effectiveView() !== 'editor') {
      this.renderPreview();
    }
    this.lastRenderMs = performance.now() - started;
  }

  renderPreview() {
    if (!this.doc || !this.previewStale) {
      return;
    }
    const tree = renderTree(this.doc, { sourceLines: true, idPrefix: ANCHOR_PREFIX, interactiveTasks: true });
    this.preview.render(tree);
    this.previewStale = false;
    this.sync.invalidate();
  }

  renderToc() {
    const entries = buildToc(/** @type {import('../parser/ast.js').MdNode} */ (this.doc));
    const doc = this.el.tocList.ownerDocument;
    const build = (nodes) => nodes.map((entry) => {
      const item = doc.createElement('li');
      const link = doc.createElement('a');
      // Même forme qu'un lien Markdown interne : followLink ajoute le préfixe.
      link.href = `#${entry.id}`;
      link.textContent = entry.text || '(titre vide)';
      link.dataset.line = String(entry.line);
      item.append(link);
      if (entry.children.length > 0) {
        const list = doc.createElement('ol');
        list.append(...build(entry.children));
        item.append(list);
      }
      return item;
    });
    const tree = nestToc(entries);
    if (tree.length === 0) {
      const empty = doc.createElement('li');
      empty.className = 'mde-toc-empty';
      empty.textContent = 'Aucun titre : commencez une ligne par « # ».';
      this.el.tocList.replaceChildren(empty);
    } else {
      this.el.tocList.replaceChildren(...build(tree));
    }
  }

  // --- Saisie ------------------------------------------------------------

  bindEditor() {
    const { source } = this.el;
    source.addEventListener('input', () => {
      this.scheduleRender();
      this.scheduleSave();
    });
    source.addEventListener('keydown', (event) => this.onKeyDown(event));
    source.addEventListener('focus', () => {
      this.releaseTab = false;
    });
  }

  /**
   * Raccourcis, tabulation dans les listes et continuation à Entrée.
   * @param {KeyboardEvent} event
   */
  onKeyDown(event) {
    if (event.isComposing) {
      return;
    }
    if (event.key === 'Escape') {
      this.releaseTab = true;
      this.announce('Tabulation libérée : Tab quitte la zone de saisie.');
      return;
    }
    const command = commandForKey(event);
    if (command) {
      event.preventDefault();
      this.runCommand(command.id);
      return;
    }
    if (event.key === 'Tab') {
      this.onTab(event);
      return;
    }
    this.releaseTab = false;
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.edit(continueBlock(readState(this.el.source)), event);
    }
  }

  /**
   * Tab / Maj+Tab indentent une liste ; ailleurs (ou après Échap) le focus avance.
   * @param {KeyboardEvent} event
   */
  onTab(event) {
    const state = readState(this.el.source);
    if (this.releaseTab || event.ctrlKey || event.metaKey || event.altKey || !selectionTouchesList(state)) {
      return;
    }
    this.edit(indentLines(state, event.shiftKey ? -1 : 1), event);
  }

  /**
   * Applique un état calculé et neutralise l'action par défaut.
   * @param {import('../editor-commands.js').EditorState|null} next
   * @param {Event} [event]
   */
  edit(next, event) {
    if (!next) {
      return;
    }
    event?.preventDefault();
    applyState(this.el.source, next);
  }

  /**
   * Exécute une commande de la barre d'outils.
   * @param {string} id
   */
  runCommand(id) {
    const { source } = this.el;
    if (id === 'undo' || id === 'redo') {
      source.focus({ preventScroll: true });
      source.ownerDocument.execCommand(id);
      return;
    }
    const command = COMMANDS.find((candidate) => candidate.id === id);
    if (!command) {
      return;
    }
    const state = readState(source);
    if (command.listOnly && !selectionTouchesList(state)) {
      this.services.toast.show('Le retrait s\'applique aux éléments de liste : placez le curseur sur une ligne « - » ou « 1. ».');
      return;
    }
    this.edit(command.run(state));
  }

  // --- Aperçu ------------------------------------------------------------

  bindPreview() {
    const { preview } = this.el;
    preview.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest('a[href]');
      if (link) {
        event.preventDefault();
        this.followLink(link.getAttribute('href') ?? '');
      } else if (target?.classList.contains('task-list-item')) {
        // Marge tactile de l'élément (≥ 44 px) : elle agit comme la case.
        /** @type {HTMLInputElement|null} */ (target.querySelector(':scope > input, :scope > p > input'))?.click();
      }
    });
    preview.addEventListener('change', (event) => {
      const box = event.target;
      if (box instanceof HTMLInputElement && box.dataset.taskLine) {
        const offset = box.dataset.taskOffset === undefined ? undefined : Number(box.dataset.taskOffset);
        if (!this.toggleTask(Number(box.dataset.taskLine), offset)) {
          // Source introuvable : la case ne doit pas mentir sur le document.
          box.checked = !box.checked;
          this.services.toast.show('Cette case n\'a pas pu être modifiée : cochez-la dans le texte.');
        }
      }
    });
  }

  /**
   * Ancre interne : défilement dans l'aperçu ; lien externe : nouvel onglet isolé.
   * @param {string} href
   */
  followLink(href) {
    if (href.startsWith('#')) {
      const id = decodeAnchor(href.slice(1));
      this.el.preview.ownerDocument.getElementById(`${ANCHOR_PREFIX}${id}`)?.scrollIntoView({ block: 'start' });
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  /**
   * @param {number} line
   * @param {number} [offset] - Position du caractère entre crochets.
   * @returns {boolean} La source a été modifiée.
   */
  toggleTask(line, offset) {
    const text = toggleTaskAtLine(this.el.source.value, line, offset);
    if (text === null) {
      return false;
    }
    const { selectionStart, selectionEnd } = this.el.source;
    applyState(this.el.source, { text, start: selectionStart, end: selectionEnd }, { focus: false });
    this.renderNow();
    return true;
  }

  // --- Vues, menu, sommaire ----------------------------------------------

  /** @returns {'editor'|'preview'|'split'} Vue réellement affichée. */
  effectiveView() {
    return this.view === 'split' && !this.services.wide.matches ? 'editor' : this.view;
  }

  /**
   * @param {string} view
   * @param {{ persist?: boolean }} [options]
   */
  setView(view, { persist = true } = {}) {
    this.view = VIEWS.includes(/** @type {never} */ (view)) ? /** @type {'editor'|'preview'|'split'} */ (view) : 'editor';
    const shown = this.effectiveView();
    this.el.app.dataset.view = shown;
    for (const button of this.el.app.querySelectorAll('[data-set-view]')) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-set-view') === shown));
    }
    if (persist) {
      this.services.viewPreference.set(this.view);
    }
    if (shown !== 'editor') {
      this.renderPreview();
    }
    this.sync.invalidate();
  }

  bindChrome() {
    const { app, menuToggle, menu, tocToggle } = this.el;
    app.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-set-view], [data-action]') : null;
      if (target?.hasAttribute('data-set-view')) {
        this.setView(target.getAttribute('data-set-view') ?? 'editor');
      } else if (target) {
        this.closeMenu();
        this.runAction(target.getAttribute('data-action') ?? '');
      }
    });
    menuToggle.addEventListener('click', () => (menu.hidden ? this.openMenu() : this.closeMenu()));
    // Le focus quitte le menu (Tab) : il se ferme au lieu de masquer la saisie.
    // Sans destination (fin de page, onglet suivant), il se ferme si la page
    // a perdu le focus ; un toucher sur le texte du menu ne le ferme pas.
    menu.addEventListener('focusout', (event) => {
      const next = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (next) {
        if (!menu.contains(next) && !menuToggle.contains(next)) {
          this.closeMenu();
        }
        return;
      }
      window.setTimeout(() => {
        if (!app.ownerDocument.hasFocus()) {
          this.closeMenu();
        }
      }, 0);
    });
    tocToggle.addEventListener('click', () => this.toggleToc());
    this.el.tocList.addEventListener('click', (event) => this.onTocClick(event));
    app.ownerDocument.addEventListener('keydown', (event) => this.onGlobalKey(event));
    app.ownerDocument.addEventListener('pointerdown', (event) => this.closeOnOutside(event));
    this.services.wide.addEventListener('change', () => this.setView(this.view, { persist: false }));
    window.addEventListener('resize', () => this.sync.invalidate());
    window.addEventListener('beforeprint', () => this.renderPreview());
    this.bindFiles();
  }

  /** @param {KeyboardEvent} event */
  onGlobalKey(event) {
    if (event.key === 'Escape' && !this.el.menu.hidden) {
      this.closeMenu();
      this.el.menuToggle.focus();
    } else if (event.key === 'Escape' && !this.el.tocPanel.hidden) {
      this.toggleToc(false);
      this.el.tocToggle.focus();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.saveNow();
    }
  }

  /** @param {PointerEvent} event */
  closeOnOutside(event) {
    const target = event.target instanceof Node ? event.target : null;
    if (!this.el.menu.hidden && target && !this.el.menu.contains(target) && !this.el.menuToggle.contains(target)) {
      this.closeMenu();
    }
  }

  openMenu() {
    this.el.menu.hidden = false;
    this.el.menuToggle.setAttribute('aria-expanded', 'true');
    this.el.menu.querySelector('button')?.focus();
  }

  closeMenu() {
    this.el.menu.hidden = true;
    this.el.menuToggle.setAttribute('aria-expanded', 'false');
  }

  /** @param {boolean} [open] */
  toggleToc(open = this.el.tocPanel.hidden) {
    this.el.tocPanel.hidden = !open;
    this.el.tocToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      /** @type {HTMLElement|null} */ (this.el.tocList.querySelector('a'))?.focus();
    }
  }

  /** @param {MouseEvent} event */
  onTocClick(event) {
    const link = event.target instanceof Element ? event.target.closest('a[data-line]') : null;
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }
    event.preventDefault();
    // Le sommaire ne reste ouvert à côté du texte que sur un grand écran.
    if (window.innerWidth < 1100) {
      this.toggleToc(false);
    }
    if (this.effectiveView() === 'editor') {
      this.revealLine(Number(link.dataset.line));
    } else {
      this.followLink(link.getAttribute('href') ?? '');
    }
  }

  /**
   * Place le curseur au début d'une ligne et la fait défiler en haut de la zone.
   * @param {number} line
   */
  revealLine(line) {
    const { source } = this.el;
    const lines = source.value.split('\n').slice(0, line - 1);
    const offset = lines.reduce((total, text) => total + text.length + 1, 0);
    source.focus({ preventScroll: true });
    source.setSelectionRange(offset, offset);
    source.scrollTop = this.sync.measurer.topOf(line) - 8;
  }

  // --- Fichiers et brouillon ---------------------------------------------

  bindFiles() {
    const { fileInput, app, dropOverlay } = this.el;
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (file) {
        this.openFile(file);
      }
    });
    let depth = 0;
    const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');
    app.addEventListener('dragenter', (event) => {
      if (hasFiles(event)) {
        depth += 1;
        dropOverlay.hidden = false;
      }
    });
    app.addEventListener('dragover', (event) => {
      if (hasFiles(event)) {
        event.preventDefault();
      }
    });
    app.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      dropOverlay.hidden = depth > 0 ? dropOverlay.hidden : true;
    });
    app.addEventListener('drop', (event) => {
      depth = 0;
      dropOverlay.hidden = true;
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        event.preventDefault();
        this.openFile(file);
      }
    });
  }

  /** @param {File} file */
  async openFile(file) {
    try {
      this.replaceDocument(await readTextFile(file), `« ${file.name} » ouvert.`);
    } catch (error) {
      this.services.toast.show(error instanceof Error ? error.message : 'Lecture du fichier impossible.');
    }
  }

  /**
   * Remplace tout le texte, avec annulation possible depuis le message.
   * @param {string} text
   * @param {string} message
   */
  replaceDocument(text, message) {
    const previous = this.el.source.value;
    applyState(this.el.source, { text, start: 0, end: 0 });
    this.el.source.scrollTop = 0;
    this.renderNow();
    this.saveNow();
    this.services.toast.show(message, {
      label: 'Annuler',
      run: () => applyState(this.el.source, { text: previous, start: 0, end: 0 }),
    });
  }

  newDocument() {
    this.replaceDocument('', 'Nouveau document : le brouillon précédent est effacé.');
  }

  /** @param {string} action */
  async runAction(action) {
    const actions = {
      open: () => this.el.fileInput.click(),
      'save-md': () => this.download('md'),
      'export-html': () => this.download('html'),
      'copy-html': () => this.copyHtml(),
      print: () => window.print(),
      new: () => this.newDocument(),
      'close-toc': () => {
        this.toggleToc(false);
        this.el.tocToggle.focus();
      },
    };
    await actions[action]?.();
  }

  /** HTML du corps du document, sans attributs propres à l'aperçu. */
  bodyHtml() {
    return toHtml(renderTree(parse(this.el.source.value)));
  }

  /** @param {'md'|'html'} kind */
  download(kind) {
    const doc = parse(this.el.source.value);
    const title = documentTitle(doc);
    const content = kind === 'md'
      ? this.el.source.value
      : buildStandaloneHtml({ title, body: toHtml(renderTree(doc)) });
    downloadText(this.el.app.ownerDocument, content, fileNameFor(title, kind), kind === 'md' ? 'text/markdown' : 'text/html');
    this.services.toast.show(kind === 'md' ? 'Fichier Markdown téléchargé.' : 'Page HTML autonome téléchargée.');
  }

  async copyHtml() {
    const copied = await copyText(this.el.app.ownerDocument, this.bodyHtml());
    this.services.toast.show(copied ? 'HTML copié dans le presse-papiers.' : 'Copie impossible dans ce navigateur.');
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.setSaveState('Modifié…');
    this.saveTimer = window.setTimeout(() => this.saveNow(), SAVE_DELAY_MS);
  }

  saveNow() {
    clearTimeout(this.saveTimer);
    const text = this.el.source.value;
    const result = text === '' ? { ok: this.services.drafts.clear() } : this.services.drafts.save(text);
    if (result.ok) {
      const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      this.setSaveState(text === '' ? 'Brouillon vide' : `Brouillon enregistré à ${time}`);
    } else {
      const reason = 'reason' in result && result.reason === 'quota' ? 'stockage plein' : 'stockage indisponible';
      this.setSaveState(`Brouillon non enregistré (${reason})`, true);
    }
  }

  /**
   * @param {string} message
   * @param {boolean} [warning]
   */
  setSaveState(message, warning = false) {
    this.el.saveState.textContent = message;
    this.el.saveState.classList.toggle('is-warning', warning);
  }

  /** @param {string} message */
  announce(message) {
    this.el.announcer.textContent = '';
    window.setTimeout(() => {
      this.el.announcer.textContent = message;
    }, 50);
  }
}
