/**
 * Contrôleur de la page du Démineur.
 *
 * Il relie le DOM au moteur (règles), au solveur (indice, probabilités) et au
 * bot (« Regarder l'IA jouer »). Il garde pour lui ce qui n'appartient pas aux
 * règles : chronomètre, animations, mode drapeau, préférences d'affichage.
 * Toutes les dépendances sont injectables : les tests jsdom pilotent la vraie page.
 */
import { MinesweeperEngine, LEVELS, STATUS } from './engine.js';
import { SolverBot } from './bots/solver.js';
import { adviseMove, analyze } from './solver/solver.js';
import { SeededRandom } from '../../lib/seeded-random.js';
import { createBoardNavigation } from '../board-navigation.js';
import { observeDialog } from '../dialog-accessibility.js';
import { boardLayout, createBoard, renderBoard } from './ui/board-view.js';
import { bindCellInput, resolveIntent } from './ui/cell-input.js';
import { Clock, formatTime } from './ui/clock.js';
import { MinesweeperRecords } from './ui/records.js';

const PLAYER = 'joueur';
/** Délai entre deux coups de l'IA : assez lent pour lire l'explication. */
export const AI_DELAY_MS = 650;
/** Laisse l'animation de fin se jouer avant d'ouvrir le bilan. */
const END_DELAY_MS = 900;
/** Petit délai pour afficher « Génération… » avant un calcul qui peut durer. */
const GENERATION_DELAY_MS = 30;
const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 720px)';
const IDS = [
  'board-wrap', 'levels', 'no-guess', 'new-game', 'mines-left', 'timer', 'status', 'best', 'mode-badge',
  'flag-mode', 'hint', 'risks', 'watch-ai', 'reasoning-title', 'reasoning-text', 'reasoning-because',
  'announcer', 'end-dialog', 'end-title', 'end-text', 'end-record', 'replay', 'same-grid', 'close-end',
  'board-help', 'storage-notice', 'seed-info',
];
const INTRO = 'Ouvrez une case pour commencer : le premier clic est toujours sûr et ouvre une zone.';

/**
 * Lit les réglages initiaux de l'URL (`?level=expert&seed=42&classique`) : utile pour
 * partager ou rejouer une grille précise.
 * @param {string} search - `location.search`.
 * @returns {{level: string, noGuess: boolean, seed: number|null}}
 */
export function readSettings(search) {
  const params = new URLSearchParams(search);
  const level = Object.hasOwn(LEVELS, params.get('level')) ? params.get('level') : 'beginner';
  const seed = /^\d{1,10}$/.test(params.get('seed') ?? '') ? Number(params.get('seed')) >>> 0 : null;
  return { level, noGuess: !params.has('classique'), seed };
}

export class MinesweeperController {
  /**
   * @param {{document: Document, window: Window, kit: object, engine?: MinesweeperEngine,
   *   now?: () => number, random?: () => number}} options - Dépendances (horloge et hasard injectables).
   */
  constructor({ document, window, kit, engine = new MinesweeperEngine(), now, random }) {
    Object.assign(this, { document, window, kit, engine });
    // Seule la seed d'une nouvelle partie est tirée au hasard : tout le reste en découle.
    this.random = random ?? Math.random;
    this.clock = new Clock(now ?? (() => window.performance.now()));
    this.els = {};
    for (const id of IDS) {
      const element = document.getElementById(id);
      if (!element) { throw new Error(`Élément manquant dans la page : #${id}`); }
      this.els[id] = element;
    }
    this.kit.init('demineur');
    this.records = new MinesweeperRecords(kit, message => this.notify(message));
    this.bot = new SolverBot();
    this.abort = new window.AbortController();
    this.portrait = window.matchMedia(PORTRAIT_QUERY);
    Object.assign(this, { flagMode: false, showRisks: false, paused: false, busy: false, aiRunning: false });
    const settings = readSettings(window.location.search);
    this.applySettings(settings);
    this.bindEvents();
    this.newGame(settings.seed);
    this.clockTimer = window.setInterval(() => this.renderTime(), 250);
  }

  // --- Cycle de partie -------------------------------------------------------

  /**
   * Démarre une partie avec les réglages affichés.
   * @param {number|null} [seed] - Seed imposée (sinon tirée au hasard).
   */
  newGame(seed = null) {
    this.stopAI();
    this.cancelPending();
    this.closeEnd();
    this.seed = seed ?? Math.floor(this.random() * 2 ** 32) >>> 0;
    this.botRng = new SeededRandom(this.seed ^ 0x9e3779b9);
    this.state = this.engine.init({ seed: this.seed, level: this.level, noGuess: this.noGuess, playerIds: [PLAYER] });
    Object.assign(this, { assisted: false, replayed: false, advice: null, origin: null, firstIndex: null, busy: false });
    this.clock.reset();
    this.buildBoard();
    this.explain({ title: 'Raisonnement', text: INTRO });
    this.els['seed-info'].textContent = `Grille n° ${this.seed} · ${LEVELS[this.level].label}`
      + ` · ${this.noGuess ? 'sans hasard' : 'classique'}`;
    this.render();
  }

  /** Rejoue la même grille : même seed et même premier clic (le temps ne compte pas pour un record). */
  replaySameGrid() {
    const { firstIndex } = this;
    this.newGame(this.seed);
    this.replayed = true;
    if (firstIndex !== null) { this.play({ type: 'reveal', index: firstIndex }); }
  }

  /**
   * Joue une action du joueur ou de l'IA.
   * @param {{type: string, index: number}} action - Action du moteur.
   * @returns {boolean} Action appliquée.
   */
  play(action) {
    if (this.paused || this.busy || !this.engine.isValidAction(this.state, action, PLAYER)) { return false; }
    if (this.state.status === STATUS.READY && action.type === 'reveal') {
      this.startGeneration(action);
      return true;
    }
    this.commit(action);
    return true;
  }

  /**
   * Premier clic : la génération sans hasard peut prendre quelques dixièmes de seconde.
   * @param {{type: string, index: number}} action - Premier « reveal ».
   */
  startGeneration(action) {
    this.busy = true;
    this.els.status.textContent = this.noGuess ? 'Génération d\'une grille sans hasard…' : 'Génération…';
    this.later(() => {
      this.busy = false;
      this.firstIndex = action.index;
      // Le chronomètre démarre avant le coup : une cascade peut gagner dès le premier clic.
      this.clock.start();
      this.commit(action);
      if (this.state.generation && this.noGuess && !this.state.generation.guaranteed) {
        this.notify('Aucune grille sans hasard trouvée à temps : celle-ci peut demander un pari.');
      }
    }, GENERATION_DELAY_MS);
  }

  /**
   * Applique une action validée puis met la page à jour.
   * @param {{type: string, index: number}} action - Action valide.
   */
  commit(action) {
    this.state = this.engine.applyAction(this.state, action, PLAYER);
    this.origin = action.index;
    this.advice = null;
    this.render();
    if (this.engine.isGameOver(this.state)) { this.finish(); }
  }

  /** Fin de partie : chronomètre arrêté, record éventuel, bilan après l'animation. */
  finish() {
    this.clock.pause();
    this.stopAI();
    const won = this.state.status === STATUS.WON;
    const time = this.clock.elapsed();
    const assisted = this.assisted || this.replayed;
    const record = won ? this.records.submit({ level: this.level, noGuess: this.noGuess, time, assisted }) : null;
    this.announce(won ? `Gagné en ${formatTime(time, { tenths: true })} !` : 'Boum ! Une mine a explosé.');
    this.render();
    this.later(() => this.showEnd({ won, time, assisted, record }), END_DELAY_MS);
  }

  // --- Interactions ---------------------------------------------------------

  /**
   * Intention venue d'une case (clic, appui long, clavier).
   * @param {'primary'|'flag'|'chord'} intent - Intention.
   * @param {number} index - Case.
   */
  onIntent(intent, index) {
    this.stopAI();
    if (!this.acceptsInput()) { return; }
    const cell = this.view().cells[index];
    const result = resolveIntent(intent, cell, { flagMode: this.flagMode, ready: this.state.status === STATUS.READY });
    if (result?.message) { this.announce(result.message); }
    if (!result?.type) { return; }
    const played = this.play({ type: result.type, index });
    if (!played && intent === 'chord') { this.announce('Accord impossible : il faut autant de drapeaux autour que le chiffre l\'indique.'); }
  }

  /** @returns {boolean} La grille accepte un coup (partie en cours, ni pause ni génération). */
  acceptsInput() {
    return !this.engine.isGameOver(this.state) && !this.busy && !this.paused;
  }

  /** Indice : met en évidence le meilleur coup et explique pourquoi. */
  showHint() {
    if (this.engine.isGameOver(this.state) || this.busy) { return; }
    this.stopAI();
    this.assisted = this.assisted || this.state.status !== STATUS.READY;
    this.advice = adviseMove(this.view(), { label: this.layout.label });
    this.explainAdvice(this.advice, 'Indice');
    this.render();
  }

  /** Un coup de l'IA, avec son explication ; se reprogramme tant que l'IA joue. */
  aiStep() {
    if (!this.aiRunning) { return; }
    if (this.paused || this.busy) {
      this.later(() => this.aiStep(), AI_DELAY_MS);
      return;
    }
    const decision = this.bot.decide(this.view(), this.botRng, { label: this.layout.label });
    this.explainAdvice(decision, 'L\'IA joue');
    this.play(decision.action);
    this.advice = this.engine.isGameOver(this.state) ? null : decision;
    this.render();
    if (this.aiRunning) { this.later(() => this.aiStep(), AI_DELAY_MS); }
  }

  /** Lance ou arrête « Regarder l'IA jouer ». */
  toggleAI() {
    if (this.aiRunning) { this.stopAI(); return; }
    if (this.engine.isGameOver(this.state)) { return; }
    this.aiRunning = true;
    this.assisted = true;
    this.updateToggles();
    this.aiStep();
  }

  /** Affiche ou masque la carte des probabilités, en expliquant ce qu'elle montre. */
  toggleRisks() {
    this.showRisks = !this.showRisks;
    if (this.showRisks) {
      this.explain({
        title: 'Carte des probabilités',
        text: 'Chaque case fermée prend la couleur de son risque de cacher une mine, du vert (sûre) au rouge (mine). '
          + 'Le solveur énumère toutes les façons de placer les mines autour des chiffres, pondérées par le nombre '
          + 'de mines restantes : 0 % signale une case prouvée sûre.',
      });
    }
    this.render();
  }

  /** Arrête l'IA sans toucher à la partie. */
  stopAI() {
    if (!this.aiRunning) { return; }
    this.aiRunning = false;
    this.updateToggles();
  }

  // --- Affichage --------------------------------------------------------------

  /** @returns {import('./engine.js').MinesweeperView} Vue du joueur. */
  view() {
    return this.engine.getPlayerView(this.state, PLAYER);
  }

  /** (Re)construit la grille : nouvelle partie ou changement d'orientation. */
  buildBoard() {
    const { width, height } = this.state;
    this.layout = boardLayout(width, height, width > height && this.portrait.matches);
    const { element, buttons } = createBoard(this.document, this.layout);
    element.setAttribute('aria-label', `Grille de ${this.layout.columns} colonnes et ${this.layout.rows} lignes, `
      + `${this.state.mineCount} mines`);
    element.setAttribute('aria-describedby', 'board-help');
    element.classList.toggle('transposed', this.layout.transposed);
    this.els['board-wrap'].replaceChildren(element);
    this.board = element;
    this.buttons = buttons;
    this.navigation = createBoardNavigation(element, this.layout.columns);
  }

  /** Met toute la page en accord avec l'état. */
  render() {
    const view = this.view();
    const risks = this.showRisks && view.status === STATUS.PLAYING ? analyze(view).probabilities : null;
    this.navigation.beforeRender();
    renderBoard(this.buttons, this.layout, view, {
      risks, hint: this.advice ? this.advice.index : null, origin: this.origin, sources: this.adviceSources(),
    });
    this.navigation.afterRender();
    this.board.classList.toggle('flag-mode', this.flagMode);
    this.board.dataset.status = view.status;
    this.renderHud(view);
    this.renderTime();
    this.updateToggles();
  }

  /** @returns {number[]} Chiffres qui justifient le conseil affiché (mis en évidence). */
  adviceSources() {
    const step = this.advice?.step;
    if (!step) { return []; }
    return [step.self, step.other].filter(Boolean).map(constraint => constraint.origin);
  }

  /** @param {import('./engine.js').MinesweeperView} view - Compteur, statut, record et mode. */
  renderHud(view) {
    // Victoire : toutes les mines sont affichées en drapeaux, le compteur tombe à zéro.
    this.els['mines-left'].textContent = String(view.status === STATUS.WON ? 0 : view.minesLeft);
    this.els.status.textContent = this.statusText(view);
    const best = this.records.best(this.level, this.noGuess);
    this.els.best.textContent = best === null ? 'Record : —' : `Record : ${formatTime(best, { tenths: true })}`;
    this.els['mode-badge'].textContent = this.noGuess ? 'Sans hasard' : 'Classique';
  }

  /**
   * @param {import('./engine.js').MinesweeperView} view - Vue.
   * @returns {string} Phrase d'état sous le compteur.
   */
  statusText(view) {
    if (this.paused) { return 'Partie en pause'; }
    if (view.status === STATUS.WON) { return `Gagné en ${formatTime(this.clock.elapsed(), { tenths: true })}`; }
    if (view.status === STATUS.LOST) { return 'Boum ! Une mine a explosé.'; }
    if (view.status === STATUS.READY) { return 'Premier clic sans risque'; }
    return `${view.openedCount} / ${view.safeCount} cases ouvertes`;
  }

  /** Chronomètre affiché. */
  renderTime() {
    const text = formatTime(this.clock.elapsed());
    if (this.els.timer.textContent !== text) { this.els.timer.textContent = text; }
  }

  /** Boutons bascules et disponibilité des aides. */
  updateToggles() {
    const over = this.engine.isGameOver(this.state);
    const set = (id, pressed) => this.els[id].setAttribute('aria-pressed', String(pressed));
    set('flag-mode', this.flagMode);
    set('risks', this.showRisks);
    set('watch-ai', this.aiRunning);
    this.els['watch-ai'].querySelector('.label').textContent = this.aiRunning ? 'Arrêter l\'IA' : 'Regarder l\'IA';
    for (const id of ['hint', 'watch-ai']) { this.els[id].disabled = over; }
    this.els['board-wrap'].classList.toggle('paused', this.paused);
  }

  /**
   * Affiche un conseil dans le panneau « Raisonnement ».
   * @param {import('./solver/solver.js').Advice} advice - Conseil du solveur.
   * @param {string} title - Origine (« Indice » ou « L'IA joue »).
   */
  explainAdvice(advice, title) {
    const verbs = { reveal: 'ouvrir', toggleFlag: advice.kind === 'fix-flag' ? 'retirer le drapeau en' : 'drapeau en' };
    const target = `${verbs[advice.action.type]} ${this.layout.label(advice.index)}`;
    this.explain({ title: `${title} : ${target}`, text: advice.reason, because: advice.because });
  }

  /**
   * @param {{title: string, text: string, because?: string[]}} content - Texte du panneau.
   */
  explain({ title, text, because = [] }) {
    this.els['reasoning-title'].textContent = title;
    this.els['reasoning-text'].textContent = text;
    const items = because.map(reason => {
      const item = this.document.createElement('li');
      item.textContent = reason;
      return item;
    });
    this.els['reasoning-because'].replaceChildren(...items);
    this.els['reasoning-because'].hidden = items.length === 0;
  }

  /** @param {string} message - Annonce brève pour les lecteurs d'écran (et visible dans le statut). */
  announce(message) {
    this.els.announcer.textContent = message;
  }

  /** @param {string} message - Problème de stockage ou de génération, visible en bas de page. */
  notify(message) {
    this.els['storage-notice'].textContent = message;
    this.els['storage-notice'].hidden = false;
  }

  /**
   * Bilan de fin de partie.
   * @param {{won: boolean, time: number, assisted: boolean, record: {record: boolean, previous: number|null}|null}} result - Résultat.
   */
  showEnd({ won, time, assisted, record }) {
    const level = LEVELS[this.level].label;
    this.els['end-title'].textContent = won ? 'Grille déminée !' : 'Boum !';
    this.els['end-text'].textContent = won
      ? `${level} terminé en ${formatTime(time, { tenths: true })}.`
      : `Une mine a explosé après ${formatTime(time, { tenths: true })}. Les mines et les drapeaux erronés sont dévoilés.`;
    this.els['end-record'].textContent = this.recordText(won, assisted, record);
    this.els['end-dialog'].classList.add('open');
    this.els['end-dialog'].dataset.result = won ? 'won' : 'lost';
  }

  /**
   * @param {boolean} won - Victoire.
   * @param {boolean} assisted - Indice, IA ou grille rejouée.
   * @param {{record: boolean, previous: number|null}|null} record - Bilan du record.
   * @returns {string}
   */
  recordText(won, assisted, record) {
    if (!won) { return 'Astuce : « Indice » explique le raisonnement, et « Rejouer cette grille » permet de réessayer.'; }
    if (assisted) { return 'Partie assistée (indice, IA ou grille rejouée) : le temps n\'est pas enregistré.'; }
    if (record.previous === null) { return 'Premier record pour ce niveau !'; }
    return record.record ? `Nouveau record ! L'ancien était de ${formatTime(record.previous, { tenths: true })}.`
      : `Record à battre : ${formatTime(record.previous, { tenths: true })}.`;
  }

  /** Ferme le bilan (Échap, bouton ou nouvelle partie). */
  closeEnd() {
    this.els['end-dialog'].classList.remove('open');
  }

  // --- Événements -----------------------------------------------------------

  /** @param {{level: string, noGuess: boolean}} settings - Réglages à afficher et retenir. */
  applySettings({ level, noGuess }) {
    this.level = level;
    this.noGuess = noGuess;
    const radio = this.els.levels.querySelector(`input[value="${level}"]`);
    if (radio) { radio.checked = true; }
    this.els['no-guess'].checked = noGuess;
  }

  /** Branche tous les écouteurs (retirés ensemble par `dispose`). */
  bindEvents() {
    const { signal } = this.abort;
    const on = (element, type, handler) => element.addEventListener(type, handler, { signal });
    this.input = bindCellInput(this.els['board-wrap'], { window: this.window, signal, onIntent: (intent, index) => this.onIntent(intent, index) });
    on(this.els['board-wrap'], 'keydown', event => this.onBoardKey(event));
    on(this.els.levels, 'change', () => this.onSettingsChange());
    on(this.els['no-guess'], 'change', () => this.onSettingsChange());
    on(this.els['new-game'], 'click', () => this.newGame());
    on(this.els.replay, 'click', () => this.newGame());
    on(this.els['same-grid'], 'click', () => this.replaySameGrid());
    on(this.els['close-end'], 'click', () => this.closeEnd());
    on(this.els.hint, 'click', () => this.showHint());
    on(this.els['watch-ai'], 'click', () => this.toggleAI());
    on(this.els['flag-mode'], 'click', () => { this.flagMode = !this.flagMode; this.render(); });
    on(this.els.risks, 'click', () => this.toggleRisks());
    on(this.portrait, 'change', () => { this.buildBoard(); this.render(); });
    on(this.window, 'blur', () => this.input.cancel());
    this.stopDialog = observeDialog(this.els['end-dialog'], { openClass: 'open', onClose: () => this.closeEnd() });
    Object.assign(this.window, {
      onGamePause: () => this.setPaused(true),
      onGameResume: () => this.setPaused(false),
      onGameDispose: () => this.dispose(),
    });
  }

  /** @param {KeyboardEvent} event - Touche pressée sur une case (H : indice). */
  onBoardKey(event) {
    if ((event.key === 'h' || event.key === 'H') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.showHint();
    }
  }

  /** Niveau ou mode changé : nouvelle partie immédiate. */
  onSettingsChange() {
    const checked = this.els.levels.querySelector('input:checked');
    this.applySettings({ level: checked ? checked.value : this.level, noGuess: this.els['no-guess'].checked });
    this.newGame();
  }

  /**
   * Pause du portail ou onglet masqué : le temps s'arrête et la grille est voilée.
   * La reprise est automatique : rien ne bouge seul dans un démineur.
   * @param {boolean} paused - Pause demandée.
   */
  setPaused(paused) {
    this.paused = paused;
    this.input.cancel();
    const running = this.state.status === STATUS.PLAYING;
    if (paused) { this.clock.pause(); } else if (running) { this.clock.start(); }
    this.render();
  }

  /**
   * Action différée liée à la partie en cours : une nouvelle partie ou le démontage
   * l'annulent (génération, coup de l'IA, bilan de fin).
   * @param {() => void} callback - Action différée.
   * @param {number} delay - Délai en millisecondes.
   */
  later(callback, delay) {
    const { signal } = this.round;
    this.window.setTimeout(() => { if (!signal.aborted) { callback(); } }, delay);
  }

  /** Annule les actions différées de la partie en cours. */
  cancelPending() {
    this.round?.abort();
    this.round = new this.window.AbortController();
  }

  /** Démontage (message `unload` du portail) : écouteurs et minuteries libérés. */
  dispose() {
    this.stopAI();
    this.cancelPending();
    this.window.clearInterval(this.clockTimer);
    this.input.cancel();
    this.abort.abort();
    this.stopDialog();
  }
}
