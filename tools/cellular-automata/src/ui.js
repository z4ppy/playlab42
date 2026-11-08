/**
 * Liaison entre le DOM et l'application : construction des listes (motifs,
 * table de règle, préréglages), écoute des contrôles et reflet de l'état.
 * Aucune logique d'automate ici : tout passe par les actions de CellularApp.
 */

import { isEditableTarget } from '../../../lib/dom.js';
import {
  describeLifeRule,
  elementaryOutputs,
  FAMOUS_ELEMENTARY_RULES,
  LIFE_PRESETS,
  parseLifeRule,
} from './rules.js';
import { parseRle, PATTERNS } from './patterns.js';
import { GRID_SIZES, ROW_WIDTHS, SPEEDS } from './hash-state.js';

/** Durée d'affichage d'un message, en millisecondes. */
const TOAST_MS = 3500;
const TOAST_WITH_ACTION_MS = 6000;

/**
 * Raccourci typé pour getElementById.
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function byId(id) {
  return /** @type {T} */ (document.getElementById(id));
}

/**
 * Crée un élément avec classe et texte.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

/**
 * Remplit un <select> à partir de paires valeur/libellé.
 * @param {HTMLSelectElement} select
 * @param {Array<[string, string]>} options
 */
function fillSelect(select, options) {
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

/**
 * Pastille de cellule pour la table des motifs.
 * @param {number} on
 * @param {boolean} [output]
 * @returns {HTMLElement}
 */
function dot(on, output = false) {
  return element('span', `rule-dot${on ? ' rule-dot--on' : ''}${output ? ' rule-dot--out' : ''}`);
}

export class Ui {
  constructor() {
    this.root = byId('app');
    this.toastTimer = 0;
    /** @type {(() => void)|null} */
    this.toastAction = null;
    /** L'action du message courant est une annulation (raccourci Ctrl+Z). */
    this.toastUndo = false;
    /** Durée restante du message, reprise quand le focus ou le survol le quitte. */
    this.toastDuration = 0;
    /** Élément qui avait le focus quand le message est apparu. */
    /** @type {HTMLElement|null} */
    this.toastReturnFocus = null;
    this.toastHovered = false;
    this.lastCounters = '';
    this.el = {
      generation: byId('hud-generation'),
      population: byId('hud-population'),
      hudRule: byId('hud-rule'),
      play: byId('play'),
      playIcon: byId('play-icon'),
      playLabel: byId('play-label'),
      speed: /** @type {HTMLInputElement} */ (byId('speed')),
      speedValue: byId('speed-value'),
      ruleInput: /** @type {HTMLInputElement} */ (byId('rule-input')),
      ruleRange: /** @type {HTMLInputElement} */ (byId('rule-range')),
      famousRules: byId('famous-rules'),
      famousLabel: byId('famous-rule-label'),
      ruleTable: byId('rule-table'),
      widthSelect: /** @type {HTMLSelectElement} */ (byId('width-select')),
      lifePreset: /** @type {HTMLSelectElement} */ (byId('life-preset')),
      lifeInput: /** @type {HTMLInputElement} */ (byId('life-input')),
      lifeStatus: byId('life-status'),
      patternList: byId('pattern-list'),
      patternChipName: byId('pattern-chip-name'),
      density: /** @type {HTMLInputElement} */ (byId('density')),
      densityValue: byId('density-value'),
      sizeSelect: /** @type {HTMLSelectElement} */ (byId('size-select')),
      trace: /** @type {HTMLInputElement} */ (byId('trace-toggle')),
      sheetToggle: byId('sheet-toggle'),
      shareField: byId('share-field'),
      shareUrl: /** @type {HTMLInputElement} */ (byId('share-url')),
      toast: byId('toast'),
      toastText: byId('toast-text'),
      toastAction: byId('toast-action'),
      board: byId('board'),
      boardStatus: byId('board-status'),
    };
    this.build();
  }

  // ===========================================================================
  // Construction
  // ===========================================================================

  build() {
    fillSelect(this.el.widthSelect, ROW_WIDTHS.map((w) => [String(w), `${w} cellules`]));
    fillSelect(this.el.sizeSelect, GRID_SIZES.map((s) => [String(s), `${s} × ${s}`]));
    fillSelect(this.el.lifePreset, [
      ...LIFE_PRESETS.map((p) => /** @type {[string, string]} */ ([p.notation, `${p.name} — ${p.notation}`])),
      ['', 'Personnalisée'],
    ]);
    for (const { rule, label } of FAMOUS_ELEMENTARY_RULES) {
      const chip = element('button', 'chip', String(rule));
      chip.setAttribute('type', 'button');
      chip.dataset.rule = String(rule);
      chip.title = label;
      this.el.famousRules.append(chip);
    }
    this.buildRuleTable();
    this.buildPatternList();
  }

  /** Huit boutons, du motif 111 (7) au motif 000 (0). */
  buildRuleTable() {
    for (let pattern = 7; pattern >= 0; pattern--) {
      const button = element('button', 'rule-cell');
      button.setAttribute('type', 'button');
      button.dataset.pattern = String(pattern);
      const top = element('span', 'rule-cell-row');
      top.append(dot((pattern >> 2) & 1), dot((pattern >> 1) & 1), dot(pattern & 1));
      const bottom = element('span', 'rule-cell-row');
      bottom.append(dot(0, true));
      button.append(top, bottom, element('span', 'rule-cell-bit', '0'));
      this.el.ruleTable.append(button);
    }
  }

  buildPatternList() {
    for (const pattern of PATTERNS) {
      const button = element('button', 'pattern-btn');
      button.setAttribute('type', 'button');
      button.dataset.pattern = pattern.id;
      button.title = `${pattern.category}${pattern.rule ? ` (règle ${pattern.rule})` : ''}`;
      const thumb = /** @type {HTMLCanvasElement} */ (element('canvas', 'pattern-thumb'));
      thumb.setAttribute('aria-hidden', 'true');
      button.append(thumb, element('span', '', pattern.name));
      this.el.patternList.append(button);
    }
    this.drawPatternThumbs();
  }

  /** Miniatures des motifs aux couleurs du thème courant. */
  drawPatternThumbs() {
    const style = getComputedStyle(document.documentElement);
    const background = style.getPropertyValue('--ca-bg').trim();
    const color = style.getPropertyValue('--ca-young').trim();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    for (const button of this.el.patternList.querySelectorAll('button')) {
      const entry = PATTERNS.find((p) => p.id === /** @type {HTMLElement} */ (button).dataset.pattern);
      const canvas = /** @type {HTMLCanvasElement} */ (button.querySelector('canvas'));
      if (entry) {
        drawThumb(canvas, parseRle(entry.rle), { background, color, dpr });
      }
    }
  }

  // ===========================================================================
  // Écoute des contrôles
  // ===========================================================================

  /**
   * @param {import('./app.js').CellularApp} app
   */
  bind(app) {
    this.bindTransport(app);
    this.bindOneDimension(app);
    this.bindTwoDimensions(app);
    this.bindCommon(app);
    this.bindKeyboard(app);
    this.bindBoardKeyboard(app);
    this.bindToastHold();
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  bindTransport(app) {
    for (const button of document.querySelectorAll('[data-set-mode]')) {
      button.addEventListener('click', () => {
        // Un message de l'autre mode n'a plus de sens après la bascule.
        this.hideToast();
        app.setMode(/** @type {'1d'|'2d'} */ (/** @type {HTMLElement} */ (button).dataset.setMode));
      });
    }
    this.el.play.addEventListener('click', () => app.togglePlay());
    byId('step').addEventListener('click', () => app.step());
    byId('restart').addEventListener('click', () => app.restart());
    this.el.speed.addEventListener('input', () => app.setSpeed(Number(this.el.speed.value)));
    for (const button of document.querySelectorAll('.tools [data-tool]')) {
      button.addEventListener('click', () => {
        const tool = /** @type {'draw'|'erase'|'pan'|'pattern'} */ (/** @type {HTMLElement} */ (button).dataset.tool);
        this.chooseTool(app, tool);
      });
    }
    this.el.sheetToggle.addEventListener('click', () => this.toggleSheet(app));
  }

  /**
   * Sans motif choisi, l'outil « Motif » ouvre d'abord la bibliothèque.
   * @param {import('./app.js').CellularApp} app
   * @param {'draw'|'erase'|'pan'|'pattern'} tool
   */
  chooseTool(app, tool) {
    app.setTool(tool);
    if (tool === 'pattern') {
      this.toast('Touchez la grille pour poser le motif.');
    }
  }

  /**
   * @param {import('./app.js').CellularApp} app
   * @param {boolean} [open]
   */
  toggleSheet(app, open = this.root.dataset.sheet !== 'open') {
    this.root.dataset.sheet = open ? 'open' : 'closed';
    this.el.sheetToggle.setAttribute('aria-expanded', String(open));
    app.layoutSoon();
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  bindOneDimension(app) {
    const applyRuleInput = () => {
      const value = Number(this.el.ruleInput.value);
      if (Number.isInteger(value) && value >= 0 && value <= 255) {
        app.setRule(value);
      }
    };
    this.el.ruleInput.addEventListener('input', applyRuleInput);
    this.el.ruleInput.addEventListener('change', () => this.sync(app));
    this.el.ruleRange.addEventListener('input', () => app.setRule(Number(this.el.ruleRange.value)));
    byId('rule-dec').addEventListener('click', () => app.setRule((app.rule + 255) % 256));
    byId('rule-inc').addEventListener('click', () => app.setRule((app.rule + 1) % 256));
    this.el.famousRules.addEventListener('click', (event) => {
      const chip = /** @type {HTMLElement} */ (event.target).closest('[data-rule]');
      if (chip) {
        app.setRule(Number(/** @type {HTMLElement} */ (chip).dataset.rule));
      }
    });
    this.el.ruleTable.addEventListener('click', (event) => {
      const cell = /** @type {HTMLElement} */ (event.target).closest('[data-pattern]');
      if (cell) {
        app.togglePattern(Number(/** @type {HTMLElement} */ (cell).dataset.pattern));
      }
    });
    byId('row-center').addEventListener('click', () => app.setRow('center'));
    byId('row-random').addEventListener('click', () => app.setRow('random'));
    byId('quick-center').addEventListener('click', () => app.setRow('center'));
    byId('quick-random').addEventListener('click', () => app.setRow('random'));
    this.el.widthSelect.addEventListener('change', () => app.setWidth(Number(this.el.widthSelect.value)));
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  bindTwoDimensions(app) {
    this.el.lifePreset.addEventListener('change', () => {
      if (this.el.lifePreset.value) {
        this.el.lifeInput.value = this.el.lifePreset.value;
        this.applyLifeInput(app);
      }
    });
    this.el.lifeInput.addEventListener('input', () => this.applyLifeInput(app));
    this.el.patternList.addEventListener('click', (event) => {
      const button = /** @type {HTMLElement} */ (event.target).closest('[data-pattern]');
      if (button) {
        this.selectPattern(app, /** @type {string} */ (/** @type {HTMLElement} */ (button).dataset.pattern));
      }
    });
    byId('rotate-pattern').addEventListener('click', () => app.rotateSelectedPattern());
    this.el.density.addEventListener('input', () => {
      app.setDensity(Number(this.el.density.value) / 100);
      this.el.densityValue.textContent = `${this.el.density.value} %`;
      this.el.density.setAttribute('aria-valuetext', `${this.el.density.value} %`);
    });
    byId('randomize').addEventListener('click', () => app.randomize());
    byId('clear').addEventListener('click', () => app.clear());
    this.el.sizeSelect.addEventListener('change', () => app.setSize(Number(this.el.sizeSelect.value)));
    byId('zoom-in').addEventListener('click', () => app.zoomBy(1.5));
    byId('zoom-out').addEventListener('click', () => app.zoomBy(1 / 1.5));
    byId('zoom-fit').addEventListener('click', () => app.fitView());
  }

  /**
   * Sur téléphone en portrait, on replie les réglages pour libérer la grille.
   * @param {import('./app.js').CellularApp} app
   * @param {string} id
   */
  selectPattern(app, id) {
    app.selectPattern(id);
    const sheetIsOverlay = getComputedStyle(this.el.sheetToggle).display !== 'none';
    if (sheetIsOverlay && window.matchMedia('(max-width: 599px)').matches) {
      this.toggleSheet(app, false);
    }
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  applyLifeInput(app) {
    const error = app.setLifeRule(this.el.lifeInput.value);
    this.el.lifeInput.setAttribute('aria-invalid', String(Boolean(error)));
    this.el.lifeStatus.classList.toggle('hint--error', Boolean(error));
    if (error) {
      this.el.lifeStatus.textContent = error;
    }
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  bindCommon(app) {
    this.el.trace.addEventListener('change', () => app.setTrace(this.el.trace.checked));
    byId('share-link').addEventListener('click', () => this.share(app));
    byId('export-png').addEventListener('click', () => this.exportPng(app));
    this.el.toastAction.addEventListener('click', () => this.runToastAction());
  }

  /**
   * Raccourcis clavier facultatifs : tout reste accessible au doigt.
   * @param {import('./app.js').CellularApp} app
   */
  bindKeyboard(app) {
    document.addEventListener('keydown', (event) => {
      const target = /** @type {Element|null} */ (event.target);
      if (isEditableTarget(target)) {
        return;
      }
      // Ctrl+Z (⌘Z) : annule « Tout effacer » ou « Aléatoire » tant que le message est affiché.
      if (isUndoShortcut(event) && this.canUndo()) {
        event.preventDefault();
        this.runToastAction();
        return;
      }
      if (hasModifier(event)) {
        return;
      }
      if (event.key === ' ' && !target?.closest('button')) {
        event.preventDefault();
        app.togglePlay();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        app.step();
      }
    });
  }

  /**
   * Grille au clavier : flèches = curseur, Maj+flèches = vue, Entrée = basculer
   * la cellule ou poser le motif, + / − / 0 = zoom. Les touches de la grille
   * ne remontent pas aux raccourcis globaux (→ ne fait pas avancer d'un pas).
   * @param {import('./app.js').CellularApp} app
   */
  bindBoardKeyboard(app) {
    const board = this.el.board;
    board.addEventListener('focus', () => {
      // Au clic ou au doigt, pas de curseur clavier : seulement au clavier.
      if (board.matches(':focus-visible')) {
        app.showKeyCursor();
        this.announce(app.describeKeyCursor());
      }
    });
    board.addEventListener('blur', () => {
      app.hideKeyCursor();
      this.announce('');
    });
    board.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const message = boardKey(app, event.key, event.shiftKey);
      if (message === undefined) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (message) {
        this.announce(message);
      }
    });
  }

  /**
   * Annonce discrète (lecteur d'écran) liée à la grille.
   * @param {string} message
   */
  announce(message) {
    this.el.boardStatus.textContent = message;
  }

  // ===========================================================================
  // Partage et export
  // ===========================================================================

  /**
   * @param {import('./app.js').CellularApp} app
   */
  async share(app) {
    const { url, complete } = app.shareLink();
    this.el.shareUrl.value = url;
    this.el.shareField.hidden = false;
    const suffix = complete ? '' : ' (grille trop dense : seuls les réglages sont partagés)';
    try {
      await navigator.clipboard.writeText(url);
      this.toast(`Lien copié${suffix}.`);
    } catch {
      // Presse-papiers refusé (iframe, navigateur) : le lien reste sélectionnable.
      this.el.shareUrl.focus();
      this.el.shareUrl.select();
      this.toast(`Copiez le lien affiché${suffix}.`);
    }
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  async exportPng(app) {
    const blob = await app.exportPng();
    if (!blob) {
      this.toast('Export impossible dans ce navigateur.');
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = app.exportName();
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    this.toast('Image exportée.');
  }

  // ===========================================================================
  // Reflet de l'état
  // ===========================================================================

  /**
   * @param {number} generation
   * @param {number|null} population
   */
  counters(generation, population) {
    const key = `${generation}/${population}`;
    if (key === this.lastCounters) {
      return;
    }
    this.lastCounters = key;
    this.el.generation.textContent = generation.toLocaleString('fr-FR');
    if (population !== null) {
      this.el.population.textContent = population.toLocaleString('fr-FR');
    }
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  sync(app) {
    this.root.dataset.mode = app.mode;
    this.root.dataset.tool = app.tool;
    for (const button of document.querySelectorAll('[data-set-mode]')) {
      button.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (button).dataset.setMode === app.mode));
    }
    for (const button of document.querySelectorAll('.tools [data-tool]')) {
      button.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (button).dataset.tool === app.tool));
    }
    this.syncTransport(app);
    this.syncElementary(app);
    this.syncLife(app);
    this.el.trace.checked = app.trace;
    this.el.hudRule.textContent = app.mode === '1d' ? `Règle ${app.rule}` : app.lifeNotation;
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  syncTransport(app) {
    // Libellé dynamique seul (pas d'aria-pressed) : « Pause » dit ce que fait l'appui.
    this.el.playIcon.textContent = app.playing ? '❚❚' : '▶';
    this.el.playLabel.textContent = app.playing ? 'Pause' : 'Lecture';
    this.el.speed.value = String(app.speed);
    this.el.speedValue.textContent = `${SPEEDS[app.speed]}/s`;
    this.el.speed.setAttribute('aria-valuetext', `${SPEEDS[app.speed]} générations par seconde`);
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  syncElementary(app) {
    if (document.activeElement !== this.el.ruleInput) {
      this.el.ruleInput.value = String(app.rule);
    }
    this.el.ruleRange.value = String(app.rule);
    this.el.ruleRange.setAttribute('aria-valuetext', `Règle ${app.rule}`);
    for (const chip of this.el.famousRules.querySelectorAll('[data-rule]')) {
      chip.setAttribute('aria-pressed', String(Number(/** @type {HTMLElement} */ (chip).dataset.rule) === app.rule));
    }
    const famous = FAMOUS_ELEMENTARY_RULES.find((f) => f.rule === app.rule);
    this.el.famousLabel.textContent = famous ? `Règle ${app.rule} : ${famous.label}.` : `Règle ${app.rule}.`;
    const outputs = elementaryOutputs(app.rule);
    for (const cell of this.el.ruleTable.querySelectorAll('[data-pattern]')) {
      const pattern = Number(/** @type {HTMLElement} */ (cell).dataset.pattern);
      const out = outputs[pattern];
      /** @type {HTMLElement} */ (cell.querySelector('.rule-dot--out')).classList.toggle('rule-dot--on', out === 1);
      /** @type {HTMLElement} */ (cell.querySelector('.rule-cell-bit')).textContent = String(out);
      cell.setAttribute('aria-pressed', String(out === 1));
      cell.setAttribute('aria-label', `Motif ${pattern.toString(2).padStart(3, '0')} donne ${out ? 'vivante' : 'morte'}`);
    }
    this.el.widthSelect.value = String(app.width);
  }

  /**
   * @param {import('./app.js').CellularApp} app
   */
  syncLife(app) {
    const parsed = parseLifeRule(app.lifeNotation);
    const known = LIFE_PRESETS.some((p) => p.notation === app.lifeNotation);
    this.el.lifePreset.value = known ? app.lifeNotation : '';
    if (document.activeElement !== this.el.lifeInput) {
      this.el.lifeInput.value = app.lifeNotation;
      this.el.lifeInput.setAttribute('aria-invalid', 'false');
    }
    if (parsed.rule && this.el.lifeInput.getAttribute('aria-invalid') !== 'true') {
      this.el.lifeStatus.classList.remove('hint--error');
      this.el.lifeStatus.textContent = describeLifeRule(parsed.rule);
    }
    this.el.sizeSelect.value = String(app.size);
    const entry = PATTERNS.find((p) => p.id === app.patternId);
    this.el.patternChipName.textContent = entry ? entry.name : '';
    for (const button of this.el.patternList.querySelectorAll('[data-pattern]')) {
      const selected = /** @type {HTMLElement} */ (button).dataset.pattern === app.patternId && app.tool === 'pattern';
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  /**
   * Message non bloquant, avec action facultative (Annuler…).
   * @param {string} message
   * @param {{label: string, run: () => void}} [action]
   */
  toast(message, action) {
    const focusInside = this.el.toast.contains(document.activeElement);
    if (!focusInside) {
      const active = /** @type {HTMLElement|null} */ (document.activeElement);
      this.toastReturnFocus = active && active !== document.body ? active : null;
    }
    this.el.toastText.textContent = message;
    this.setToastAction(action);
    if (focusInside && !action) {
      // Le bouton qui avait le focus disparaît : le focus revient au déclencheur.
      this.restoreFocus();
    }
    this.el.toast.hidden = false;
    this.toastDuration = action ? TOAST_WITH_ACTION_MS : TOAST_MS;
    this.armToast();
  }

  /**
   * @param {{label: string, run: () => void, undo?: boolean}} [action]
   */
  setToastAction(action) {
    this.toastAction = action ? action.run : null;
    this.toastUndo = Boolean(action?.undo);
    this.el.toastAction.hidden = !action;
    this.el.toastAction.textContent = action ? action.label : '';
    if (this.toastUndo) {
      this.el.toastAction.setAttribute('aria-keyshortcuts', 'Control+Z Meta+Z');
    } else {
      this.el.toastAction.removeAttribute('aria-keyshortcuts');
    }
  }

  /** (Re)lance le minuteur, sauf si le message est tenu par le focus ou le survol. */
  armToast() {
    clearTimeout(this.toastTimer);
    if (this.toastHeld()) {
      return;
    }
    this.toastTimer = window.setTimeout(() => this.hideToast(), this.toastDuration);
  }

  /** @returns {boolean} */
  toastHeld() {
    // Survol suivi à la souris seulement : au doigt, :hover reste « collé ».
    return this.el.toast.contains(document.activeElement) || this.toastHovered;
  }

  /**
   * Le message reste affiché tant qu'il a le focus ou est survolé (WCAG 2.2.1),
   * puis repart pour une durée complète.
   */
  bindToastHold() {
    const toast = this.el.toast;
    toast.addEventListener('focusin', () => clearTimeout(this.toastTimer));
    toast.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') {
        this.toastHovered = true;
        clearTimeout(this.toastTimer);
      }
    });
    toast.addEventListener('focusout', (event) => {
      if (!toast.contains(/** @type {Node|null} */ (event.relatedTarget)) && !toast.hidden && !this.toastHovered) {
        clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => this.hideToast(), this.toastDuration);
      }
    });
    toast.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') {
        this.toastHovered = false;
      }
      if (event.pointerType === 'mouse' && !toast.hidden && !toast.contains(document.activeElement)) {
        clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => this.hideToast(), this.toastDuration);
      }
    });
  }

  /** @returns {boolean} Un message « Annuler » est affiché */
  canUndo() {
    return this.toastUndo && !this.el.toast.hidden;
  }

  runToastAction() {
    const action = this.toastAction;
    this.hideToast();
    action?.();
  }

  hideToast() {
    clearTimeout(this.toastTimer);
    const focusInside = this.el.toast.contains(document.activeElement);
    this.el.toast.hidden = true;
    this.toastAction = null;
    this.toastUndo = false;
    if (focusInside) {
      this.restoreFocus();
    }
  }

  /** Rend le focus à l'élément actif à l'apparition du message (ou à la grille). */
  restoreFocus() {
    const target = this.toastReturnFocus;
    const usable = target && target.isConnected && target.getClientRects().length > 0;
    (usable ? target : this.el.board).focus({ preventScroll: true });
    this.toastReturnFocus = null;
  }
}

/**
 * Ctrl+Z ou ⌘Z, sans autre modificateur.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
function isUndoShortcut(event) {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z';
}

/**
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
function hasModifier(event) {
  return event.ctrlKey || event.metaKey || event.altKey;
}

/** Flèches du curseur clavier : déplacement en cellules. */
/** @type {Readonly<Record<string, [number, number]>>} */
const ARROWS = Object.freeze({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] });

/** Touches de zoom de la grille 2D. */
/** @type {Readonly<Record<string, (app: import('./app.js').CellularApp) => void>>} */
const ZOOM_KEYS = Object.freeze({
  '+': (app) => app.zoomBy(1.5),
  '=': (app) => app.zoomBy(1.5),
  '-': (app) => app.zoomBy(1 / 1.5),
  0: (app) => app.fitView(),
});

/**
 * Applique une touche à la grille.
 * @param {import('./app.js').CellularApp} app
 * @param {string} key
 * @param {boolean} shift
 * @returns {string|null|undefined} Message à annoncer, null si rien à dire,
 *   undefined si la touche ne concerne pas la grille
 */
function boardKey(app, key, shift) {
  const arrow = ARROWS[key];
  if (arrow && shift && app.mode === '2d') {
    // Maj+flèche : la vue glisse, le contenu suit la flèche.
    app.panBy(-arrow[0] * 48, -arrow[1] * 48);
    return null;
  }
  if (arrow) {
    app.moveKeyCursor(arrow[0], arrow[1]);
    return app.describeKeyCursor();
  }
  if (key === 'Enter') {
    return app.activateKeyCursor();
  }
  if (ZOOM_KEYS[key] && app.mode === '2d') {
    ZOOM_KEYS[key](app);
    return null;
  }
  return undefined;
}

/**
 * Dessine la miniature d'un motif, centrée et à l'échelle.
 * @param {HTMLCanvasElement} canvas
 * @param {import('./patterns.js').Pattern} pattern
 * @param {{ background: string, color: string, dpr: number }} style
 */
function drawThumb(canvas, pattern, { background, color, dpr }) {
  const width = 72;
  const height = 40;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const cell = Math.max(1, Math.min(6, Math.floor(Math.min((width - 6) / pattern.width, (height - 6) / pattern.height))));
  const ox = Math.floor((width - pattern.width * cell) / 2);
  const oy = Math.floor((height - pattern.height * cell) / 2);
  ctx.fillStyle = color;
  for (const [x, y] of pattern.cells) {
    ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
  }
}
