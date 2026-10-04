import { TetrisEngine } from './engine.js';
import { TetrisRenderer, formatTime, formatClearLabel } from './renderer.js';
import { TetrisAudio } from './audio.js';
import { TetrisRecords } from './records.js';

const MODE_NAMES = { marathon: 'Marathon', sprint: 'Sprint', ultra: 'Ultra' };
const STEP = 1000 / 120;
const KEY_ACTIONS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'softDrop',
  ArrowUp: 'rotateCW', KeyX: 'rotateCW', KeyZ: 'rotateCCW',
  KeyC: 'hold', Space: 'hardDrop',
};
const REPEATING = new Set(['left', 'right', 'softDrop']);

/**
 * Change un texte uniquement lorsqu'il a changé (notamment pour les régions live).
 * @param {HTMLElement} element - Élément cible.
 * @param {string} value - Texte.
 */
function text(element, value) {
  if (element.textContent !== value) { element.textContent = value; }
}

/**
 * @param {object} state - État du moteur.
 * @returns {{maximum: number, value: number, goal: string}} Progression du mode.
 */
function progressFor(state) {
  if (state.mode === 'sprint') {
    return { maximum: 40, value: Math.min(40, state.lines), goal: `${Math.max(0, 40 - state.lines)} lignes à compléter` };
  }
  if (state.mode === 'ultra') {
    return { maximum: 120000, value: Math.min(120000, state.elapsed), goal: '120 secondes. Chaque point compte.' };
  }
  return { maximum: 10, value: state.lines % 10, goal: `${10 - state.lines % 10} lignes avant le niveau suivant` };
}

/**
 * Contrôleur navigateur ; les horloges, entrées et effets restent hors du moteur.
 * Les dépendances injectables permettent de tester le vrai parcours DOM avec Jest.
 */
export class TetrisController {
  /**
   * @param {{document: Document, window: Window, kit: object, engine?: object, renderer?: object, audio?: object}} options - Dépendances.
   */
  constructor({ document, window, kit, engine = new TetrisEngine(), renderer, audio }) {
    this.document = document;
    this.window = window;
    this.kit = kit;
    this.engine = engine;
    this.elements = {};
    for (const id of [
      'board', 'hold', 'next', 'score', 'lines', 'level', 'time', 'record',
      'record-mode', 'hold-status', 'overlay', 'overlay-kicker', 'overlay-title',
      'overlay-description', 'modes', 'start', 'resume', 'pause', 'menu', 'sound',
      'quit', 'mode-label', 'play-state', 'progress', 'progress-fill', 'goal',
      'announcement', 'clear-effect', 'storage-notice',
    ]) {
      const element = document.getElementById(id);
      if (!element) { throw new Error(`Élément UI manquant : ${id}`); }
      this.elements[id] = element;
    }
    this.renderer = renderer || new TetrisRenderer(this.elements);
    this.audio = audio || new TetrisAudio(window, message => {
      this.notify(message);
      this.updateSoundButton();
    });
    this.kit.init('tetris');
    this.records = new TetrisRecords(kit, message => this.notify(message));
    this.state = engine.init({ seed: 42, playerIds: ['human'], mode: 'marathon' });
    this.running = false;
    this.started = false;
    this.disposed = false;
    this.held = new Map();
    this.frameId = null;
    this.lastFrame = null;
    this.accumulator = 0;
    this.abort = new window.AbortController();
    this.bindEvents();
    this.render();
  }

  /**
   * @param {EventTarget} target - Émetteur.
   * @param {string} name - Événement.
   * @param {Function} handler - Callback.
   */
  listen(target, name, handler) {
    target.addEventListener(name, handler, { signal: this.abort.signal });
  }

  /** Relie clavier, pointeurs, focus et callbacks GameKit. */
  bindEvents() {
    const e = this.elements;
    this.listen(e.start, 'click', () => this.start());
    this.listen(e.resume, 'click', () => this.resume());
    this.listen(e.pause, 'click', () => this.pause());
    this.listen(e.menu, 'click', () => this.showMenu());
    this.listen(e.sound, 'click', () => this.toggleSound());
    this.listen(e.quit, 'click', event => {
      if (this.window.parent !== this.window) {
        event.preventDefault();
        this.kit.quit();
      }
    });
    this.listen(this.document, 'change', event => {
      if (event.target.name === 'mode') { this.showRecord(event.target.value); }
    });
    this.listen(this.document, 'keydown', event => this.keyDown(event));
    this.listen(this.document, 'keyup', event => this.release(`key:${event.code}`));
    this.listen(this.window, 'blur', () => this.pause());
    this.listen(this.document, 'visibilitychange', () => {
      if (this.document.hidden) { this.pause(); }
    });
    this.listen(this.window, 'pagehide', () => this.dispose());
    this.listen(e['clear-effect'], 'animationend', () => e['clear-effect'].classList.remove('flash'));
    for (const button of this.document.querySelectorAll('[data-action]')) {
      this.listen(button, 'pointerdown', event => {
        if (!this.running || (event.button !== undefined && event.button !== 0)) { return; }
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        this.press(`pointer:${event.pointerId}`, button.dataset.action);
      });
      this.listen(button, 'pointerup', event => this.release(`pointer:${event.pointerId}`));
      this.listen(button, 'pointercancel', event => this.release(`pointer:${event.pointerId}`));
      this.listen(button, 'lostpointercapture', event => this.release(`pointer:${event.pointerId}`));
      // Un lecteur d'écran peut activer un bouton sans produire de PointerEvent.
      this.listen(button, 'click', event => {
        if (event.detail === 0) { this.act(button.dataset.action); }
      });
    }
    this.hooks = {
      onGamePause: () => this.pause(),
      onGameResume: () => {},
      onGameDispose: () => this.dispose(),
      onSoundChange: enabled => {
        if (!enabled) {
          this.audio.setEnabled(false);
          this.updateSoundButton();
        }
      },
    };
    this.previousHooks = {};
    for (const [name, hook] of Object.entries(this.hooks)) {
      this.previousHooks[name] = this.window[name];
      this.window[name] = hook;
    }
  }

  /**
   * Démarre le mode sélectionné. Le générateur du moteur ne dépend pas de l'horloge.
   * @param {number} [seed] - Graine facultative pour reproduire une partie.
   */
  start(seed) {
    this.stopLoop();
    const mode = this.document.querySelector('input[name="mode"]:checked').value;
    const random = new Uint32Array(1);
    if (seed === undefined) { this.window.crypto.getRandomValues(random); }
    this.state = this.engine.init({ seed: seed ?? random[0], playerIds: ['human'], mode });
    this.started = true;
    this.running = true;
    this.elements.overlay.hidden = true;
    this.elements.pause.disabled = false;
    this.elements.board.focus();
    text(this.elements.announcement, 'À toi de jouer.');
    this.render();
    this.schedule();
  }

  /** Termine toutes les entrées actives et annule la frame en attente. */
  stopLoop() {
    this.held.clear();
    if (this.frameId !== null) { this.window.cancelAnimationFrame(this.frameId); }
    this.frameId = null;
    this.lastFrame = null;
    this.accumulator = 0;
  }

  /** Met en pause sans consommer une milliseconde supplémentaire de simulation. */
  pause() {
    if (!this.running) { this.held.clear(); return; }
    this.running = false;
    this.stopLoop();
    const e = this.elements;
    e.overlay.hidden = false;
    e.modes.hidden = true;
    e.resume.hidden = false;
    e.pause.disabled = true;
    text(e['overlay-kicker'], 'ON SOUFFLE UN INSTANT');
    text(e['overlay-title'], 'Le flow attendra.');
    text(e['overlay-description'], `${MODE_NAMES[this.state.mode]} · ${this.state.lines} lignes · ${formatTime(this.state.elapsed)}`);
    text(e.start, 'Recommencer');
    text(e['play-state'], 'EN PAUSE');
    e.resume.focus();
  }

  /** La reprise est toujours explicite, même après retour de l'onglet. */
  resume() {
    if (!this.started || this.state.gameOver || this.disposed) { return; }
    this.running = true;
    this.elements.overlay.hidden = true;
    this.elements.pause.disabled = false;
    this.elements.board.focus();
    this.lastFrame = null;
    this.render();
    this.schedule();
  }

  /** Ouvre le sélecteur de mode en conservant la possibilité de reprendre. */
  showMenu() {
    this.pause();
    const e = this.elements;
    e.overlay.hidden = false;
    e.modes.hidden = false;
    e.resume.hidden = !this.started || this.state.gameOver;
    text(e['overlay-kicker'], 'TON PROCHAIN DÉFI');
    text(e['overlay-title'], 'Change de rythme.');
    text(e['overlay-description'], 'Une nouvelle partie remet le compteur à zéro.');
    text(e.start, 'Commencer une nouvelle partie');
    this.document.querySelector('input[name="mode"]:checked').focus();
  }

  /**
   * @param {KeyboardEvent} event - Entrée clavier.
   */
  keyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) { return; }
    if (this.handlePauseKey(event)) { return; }
    if (event.target.closest?.('input, select, textarea, button, a, summary') ||
      !this.running) { return; }
    const action = KEY_ACTIONS[event.code];
    if (!action) { return; }
    event.preventDefault();
    if (!event.repeat) { this.press(`key:${event.code}`, action); }
  }

  /**
   * @param {KeyboardEvent} event - Entrée clavier.
   * @returns {boolean} Vrai si la touche de pause a été consommée.
   */
  handlePauseKey(event) {
    if (!['KeyP', 'Escape'].includes(event.code) || !this.started ||
      event.target.closest?.('input, select, textarea')) { return false; }
    event.preventDefault();
    if (event.repeat) { return true; }
    if (this.running) { this.pause(); } else { this.resume(); }
    return true;
  }

  /**
   * Enregistre les répétitions indépendamment de la configuration du clavier.
   * @param {string} id - Source clavier ou pointeur.
   * @param {string} action - Action.
   */
  press(id, action) {
    this.act(action);
    if (this.running && REPEATING.has(action)) {
      this.held.set(id, { action, untilRepeat: action === 'softDrop' ? 35 : 150 });
    }
  }

  /**
   * @param {string} id - Source à relâcher.
   */
  release(id) { this.held.delete(id); }

  /**
   * Valide l'action avant de l'appliquer, y compris une réserve indisponible.
   * @param {string} type - Action du joueur ou tick.
   * @param {number} [delta] - Temps simulé.
   */
  act(type, delta) {
    if (!this.running) { return; }
    const action = type === 'tick' ? { type, delta } : { type };
    if (!this.engine.isValidAction(this.state, action, 'human')) { return; }
    const previous = this.state;
    this.state = this.engine.applyAction(previous, action, 'human');
    if (type !== 'tick') { this.playMoveSound(type, previous); }
    if (this.state.piecesPlaced !== previous.piecesPlaced && this.state.lastClear?.points > 0) {
      this.announceClear();
    }
    if (this.state.gameOver) { this.finish(); }
    if (type !== 'tick') { this.render(); }
  }

  /**
   * @param {string} type - Action du joueur.
   * @param {object} previous - État avant l'action.
   */
  playMoveSound(type, previous) {
    if (type === 'hardDrop') { this.audio.play('drop'); return; }
    if (type === 'hold') { this.audio.play('hold'); return; }
    if (JSON.stringify(previous.active) !== JSON.stringify(this.state.active)) {
      this.audio.play(type.startsWith('rotate') ? 'rotate' : 'move');
    }
  }

  /** Annonce la dernière ligne effacée et relance l'effet visuel. */
  announceClear() {
    const clear = this.state.lastClear;
    const combo = this.state.combo > 0 ? ` · Combo ${this.state.combo}` : '';
    text(this.elements.announcement, `${formatClearLabel(clear.label)} · +${clear.points} points${combo}`);
    this.audio.play('clear');
    const effect = this.elements['clear-effect'];
    effect.classList.remove('flash');
    void effect.offsetWidth;
    effect.classList.add('flash');
  }

  /** Affiche le bilan et enregistre les records une seule fois. */
  finish() {
    this.running = false;
    this.stopLoop();
    const record = this.records.finish(this.state);
    this.audio.play('end');
    const e = this.elements;
    const victory = this.state.mode === 'sprint' && this.state.lines >= 40;
    e.overlay.hidden = false;
    e.modes.hidden = false;
    e.resume.hidden = true;
    e.pause.disabled = true;
    text(e['overlay-kicker'], record ? 'NOUVEAU RECORD PERSONNEL' : 'CHAQUE PARTIE EST UN NOUVEAU DÉPART');
    text(e['overlay-title'], victory ? '40 lignes.\nBien joué.' : this.state.mode === 'ultra' && this.state.elapsed >= 120000 ? 'Temps écoulé.' : 'Fin du voyage.');
    text(e['overlay-description'], `${this.state.score.toLocaleString('fr-FR')} points · ${this.state.lines} lignes\n${formatTime(this.state.elapsed)} · ${this.state.piecesPlaced} pièces posées`);
    text(e.start, 'Rejouer');
    text(e.announcement, victory ? `Sprint terminé en ${formatTime(this.state.elapsed)}.` : `Partie terminée : ${this.state.score} points.`);
    this.render();
    e.start.focus();
  }

  /** Planifie une seule frame, même si plusieurs appels demandent une reprise. */
  schedule() {
    if (this.running && this.frameId === null && !this.disposed) {
      this.frameId = this.window.requestAnimationFrame(timestamp => this.frame(timestamp));
    }
  }

  /**
   * Boucle à pas fixe ; une interruption longue provoque une pause sûre.
   * @param {number} timestamp - Horloge requestAnimationFrame.
   */
  frame(timestamp) {
    this.frameId = null;
    if (!this.running || this.disposed) { return; }
    const delta = this.lastFrame === null ? 0 : timestamp - this.lastFrame;
    this.lastFrame = timestamp;
    if (delta > 250) { this.pause(); return; }
    this.accumulator += Math.max(0, delta);
    while (this.accumulator >= STEP && this.running) {
      this.accumulator -= STEP;
      for (const held of this.held.values()) {
        held.untilRepeat -= STEP;
        if (held.untilRepeat <= 0) {
          this.act(held.action);
          held.untilRepeat += held.action === 'softDrop' ? 35 : 45;
        }
      }
      this.act('tick', STEP);
    }
    this.render();
    this.schedule();
  }

  /**
   * @param {string} mode - Mode dont afficher le record.
   */
  showRecord(mode) {
    const value = this.records.get(mode);
    text(this.elements.record, value === null ? '—' : mode === 'sprint' ? formatTime(value) : value.toLocaleString('fr-FR'));
    text(this.elements['record-mode'], `${MODE_NAMES[mode]}${mode === 'sprint' ? ' · meilleur temps' : ' · meilleur score'}`);
  }

  /** @returns {string} Libellé de l'état de partie. */
  playStateLabel() {
    if (this.state.gameOver) { return 'TERMINÉ'; }
    if (this.running) { return 'DANS LE FLOW'; }
    return this.started ? 'EN PAUSE' : 'PRÊT À JOUER';
  }

  /** Met à jour le tableau de bord sans annoncer chaque tick aux lecteurs d'écran. */
  render() {
    const state = this.state;
    const e = this.elements;
    this.renderer.draw(state);
    text(e.score, String(state.score).padStart(6, '0'));
    text(e.lines, String(state.lines).padStart(2, '0'));
    text(e.level, String(state.level).padStart(2, '0'));
    text(e.time, formatTime(state.mode === 'ultra' ? 120000 - state.elapsed : state.elapsed));
    text(e['mode-label'], MODE_NAMES[state.mode].toUpperCase());
    text(e['play-state'], this.playStateLabel());
    text(e['hold-status'], state.canHold ? 'Une seconde chance.' : 'Disponible après la pose.');
    const selected = this.document.querySelector('input[name="mode"]:checked').value;
    this.showRecord(e.overlay.hidden ? state.mode : selected);
    const { maximum, value, goal } = progressFor(state);
    e.progress.setAttribute('aria-valuemax', String(maximum));
    e.progress.setAttribute('aria-valuenow', String(value));
    e['progress-fill'].style.width = `${value / maximum * 100}%`;
    text(e.goal, goal);
    e.progress.setAttribute('aria-valuetext', goal);
    for (const button of this.document.querySelectorAll('[data-action]')) {
      button.disabled = !this.running || (button.dataset.action === 'hold' && !state.canHold);
    }
  }

  /** Bascule la préférence locale sans contredire une interdiction du portail. */
  toggleSound() {
    if (!this.audio.enabled && !this.kit.isSoundEnabled()) {
      this.notify('Le son est désactivé dans les préférences du portail.');
      return;
    }
    const enabled = !this.audio.enabled;
    if (!this.audio.setEnabled(enabled) && enabled) {
      this.notify('La synthèse audio est indisponible dans ce navigateur.');
    }
    this.updateSoundButton();
    this.audio.play('rotate');
  }

  /** Reflète la préférence audio avec aria-pressed. */
  updateSoundButton() {
    this.elements.sound.setAttribute('aria-pressed', String(this.audio.enabled));
    text(this.elements.sound, this.audio.enabled ? 'Son : oui' : 'Son : non');
  }

  /**
   * @param {string} message - Problème non bloquant à rendre visible.
   */
  notify(message) {
    this.elements['storage-notice'].hidden = false;
    text(this.elements['storage-notice'], message);
  }

  /** Annule la boucle, les entrées, les hooks globaux et les ressources audio. */
  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    this.running = false;
    this.stopLoop();
    this.abort.abort();
    this.audio.dispose();
    for (const [name, hook] of Object.entries(this.hooks)) {
      if (this.window[name] === hook) { this.window[name] = this.previousHooks[name]; }
    }
  }
}
