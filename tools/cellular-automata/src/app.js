/**
 * Orchestration de l'outil : état courant, boucle d'animation et actions
 * déclenchées par l'interface. Les calculs sont délégués aux modules purs
 * (rules, grid, patterns, hash-state, view) ; l'affichage au Renderer et les
 * retours visuels (compteurs, boutons, messages) à l'objet `ui`.
 */

import {
  formatLifeRule,
  isValidElementaryRule,
  lifeRuleTable,
  parseLifeRule,
  toggleElementaryPattern,
} from './rules.js';
import {
  centeredRow,
  clearGrid,
  computeElementaryHistory,
  createLifeGrid,
  lineCells,
  placePattern,
  randomizeGrid,
  randomRow,
  restoreGrid,
  setCell,
  snapshotGrid,
  stepElementaryHistory,
  stepLife,
} from './grid.js';
import { encodeRle, findPattern, parseRle, rleToCells, rotatePattern } from './patterns.js';
import { encodeState, MAX_CELLS_LENGTH, SPEEDS } from './hash-state.js';
import { clampView, fitView, moveCursor, panView, revealCell, screenToCell, zoomAt } from './view.js';

/** Nombre maximal de générations calculées par trame (évite la spirale de retard). */
const MAX_STEPS_PER_FRAME = 8;

/** Densité du remplissage aléatoire initial. */
const DEFAULT_DENSITY = 0.3;

/**
 * Retours visuels attendus de l'interface.
 * @typedef {object} UiHooks
 * @property {(app: CellularApp) => void} sync - Reflète l'état dans les contrôles
 * @property {(generation: number, population: number|null) => void} counters
 * @property {(message: string, action?: {label: string, run: () => void, undo?: boolean}) => void} toast
 */

export class CellularApp {
  /**
   * @param {object} options
   * @param {import('./renderer.js').Renderer} options.renderer
   * @param {UiHooks} options.ui
   * @param {import('./hash-state.js').ShareState} options.state - État initial décodé
   * @param {boolean} options.reducedMotion - Démarrer en pause
   * @param {(hash: string) => void} options.writeHash - Publie l'état dans l'URL
   */
  constructor({ renderer, ui, state, reducedMotion, writeHash }) {
    this.renderer = renderer;
    this.ui = ui;
    this.writeHash = writeHash;
    this.mode = state.mode;
    this.rule = state.rule;
    this.lifeNotation = state.life;
    this.lifeTable = lifeRuleTable(/** @type {import('./rules.js').LifeRule} */ (parseLifeRule(state.life).rule));
    this.size = state.size;
    this.width = state.width;
    this.speed = state.speed;
    this.trace = state.trace;
    this.density = DEFAULT_DENSITY;
    /** @type {'draw'|'erase'|'pan'|'pattern'} */
    this.tool = 'draw';
    this.patternId = 'glider';
    this.patternShape = parseRle('bo$2bo$3o!');
    this.stage = { width: 1, height: 1 };
    this.view = { scale: 1, offsetX: 0, offsetY: 0 };
    this.fitted = true;
    this.playing = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.dirty = true;
    /** @type {{x: number, y: number}|null} */
    this.hoverCell = null;
    /** @type {{x: number, y: number}|null} */
    this.ghostCell = null;
    /** Curseur clavier sur la grille (null tant que la grille n'a pas le focus clavier). */
    /** @type {{x: number, y: number}|null} */
    this.keyCursor = null;
    /** Type du pointeur du geste en cours : seul la souris garde un aperçu après le geste. */
    this.pointerType = 'mouse';
    /** @type {any} */
    this.stroke = null;
    /** @type {ReturnType<typeof snapshotGrid>|null} */
    this.origin = null;
    this.hashTimer = 0;

    this.grid = createLifeGrid(this.size, this.size);
    this.loadCells(state.cells);
    this.initialRow = state.row ? rleToCells(state.row, this.width, 1) : centeredRow(this.width);
    this.history = computeElementaryHistory(this.initialRow, 2, this.rule, 0);
    this.autoplay = !reducedMotion;
    this.renderer.refreshTheme(this.trace);
    this.frame = this.frame.bind(this);
  }

  /**
   * Charge la grille partagée, ou un remplissage aléatoire par défaut.
   * @param {string|null} cells
   */
  loadCells(cells) {
    if (cells) {
      this.grid.cells.set(rleToCells(cells, this.size, this.size));
      let population = 0;
      for (let i = 0; i < this.grid.cells.length; i++) {
        this.grid.ages[i] = this.grid.cells[i];
        population += this.grid.cells[i];
      }
      this.grid.population = population;
    } else {
      randomizeGrid(this.grid, this.density);
    }
  }

  /** Démarre la boucle d'animation. */
  start() {
    this.layout();
    if (this.mode === '1d' && !this.autoplay) {
      this.recomputeHistory(this.history.rows - 1);
    }
    if (this.autoplay) {
      this.play();
    }
    this.ui.sync(this);
    requestAnimationFrame(this.frame);
  }

  // ===========================================================================
  // Boucle et lecture
  // ===========================================================================

  /**
   * @param {number} time
   */
  frame(time) {
    if (this.playing) {
      this.advance(time);
    }
    if (this.dirty) {
      this.render();
      this.dirty = false;
    }
    requestAnimationFrame(this.frame);
  }

  /**
   * Pas de temps fixe : la vitesse ne dépend pas de la fréquence d'affichage.
   * @param {number} time
   */
  advance(time) {
    const elapsed = Math.min(time - (this.lastTime || time), 250);
    this.lastTime = time;
    this.accumulator += elapsed;
    const interval = 1000 / SPEEDS[this.speed];
    let steps = 0;
    while (this.accumulator >= interval && steps < MAX_STEPS_PER_FRAME && this.playing) {
      this.stepOnce();
      this.accumulator -= interval;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) {
      this.accumulator = 0;
    }
  }

  /** Calcule une génération dans le mode courant. */
  stepOnce() {
    if (this.mode === '1d') {
      stepElementaryHistory(this.history, this.rule);
    } else {
      if (this.grid.generation === 0) {
        // Point de retour du bouton « Début ».
        this.origin = snapshotGrid(this.grid);
      }
      stepLife(this.grid, this.lifeTable);
      if (this.grid.population === 0 && this.playing) {
        this.pause();
        this.ui.toast('Population éteinte : dessinez ou remplissez au hasard.');
      }
    }
    this.dirty = true;
  }

  play() {
    if (this.mode === '2d' && this.grid.population === 0) {
      this.ui.toast('La grille est vide : dessinez ou choisissez un motif.');
      return;
    }
    this.playing = true;
    this.lastTime = 0;
    this.accumulator = 1000 / SPEEDS[this.speed];
    this.ui.sync(this);
  }

  pause() {
    this.playing = false;
    this.ui.sync(this);
    this.scheduleHash();
  }

  togglePlay() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  /** Avance d'une génération exactement (met en pause si besoin). */
  step() {
    if (this.playing) {
      this.pause();
    }
    this.stepOnce();
    this.scheduleHash();
  }

  /** Retour à la génération 0. */
  restart() {
    if (this.mode === '1d') {
      this.recomputeHistory(0);
    } else if (this.origin && this.grid.generation > 0) {
      restoreGrid(this.grid, this.origin);
    }
    this.dirty = true;
    this.scheduleHash();
  }

  /**
   * @param {number} index - Indice dans SPEEDS
   */
  setSpeed(index) {
    this.speed = Math.min(Math.max(0, Math.round(index)), SPEEDS.length - 1);
    this.ui.sync(this);
    this.scheduleHash();
  }

  // ===========================================================================
  // Mode, règles et contenu
  // ===========================================================================

  /**
   * @param {'1d'|'2d'} mode
   */
  setMode(mode) {
    if (mode === this.mode) {
      return;
    }
    this.mode = mode;
    this.keyCursor = null;
    if (mode === '1d' && this.tool !== 'erase') {
      this.tool = 'draw';
    }
    this.layoutSoon();
    this.ui.sync(this);
    this.scheduleHash();
  }

  /**
   * @param {number} rule
   */
  setRule(rule) {
    if (!isValidElementaryRule(rule) || rule === this.rule) {
      return;
    }
    this.rule = rule;
    this.recomputeHistory(Math.max(this.history.generation, this.history.rows - 1));
    this.ui.sync(this);
    this.scheduleHash();
  }

  /**
   * @param {number} pattern - Motif 0-7 de la table
   */
  togglePattern(pattern) {
    this.setRule(toggleElementaryPattern(this.rule, pattern));
  }

  /**
   * Remplace la ligne de départ 1D.
   * @param {'center'|'random'} kind
   */
  setRow(kind) {
    this.initialRow = kind === 'center' ? centeredRow(this.width) : randomRow(this.width, 0.5);
    this.recomputeHistory(Math.max(this.history.generation, this.history.rows - 1));
    this.scheduleHash();
  }

  /**
   * @param {number} width
   */
  setWidth(width) {
    const centered = this.isCenteredRow();
    this.width = width;
    this.keyCursor = null;
    this.initialRow = centered ? centeredRow(width) : randomRow(width, 0.5);
    this.layout();
    this.scheduleHash();
  }

  /**
   * @returns {boolean}
   */
  isCenteredRow() {
    return encodeRle(this.initialRow, this.width, 1) === encodeRle(centeredRow(this.width), this.width, 1);
  }

  /**
   * Applique une notation B/S saisie.
   * @param {string} text
   * @returns {string|null} Message d'erreur, null si appliquée
   */
  setLifeRule(text) {
    const parsed = parseLifeRule(text);
    if (!parsed.rule) {
      return parsed.error;
    }
    this.lifeNotation = formatLifeRule(parsed.rule);
    this.lifeTable = lifeRuleTable(parsed.rule);
    this.ui.sync(this);
    this.scheduleHash();
    return null;
  }

  /**
   * Change la taille de la grille 2D en recentrant le contenu existant.
   * @param {number} size
   */
  setSize(size) {
    if (size === this.size) {
      return;
    }
    const previous = this.grid;
    this.size = size;
    this.keyCursor = null;
    this.grid = createLifeGrid(size, size);
    const dx = Math.floor((size - previous.width) / 2);
    for (let y = 0; y < previous.height; y++) {
      for (let x = 0; x < previous.width; x++) {
        if (previous.cells[y * previous.width + x]) {
          setCell(this.grid, x + dx, y + dx, 1);
        }
      }
    }
    this.origin = null;
    this.fitView();
    this.scheduleHash();
  }

  /**
   * @param {number} density - 0-1
   */
  setDensity(density) {
    this.density = density;
  }

  /** Remplissage aléatoire, annulable. */
  randomize() {
    this.withUndo('Grille remplie au hasard.', () => randomizeGrid(this.grid, this.density));
  }

  /** Efface tout, annulable (pas de confirmation bloquante). */
  clear() {
    this.withUndo('Grille effacée.', () => clearGrid(this.grid));
    this.pause();
  }

  /**
   * Exécute une modification globale en proposant de l'annuler.
   * @param {string} message
   * @param {() => void} change
   */
  withUndo(message, change) {
    const before = snapshotGrid(this.grid);
    change();
    this.origin = null;
    this.dirty = true;
    this.ui.counters(this.grid.generation, this.grid.population);
    this.scheduleHash();
    this.ui.toast(message, {
      label: 'Annuler',
      undo: true,
      run: () => {
        restoreGrid(this.grid, before);
        this.dirty = true;
        this.scheduleHash();
      },
    });
  }

  /**
   * @param {'draw'|'erase'|'pan'|'pattern'} tool
   */
  setTool(tool) {
    this.tool = tool;
    this.ghostCell = null;
    this.hoverCell = null;
    this.syncKeyPreview();
    this.dirty = true;
    this.ui.sync(this);
  }

  /**
   * Choisit un motif de la bibliothèque et active l'outil « Motif ».
   * @param {string} id
   */
  selectPattern(id) {
    const entry = findPattern(id);
    if (!entry) {
      return;
    }
    this.patternId = id;
    this.patternShape = parseRle(entry.rle);
    this.setTool('pattern');
    if (entry.rule && entry.rule !== this.lifeNotation) {
      this.ui.toast(`Ce motif est conçu pour ${entry.rule}.`, {
        label: 'Appliquer',
        run: () => this.setLifeRule(/** @type {string} */ (entry.rule)),
      });
    }
  }

  rotateSelectedPattern() {
    this.patternShape = rotatePattern(this.patternShape);
    this.dirty = true;
  }

  /**
   * @param {boolean} trace
   */
  setTrace(trace) {
    this.trace = trace;
    this.renderer.refreshTheme(trace);
    this.dirty = true;
    this.scheduleHash();
  }

  /** Relit les couleurs après un changement de thème. */
  refreshTheme() {
    this.renderer.refreshTheme(this.trace);
    this.dirty = true;
  }

  // ===========================================================================
  // Mise en page et vue
  // ===========================================================================

  /** Recalcule tailles et vue après un redimensionnement. */
  layout() {
    this.stage = this.renderer.resize();
    if (this.mode === '1d') {
      const scale = this.stage.width / this.width;
      const rows = Math.max(2, Math.floor(this.stage.height / scale));
      if (rows !== this.history.rows || this.history.width !== this.width) {
        this.recomputeHistory(this.history.width === this.width ? this.history.generation : 0, rows);
      }
    } else if (this.fitted) {
      this.fitView();
    } else {
      this.view = clampView(this.view, this.size, this.size, this.stage.width, this.stage.height);
    }
    this.dirty = true;
  }

  /** Mise en page après que le DOM a appliqué un changement de disposition. */
  layoutSoon() {
    requestAnimationFrame(() => this.layout());
  }

  /** Vue courante (2D) ou vue « pleine largeur » (1D). */
  currentView() {
    if (this.mode === '1d') {
      return { scale: this.stage.width / this.width, offsetX: 0, offsetY: 0 };
    }
    return this.view;
  }

  fitView() {
    this.fitted = true;
    this.view = fitView(this.size, this.size, this.stage.width, this.stage.height);
    this.dirty = true;
  }

  /**
   * Zoom au centre de la zone (boutons + et −).
   * @param {number} factor
   */
  zoomBy(factor) {
    this.zoomAround(factor, this.stage.width / 2, this.stage.height / 2);
    this.revealKeyCursor();
  }

  /**
   * @param {number} factor
   * @param {number} cx
   * @param {number} cy
   */
  zoomAround(factor, cx, cy) {
    if (this.mode !== '2d') {
      return;
    }
    this.fitted = false;
    this.view = clampView(zoomAt(this.view, factor, cx, cy), this.size, this.size, this.stage.width, this.stage.height);
    this.dirty = true;
  }

  /**
   * @param {number} dx
   * @param {number} dy
   */
  panBy(dx, dy) {
    this.fitted = false;
    this.view = clampView(panView(this.view, dx, dy), this.size, this.size, this.stage.width, this.stage.height);
    this.dirty = true;
  }

  /**
   * Recalcule l'historique 1D jusqu'à une génération donnée.
   * @param {number} generation
   * @param {number} [rows]
   */
  recomputeHistory(generation, rows = this.history.rows) {
    this.history = computeElementaryHistory(this.initialRow, rows, this.rule, generation);
    this.dirty = true;
  }

  // ===========================================================================
  // Gestes sur la grille
  // ===========================================================================

  /**
   * @param {{x: number, y: number}} point
   * @returns {{x: number, y: number}|null}
   */
  cellAt(point) {
    if (this.mode === '1d') {
      const cell = screenToCell(this.currentView(), point.x, point.y, this.width, this.history.rows);
      return cell;
    }
    return screenToCell(this.view, point.x, point.y, this.size, this.size);
  }

  /**
   * @param {{x: number, y: number}} point
   * @param {string} [pointerType] - « mouse », « pen » ou « touch »
   */
  gestureStart(point, pointerType = 'mouse') {
    this.pointerType = pointerType;
    if (this.tool === 'pan' && this.mode === '2d') {
      this.stroke = { kind: 'pan', last: point };
      return;
    }
    if (this.tool === 'pattern' && this.mode === '2d') {
      this.ghostCell = this.cellAt(point);
      this.dirty = true;
      return;
    }
    this.stroke = {
      kind: 'paint',
      value: this.tool === 'erase' ? 0 : 1,
      last: null,
      before: this.mode === '2d' ? snapshotGrid(this.grid) : this.initialRow.slice(),
    };
    this.paintTo(point);
  }

  /**
   * @param {{x: number, y: number}} point
   */
  gestureMove(point) {
    if (this.tool === 'pattern' && this.mode === '2d') {
      this.ghostCell = this.cellAt(point);
      this.dirty = true;
    } else if (this.stroke?.kind === 'pan') {
      this.panBy(point.x - this.stroke.last.x, point.y - this.stroke.last.y);
      this.stroke.last = point;
    } else if (this.stroke?.kind === 'paint') {
      this.paintTo(point);
    }
  }

  /**
   * @param {{x: number, y: number}} point
   */
  gestureEnd(point) {
    if (this.tool === 'pattern' && this.mode === '2d') {
      const cell = this.cellAt(point);
      if (cell) {
        placePattern(this.grid, this.patternShape, cell.x, cell.y);
        this.ui.counters(this.grid.generation, this.grid.population);
      }
      this.ghostCell = null;
    }
    this.stroke = null;
    this.clearTouchPreview();
    this.dirty = true;
    this.scheduleHash();
  }

  /** Second doigt posé : le tracé commencé est annulé. */
  gestureCancel() {
    if (this.stroke?.kind === 'paint') {
      this.undoStroke(this.stroke.before);
    }
    this.stroke = null;
    this.ghostCell = null;
    this.clearTouchPreview();
    this.dirty = true;
  }

  /**
   * Doigt ou stylet levé : sans survol possible, le contour du pinceau
   * resterait affiché indéfiniment (et suivrait la vue après un pincement).
   */
  clearTouchPreview() {
    if (this.pointerType !== 'mouse') {
      this.hoverCell = null;
    }
  }

  /**
   * @param {any} before
   */
  undoStroke(before) {
    if (this.mode === '2d') {
      restoreGrid(this.grid, before);
    } else {
      this.initialRow = before;
      this.recomputeHistory(this.history.generation);
    }
  }

  /**
   * Prolonge le tracé jusqu'au point, sans trou entre deux événements.
   * @param {{x: number, y: number}} point
   */
  paintTo(point) {
    const cell = this.cellAt(point);
    if (!cell) {
      this.stroke.last = null;
      return;
    }
    const from = this.stroke.last ?? cell;
    for (const [x, y] of lineCells(from.x, from.y, cell.x, cell.y)) {
      this.paintCell(x, y);
    }
    this.stroke.last = cell;
    this.hoverCell = cell;
    if (this.mode === '1d') {
      this.recomputeHistory(Math.max(this.history.generation, this.history.rows - 1));
    }
    this.dirty = true;
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  paintCell(x, y) {
    if (this.mode === '1d') {
      this.initialRow[x] = this.stroke.value;
    } else {
      setCell(this.grid, x, y, this.stroke.value);
    }
  }

  /**
   * Survol à la souris : aperçu du pinceau ou du motif.
   * @param {{x: number, y: number}|null} point
   */
  hover(point) {
    const cell = point ? this.cellAt(point) : null;
    if (this.tool === 'pattern' && this.mode === '2d') {
      this.ghostCell = cell;
    } else {
      this.hoverCell = this.tool === 'pan' ? null : cell;
    }
    this.dirty = true;
  }

  // ===========================================================================
  // Curseur clavier sur la grille
  // ===========================================================================

  /** Dimensions de la zone que parcourt le curseur clavier. */
  keyArea() {
    // En 1D, seule la ligne de départ se modifie.
    return this.mode === '1d' ? { width: this.width, height: 1 } : { width: this.size, height: this.size };
  }

  /**
   * Affiche le curseur clavier (au centre la première fois).
   * @returns {{x: number, y: number}}
   */
  showKeyCursor() {
    const area = this.keyArea();
    const cell = this.keyCursor ?? { x: Math.floor(area.width / 2), y: Math.floor(area.height / 2) };
    this.keyCursor = moveCursor(cell, 0, 0, area.width, area.height);
    this.syncKeyPreview();
    return this.keyCursor;
  }

  /** La grille perd le focus : plus d'aperçu clavier. */
  hideKeyCursor() {
    this.keyCursor = null;
    this.hoverCell = null;
    this.ghostCell = null;
    this.dirty = true;
  }

  /**
   * @param {number} dx
   * @param {number} dy
   * @returns {{x: number, y: number}}
   */
  moveKeyCursor(dx, dy) {
    const area = this.keyArea();
    this.keyCursor = moveCursor(this.showKeyCursor(), dx, dy, area.width, area.height);
    if (this.mode === '2d') {
      this.revealKeyCursor();
    }
    this.syncKeyPreview();
    return this.keyCursor;
  }

  /** Garde le curseur clavier visible sur une grille zoomée. */
  revealKeyCursor() {
    if (!this.keyCursor || this.mode !== '2d') {
      return;
    }
    // Avec l'outil Motif, la zone à montrer couvre le motif centré sur le curseur.
    const half = this.tool === 'pattern' ? Math.ceil(Math.max(this.patternShape.width, this.patternShape.height) / 2) : 0;
    const view = revealCell(this.view, this.keyCursor, this.stage.width, this.stage.height, {
      reach: half * this.view.scale,
    });
    if (view.offsetX !== this.view.offsetX || view.offsetY !== this.view.offsetY) {
      this.fitted = false;
      this.view = clampView(view, this.size, this.size, this.stage.width, this.stage.height);
    }
  }

  /** Reflète le curseur clavier comme aperçu de pinceau ou de motif. */
  syncKeyPreview() {
    if (!this.keyCursor) {
      return;
    }
    const cell = this.mode === '1d' ? { x: this.keyCursor.x, y: 0 } : this.keyCursor;
    if (this.tool === 'pattern' && this.mode === '2d') {
      this.ghostCell = cell;
      this.hoverCell = null;
    } else {
      this.ghostCell = null;
      this.hoverCell = cell;
    }
    this.dirty = true;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isAlive(x, y) {
    return this.mode === '1d' ? this.initialRow[x] === 1 : this.grid.cells[y * this.size + x] === 1;
  }

  /**
   * Entrée sur la grille : bascule la cellule (Dessiner, Vue), l'efface
   * (Effacer) ou pose le motif choisi (Motif).
   * @returns {string} Compte rendu à annoncer
   */
  activateKeyCursor() {
    const { x, y } = this.showKeyCursor();
    if (this.tool === 'pattern' && this.mode === '2d') {
      placePattern(this.grid, this.patternShape, x, y);
      this.ui.counters(this.grid.generation, this.grid.population);
      this.dirty = true;
      this.scheduleHash();
      return `${findPattern(this.patternId)?.name ?? 'Motif'} posé.`;
    }
    const value = this.tool === 'erase' ? 0 : Number(!this.isAlive(x, y));
    if (this.mode === '1d') {
      this.initialRow[x] = value;
      this.recomputeHistory(Math.max(this.history.generation, this.history.rows - 1));
    } else {
      setCell(this.grid, x, y, value);
      this.ui.counters(this.grid.generation, this.grid.population);
    }
    this.dirty = true;
    this.scheduleHash();
    return value ? 'Cellule vivante.' : 'Cellule morte.';
  }

  /**
   * Position du curseur clavier, à annoncer.
   * @returns {string}
   */
  describeKeyCursor() {
    if (!this.keyCursor) {
      return '';
    }
    const { x, y } = this.keyCursor;
    const where = this.mode === '1d' ? `Colonne ${x + 1} sur ${this.width}` : `Colonne ${x + 1}, ligne ${y + 1}`;
    if (this.tool === 'pattern' && this.mode === '2d') {
      return `${where} : Entrée pour poser ${findPattern(this.patternId)?.name ?? 'le motif'}.`;
    }
    return `${where} : ${this.isAlive(x, y) ? 'vivante' : 'morte'}.`;
  }

  // ===========================================================================
  // Rendu, partage et export
  // ===========================================================================

  /** @returns {import('./renderer.js').Frame} */
  currentFrame() {
    if (this.mode === '1d') {
      return {
        ages: this.history.ages,
        trail: null,
        width: this.width,
        height: this.history.rows,
        view: this.currentView(),
        cursor: this.hoverCell,
      };
    }
    return {
      ages: this.grid.ages,
      trail: this.grid.trail,
      width: this.size,
      height: this.size,
      view: this.view,
      ghost: this.ghostCells(),
      cursor: this.tool === 'pattern' ? null : this.hoverCell,
    };
  }

  /** @returns {Array<[number, number]>|null} */
  ghostCells() {
    if (!this.ghostCell || this.tool !== 'pattern') {
      return null;
    }
    const ox = this.ghostCell.x - Math.floor(this.patternShape.width / 2);
    const oy = this.ghostCell.y - Math.floor(this.patternShape.height / 2);
    return this.patternShape.cells.map(([x, y]) => [ox + x, oy + y]);
  }

  render() {
    this.renderer.draw(this.currentFrame());
    if (this.mode === '1d') {
      this.ui.counters(this.history.generation, null);
    } else {
      this.ui.counters(this.grid.generation, this.grid.population);
    }
  }

  /** @returns {import('./hash-state.js').ShareState} */
  shareState() {
    return {
      mode: this.mode,
      rule: this.rule,
      life: this.lifeNotation,
      size: this.size,
      width: this.width,
      speed: this.speed,
      trace: this.trace,
      cells: this.grid.population > 0 ? encodeRle(this.grid.cells, this.size, this.size) : null,
      row: this.isCenteredRow() ? null : encodeRle(this.initialRow, this.width, 1),
    };
  }

  /**
   * Lien complet vers l'état courant.
   * @returns {{ url: string, complete: boolean }} complete = false si la grille a été omise
   */
  shareLink() {
    const state = this.shareState();
    const hash = encodeState(state);
    const complete = this.mode === '1d' || !state.cells || state.cells.length <= MAX_CELLS_LENGTH;
    return { url: `${location.href.split('#')[0]}#${hash}`, complete };
  }

  /** Met à jour le fragment d'URL peu après la dernière modification. */
  scheduleHash() {
    clearTimeout(this.hashTimer);
    this.hashTimer = window.setTimeout(() => {
      this.writeHash(encodeState(this.shareState()));
    }, 400);
  }

  /** @returns {Promise<Blob|null>} */
  exportPng() {
    return this.renderer.exportPng(this.currentFrame());
  }

  /** @returns {string} */
  exportName() {
    return this.mode === '1d'
      ? `automate-regle-${this.rule}.png`
      : `automate-${this.lifeNotation.replace('/', '-')}-gen${this.grid.generation}.png`;
  }
}
