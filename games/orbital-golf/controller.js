/**
 * Client du golf orbital : machine d'états, animation du vol, interface et GameKit.
 *
 * Le moteur résout chaque coup d'un bloc ; le client rejoue ensuite la même
 * simulation pour l'animer. Pause et reprise sont donc triviales : l'état final
 * est déjà connu, seule l'horloge d'animation s'arrête.
 *
 * Phases : `menu` → `aiming` ⇄ `flying` → `holed` (bilan du trou) → `finished`.
 * La pause et les dialogues figent l'animation sans changer de phase.
 */
import { OrbitalGolfEngine, dailySeed } from './engine.js';
import { simulateShot } from './engine/physics.js';
import { cardTotals, formatToPar, holeLabel } from './engine/scoring.js';
import { GolfSound } from './audio.js';
import { PointerAim, aimFromKey, aimToward, formatAngle, nudgeAim } from './input.js';
import { GolfRecords } from './records.js';
import { GolfRenderer } from './renderer.js';
import { Burst, Trail } from './renderer-effects.js';

const PLAYER = 'joueur';
/** Vitesse de lecture du vol : ×2 par défaut, ×4 sur demande. */
const NORMAL_SPEED = 2;
const FAST_SPEED = 4;
/** Un échantillon de vol tous les 2 pas physiques (120 par seconde simulée). */
const FLIGHT_SAMPLING = 2;
/** Un point d'aperçu toutes les 0,05 s (12 pas). */
const PREVIEW_SAMPLING = 12;
const TOAST_MS = 1200;

const MODE_NAMES = { course: 'Initiation', daily: 'Trou du jour', free: 'Parcours libre' };
const OUTCOMES = {
  out: 'Hors limites : le coup compte, la balle revient au point de tir.',
  swallowed: 'Avalée par le trou noir : le coup compte, la balle revient au point de tir.',
  lost: 'Perdue en orbite : le coup compte, la balle revient au point de tir.',
  rest: 'Balle arrêtée : rejoue d’ici.',
  holed: 'Dans le trou !',
};
const PANELS = ['panel-menu', 'panel-pause', 'panel-result', 'panel-final'];
const ELEMENT_IDS = [
  'app', 'field', 'hud-hole', 'hud-par', 'hud-strokes', 'hud-total', 'readout', 'toast', 'busy', 'status', 'storage-notice',
  ...PANELS, 'btn-menu', 'btn-pause', 'btn-help', 'btn-sound', 'btn-restart', 'btn-shoot', 'btn-start', 'btn-continue',
  'btn-resume', 'btn-next', 'btn-replay', 'btn-final-menu', 'btn-hint', 'btn-help-close', 'btn-restart-cancel',
  'btn-restart-confirm', 'help-dialog', 'restart-dialog', 'seed-input', 'confirm-shot', 'result-title', 'result-detail',
  'final-title', 'final-detail', 'final-card', 'card', 'records', 'quit',
];

/**
 * Date locale « AAAA-MM-JJ » : le trou du jour suit le calendrier de l'appareil.
 * @param {Date} date - Instant.
 * @returns {string} Date locale.
 */
export function localDate(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * @param {string} text - Saisie de l'utilisateur.
 * @returns {number|null} Graine entière 32 bits, ou null si la saisie est vide ou invalide.
 */
export function parseSeed(text) {
  const trimmed = text.trim();
  if (!/^\d{1,10}$/.test(trimmed)) { return null; }
  const value = Number(trimmed);
  return value <= 0xffffffff ? value : null;
}

/** Contrôleur d'une page de jeu ; toutes les dépendances sont injectables pour les tests. */
export class GolfController {
  /**
   * @param {{document: Document, window: Window, kit: object, engine?: object, renderer?: object,
   *   sound?: object, now?: () => Date}} options - Dépendances.
   */
  constructor({ document, window, kit, engine = new OrbitalGolfEngine(), renderer, sound, now = () => new Date() }) {
    this.document = document;
    this.window = window;
    this.kit = kit;
    this.engine = engine;
    this.now = now;
    this.ui = Object.fromEntries(ELEMENT_IDS.map(id => [id, this.require(id)]));
    this.renderer = renderer ?? new GolfRenderer(this.ui.field, window);
    this.sound = sound ?? new GolfSound(window, message => this.notice(message));
    kit.init('orbital-golf');
    this.records = new GolfRecords(kit, message => this.notice(message));
    this.phase = 'menu';
    this.paused = false;
    this.timers = new Set();
    this.trail = new Trail();
    this.burst = new Burst();
    this.frameId = null;
    this.paintFrame = null;
    this.abort = new window.AbortController();
    this.reducedMotion = this.media('(prefers-reduced-motion: reduce)');
    this.ui.app.dataset.motion = this.reducedMotion ? 'reduced' : 'full';
    this.ui['confirm-shot'].checked = this.media('(pointer: coarse)');
    this.assisted = false;
    this.commands = new Map([
      ['Enter', { run: () => this.shoot() }],
      [' ', { run: () => (this.phase === 'flying' ? this.hurry() : this.shoot()) }],
      ['Escape', { run: () => this.pointer.abort(), global: true }],
      ['p', { run: () => this.togglePause(), global: true }],
      ['r', { run: () => this.requestRestart(), global: true }],
      ['?', { run: () => this.openHelp(), global: true }],
      ['s', { run: () => this.toggleSound(), global: true }],
      ['h', { run: () => this.showHint(), global: true }],
    ]);
    // Décor du menu : le premier trou d'initiation, sans partie commencée.
    this.state = engine.init({ seed: 0, playerIds: [PLAYER] });
    this.bind();
    this.renderRecords();
    this.resize();
  }

  /** @param {string} id - Identifiant. @returns {HTMLElement} Élément obligatoire de la page. */
  require(id) {
    const element = this.document.getElementById(id);
    if (element === null) { throw new Error(`Golf orbital : l’élément #${id} est absent de la page.`); }
    return element;
  }

  /** @param {string} query - Media query. @returns {boolean} Vrai si elle s'applique. */
  media(query) {
    return Boolean(this.window.matchMedia?.(query).matches);
  }

  /**
   * @param {EventTarget} target - Émetteur.
   * @param {string} type - Événement.
   * @param {(event: Event) => void} listener - Callback retiré au démontage.
   */
  on(target, type, listener) {
    target.addEventListener(type, listener, { signal: this.abort.signal });
  }

  /** Relie boutons, clavier, pointeurs, cycle de vie et GameKit. */
  bind() {
    const { ui } = this;
    const clicks = {
      'btn-menu': () => this.openMenu(), 'btn-pause': () => this.pause(), 'btn-help': () => this.openHelp(),
      'btn-sound': () => this.toggleSound(), 'btn-restart': () => this.requestRestart(), 'btn-shoot': () => this.shoot(),
      'btn-start': () => this.start(this.selectedMode()), 'btn-continue': () => this.closeMenu(),
      'btn-resume': () => this.resume(), 'btn-next': () => this.nextHole(), 'btn-replay': () => this.start(this.state.mode),
      'btn-final-menu': () => this.openMenu(), 'btn-hint': () => this.showHint(), 'btn-help-close': () => ui['help-dialog'].close(),
      'btn-restart-cancel': () => ui['restart-dialog'].close(), 'btn-restart-confirm': () => this.restartHole(),
    };
    for (const [id, action] of Object.entries(clicks)) { this.on(ui[id], 'click', action); }
    this.nudges = [...this.document.querySelectorAll('[data-nudge]')];
    for (const button of this.nudges) {
      this.on(button, 'click', () => this.nudge(button.dataset.nudge, Number(button.dataset.step)));
    }
    this.on(ui.quit, 'click', event => this.quit(event));
    this.on(this.document, 'keydown', event => this.keyDown(event));
    this.bindField();
    this.bindLifecycle();
  }

  /** Lance-pierre sur le canvas ; pendant un vol, une pression accélère l'animation. */
  bindField() {
    this.pointer = new PointerAim(this.ui.field, {
      enabled: () => this.phase === 'aiming' && !this.frozen(),
      onAim: aim => this.setAim(aim ?? this.aim, false),
      onRelease: aim => this.release(aim),
      onCancel: () => this.cancelAim(),
    }, this.abort.signal);
    this.on(this.ui.field, 'pointerdown', () => this.hurry());
  }

  /** Pause automatique, thème, taille du canvas et points d'accroche GameKit. */
  bindLifecycle() {
    const { window } = this;
    this.on(window, 'blur', () => this.pause());
    this.on(this.document, 'visibilitychange', () => { if (this.document.hidden) { this.pause(); } });
    // Page mise en cache avant/arrière (persisted) : elle peut revenir, on la fige sans la démonter.
    this.on(window, 'pagehide', event => (event.persisted ? this.pause() : this.dispose()));
    for (const dialog of [this.ui['help-dialog'], this.ui['restart-dialog']]) {
      this.on(dialog, 'close', () => this.wake());
    }
    this.on(window, 'themechange', () => { this.renderer.refreshPalette(); this.draw(); });
    this.on(window, 'resize', () => this.resize());
    this.resizer = window.ResizeObserver ? new window.ResizeObserver(() => this.resize()) : null;
    this.resizer?.observe(this.ui.field);
    const hooks = {
      onGamePause: () => this.pause(),
      onGameResume: () => {}, // Reprise volontaire : le joueur relance lui-même la partie.
      onGameDispose: () => this.dispose(),
      onSoundChange: enabled => { if (!enabled) { this.setSound(false); } },
    };
    this.savedHooks = Object.keys(hooks).map(name => [name, window[name]]);
    Object.assign(window, hooks);
  }

  /** @param {MouseEvent} event - Dans le portail, le retour passe par GameKit. */
  quit(event) {
    if (this.window.parent === this.window) { return; }
    event.preventDefault();
    this.kit.quit();
  }

  /** @returns {string} Mode coché dans le menu. */
  selectedMode() {
    return this.document.querySelector('input[name="mode"]:checked')?.value ?? 'course';
  }

  /**
   * Configuration du moteur ; la date et la graine aléatoire viennent du client.
   * @param {string} mode - Mode choisi.
   * @returns {object} Configuration valide.
   */
  configFor(mode) {
    if (mode === 'daily') {
      const date = localDate(this.now());
      return { mode, date, seed: dailySeed(date), playerIds: [PLAYER] };
    }
    if (mode === 'free') { return { mode, seed: this.freeSeed(), playerIds: [PLAYER] }; }
    return { mode: 'course', seed: 0, playerIds: [PLAYER] };
  }

  /** @returns {number} Graine saisie, ou tirée au hasard puis affichée pour être rejouée. */
  freeSeed() {
    const typed = parseSeed(this.ui['seed-input'].value);
    if (typed !== null) { return typed; }
    const random = new Uint32Array(1);
    this.window.crypto.getRandomValues(random);
    return random[0];
  }

  /**
   * Démarre une partie. Générer un trou peut figer la page jusqu'à deux secondes
   * sur un téléphone lent : un bandeau visible est peint avant le calcul.
   * @param {string} mode - Mode de jeu.
   */
  start(mode) {
    const config = this.configFor(mode);
    if (mode === 'free') { this.ui['seed-input'].value = String(config.seed); }
    this.hidePanels();
    const begin = () => {
      this.state = this.engine.init(config);
      this.assisted = false;
      this.paused = false;
      this.enterHole();
    };
    if (mode === 'course') {
      this.announce('Parcours d’initiation.');
      this.later(begin, 0);
      return;
    }
    this.prepare('Préparation du trou…', begin);
  }

  /**
   * Affiche le bandeau de préparation, laisse le navigateur le peindre
   * (une image puis une tâche), puis lance le calcul bloquant.
   * @param {string} message - Texte affiché et annoncé.
   * @param {() => void} compute - Génération du trou.
   */
  prepare(message, compute) {
    const { busy, app } = this.ui;
    busy.textContent = message;
    busy.hidden = false;
    app.dataset.phase = 'loading';
    this.announce(message);
    if (this.paintFrame !== null) { this.window.cancelAnimationFrame(this.paintFrame); }
    this.paintFrame = this.window.requestAnimationFrame(() => {
      this.paintFrame = null;
      this.later(() => {
        compute();
        busy.hidden = true;
      }, 0);
    });
  }

  /** Visée d'un nouveau trou : vers le trou, scène figée à t = 0. */
  enterHole() {
    const hole = this.hole();
    this.phase = 'aiming';
    this.hint = null;
    this.trail.clear();
    this.setAim(aimToward(this.state.ball, hole.hole), false);
    this.ui['btn-pause'].disabled = false;
    this.ui.field.focus({ preventScroll: true });
    this.announce(`${hole.name}, par ${hole.par}. ${hole.lesson ?? ''}`.trim());
    this.renderHud();
  }

  /** @returns {object} Trou courant. */
  hole() {
    return this.state.course[this.state.holeIndex];
  }

  /**
   * Change la visée, recalcule l'aperçu et l'affichage.
   * @param {{angle:number, power:number}} aim - Visée bornée.
   * @param {boolean} speak - Annonce vocale (clavier et boutons, pas le glissé continu).
   */
  setAim(aim, speak) {
    this.aim = aim;
    this.preview = this.computePreview();
    const label = `Angle ${formatAngle(aim.angle)} · ${aim.power} %`;
    this.ui.readout.textContent = this.preview ? label : `${label} · vers la surface`;
    if (speak) { this.announce(this.ui.readout.textContent); }
    this.draw();
  }

  /** @returns {{points:number[][], impact:{x:number,y:number}|null}|null} Aperçu, ou null si le tir est refusé. */
  computePreview() {
    const action = { type: 'shoot', ...this.aim };
    if (!this.engine.isValidAction(this.state, action, PLAYER)) { return null; }
    const hole = this.hole();
    const points = [];
    const result = simulateShot(hole, this.state.ball, this.aim.angle, this.aim.power, this.state.levelTime, {
      preview: hole.previewSeconds, sampleEvery: PREVIEW_SAMPLING, onSample: (x, y) => points.push([x, y]),
    });
    return { points, impact: result.outcome === 'contact' ? { x: result.x, y: result.y } : null };
  }

  /** @param {{angle:number, power:number}} aim - Relâcher du glissé : tir, ou visée gardée à confirmer. */
  release(aim) {
    this.setAim(aim, true);
    if (!this.ui['confirm-shot'].checked) { this.shoot(); }
  }

  cancelAim() {
    this.announce('Tir annulé.');
    this.draw();
  }

  /**
   * @param {'angle'|'power'} field - Grandeur ajustée.
   * @param {number} step - Pas signé.
   */
  nudge(field, step) {
    if (this.phase === 'aiming' && !this.frozen()) { this.setAim(nudgeAim(this.aim, field, step), true); }
  }

  /** Joue la visée courante ; le vol est animé à partir du résultat déjà calculé. */
  shoot() {
    if (this.phase !== 'aiming' || this.frozen()) { return; }
    const action = { type: 'shoot', angle: this.aim.angle, power: this.aim.power };
    if (!this.engine.isValidAction(this.state, action, PLAYER)) {
      this.announce('Ce tir partirait dans la planète : vise vers l’extérieur.');
      return;
    }
    const hole = this.hole();
    this.state = this.engine.applyAction(this.state, action, PLAYER);
    this.flight = this.recordFlight(hole, this.state.lastShot);
    this.phase = 'flying';
    this.hint = null;
    this.trail.clear();
    this.sound.play('shoot');
    this.renderHud();
    this.loop();
  }

  /**
   * Rejoue le coup pour l'animation : mêmes entrées, même trajectoire que le moteur.
   * @param {object} hole - Trou du coup.
   * @param {object} shot - `lastShot` du moteur.
   * @returns {{hole:object, shot:object, samples:object[], index:number, clock:number, speed:number}} Vol à animer.
   */
  recordFlight(hole, shot) {
    const samples = [];
    simulateShot(hole, shot.from, shot.angle, shot.power, shot.t0, {
      sampleEvery: FLIGHT_SAMPLING,
      onSample: (x, y, t, bounced) => samples.push({ x, y, t: t - shot.t0, bounced }),
    });
    return { hole, shot, samples, index: 0, clock: 0, speed: this.reducedMotion ? FAST_SPEED : NORMAL_SPEED };
  }

  /** Pendant un vol, une pression ou Espace passe l'animation à ×4. */
  hurry() {
    if (this.phase === 'flying') { this.flight.speed = FAST_SPEED; }
  }

  /** Planifie une image si une animation est en cours. */
  loop() {
    if (this.frameId !== null) { return; }
    this.lastFrame = null;
    this.frameId = this.window.requestAnimationFrame(time => this.tick(time));
  }

  /** @param {number} time - Horodatage de la frame, en ms. */
  tick(time) {
    this.frameId = null;
    const seconds = this.lastFrame === null ? 0 : Math.min(0.1, (time - this.lastFrame) / 1000);
    this.lastFrame = time;
    if (!this.frozen()) { this.advance(seconds); }
    this.draw();
    // Figée (pause, dialogue), la boucle s'arrête ; resume() et wake() la relancent.
    if (this.animating() && !this.frozen()) {
      this.frameId = this.window.requestAnimationFrame(next => this.tick(next));
    }
  }

  /** @returns {boolean} Un vol ou une gerbe est encore à animer. */
  animating() {
    return this.phase === 'flying' || this.burst.alive;
  }

  /** @param {number} seconds - Temps réel écoulé depuis la frame précédente. */
  advance(seconds) {
    this.burst.update(seconds);
    if (this.phase !== 'flying') { return; }
    const flight = this.flight;
    flight.clock += seconds * flight.speed;
    while (flight.index < flight.samples.length - 1 && flight.samples[flight.index + 1].t <= flight.clock) {
      flight.index += 1;
      const sample = flight.samples[flight.index];
      if (!this.reducedMotion) { this.trail.push(sample.x, sample.y); }
      if (sample.bounced) { this.sound.play('bounce'); }
    }
    if (flight.index >= flight.samples.length - 1) { this.land(); }
  }

  /** Fin de l'animation : message, balle remise, bilan du trou ou de la partie. */
  land() {
    const { shot } = this.flight;
    this.phase = this.state.status === 'aiming' ? 'aiming' : 'holed';
    this.sound.play(shot.outcome === 'holed' ? 'holed' : 'rest');
    if (this.phase === 'aiming') {
      this.toast(OUTCOMES[shot.outcome]);
      this.setAim(this.aim, false);
      this.renderHud();
      return;
    }
    if (shot.outcome === 'holed' && !this.reducedMotion) { this.burst.start(shot.end.x, shot.end.y); }
    this.showResult();
  }

  /** Bilan du trou terminé, ou carte finale au dernier trou. */
  showResult() {
    this.renderHud();
    if (this.state.status === 'finished') {
      this.finish();
      return;
    }
    const { shot } = this.flight;
    const strokes = this.state.strokes[this.state.holeIndex];
    const label = shot.pickedUp ? 'Ramassé' : holeLabel(strokes, this.hole().par);
    this.ui['result-title'].textContent = label;
    this.ui['result-detail'].textContent = `${strokes} coup${strokes > 1 ? 's' : ''} · par ${this.hole().par} · total ${formatToPar(cardTotals(this.state).toPar)}`;
    this.showPanel('panel-result');
    this.announce(`${label}. ${this.ui['result-detail'].textContent}`);
  }

  /** Trou suivant ; en parcours libre, il est généré à la demande. */
  nextHole() {
    this.hidePanels();
    const advance = () => {
      this.state = this.engine.applyAction(this.state, { type: 'nextHole' }, PLAYER);
      this.enterHole();
    };
    if (this.state.mode === 'free') {
      this.prepare('Préparation du trou suivant…', advance);
      return;
    }
    this.later(advance, 0);
  }

  /** Carte finale et records (une partie aidée ou recommencée n'établit pas de record). */
  finish() {
    const outcome = this.records.finish(this.state, { assisted: this.assisted });
    const totals = cardTotals(this.state);
    const seed = this.state.mode === 'free' ? ` · graine ${this.state.seed}` : '';
    this.ui['final-title'].textContent = outcome.record ? 'Nouveau record !' : 'Parcours terminé';
    this.ui['final-detail'].textContent = `${MODE_NAMES[this.state.mode]}${seed} : ${totals.strokes} coups, ${formatToPar(totals.toPar)}. ${this.recordText(outcome)}`;
    this.renderCard(this.ui['final-card']);
    this.renderRecords();
    this.ui['btn-pause'].disabled = true;
    this.phase = 'finished';
    this.showPanel('panel-final');
    this.announce(`${this.ui['final-title'].textContent} ${this.ui['final-detail'].textContent}`);
  }

  /** @param {{eligible:boolean, best:number|null}} outcome - Bilan des records. @returns {string} Explication. */
  recordText(outcome) {
    if (!outcome.eligible) { return 'Partie aidée ou recommencée : pas de record.'; }
    return `Meilleur total : ${outcome.best} coups.`;
  }

  /** Recommencer : confirmation si des coups seraient effacés. */
  requestRestart() {
    if (this.phase !== 'aiming' || this.frozen()) { return; }
    if (this.state.strokes[this.state.holeIndex] === 0) {
      this.announce('Aucun coup à effacer sur ce trou.');
      return;
    }
    this.openDialog(this.ui['restart-dialog']);
  }

  restartHole() {
    this.ui['restart-dialog'].close();
    this.state = this.engine.applyAction(this.state, { type: 'restartHole' }, PLAYER);
    this.enterHole();
  }

  /** Indice : le tir de référence, valable depuis le départ ; il retire le droit au record. */
  showHint() {
    this.ui['help-dialog'].close();
    const reference = this.phase === 'aiming' ? this.hole().reference : null;
    const fromTee = reference && this.state.strokes[this.state.holeIndex] === 0;
    if (!fromTee) {
      this.announce('L’indice n’est disponible qu’avant le premier coup d’un trou.');
      return;
    }
    this.assisted = true;
    this.hint = reference;
    this.setAim({ ...reference }, true);
  }

  /** @returns {boolean} Animation et entrées figées (pause ou dialogue ouvert). */
  frozen() {
    return this.paused || this.ui['help-dialog'].open || this.ui['restart-dialog'].open;
  }

  /** Pause : temps et animation figés, pointeur relâché ; la reprise est volontaire. */
  pause() {
    if (this.paused || !['aiming', 'flying'].includes(this.phase)) { return; }
    this.paused = true;
    this.pointer.abort();
    this.showPanel('panel-pause');
    this.ui['btn-resume'].focus({ preventScroll: true });
    this.announce('Pause.');
  }

  resume() {
    this.paused = false;
    this.hidePanels();
    this.ui.app.dataset.phase = this.phase;
    this.lastFrame = null;
    this.ui.field.focus({ preventScroll: true });
    this.announce('Reprise.');
    this.wake();
  }

  /** Touche P : met en pause, ou reprend seulement depuis le panneau Pause (pas depuis le menu). */
  togglePause() {
    if (!this.paused) {
      this.pause();
    } else if (!this.ui['panel-pause'].hidden) {
      this.resume();
    }
  }

  /** Relance l'animation interrompue par une pause ou un dialogue, si plus rien ne la fige. */
  wake() {
    if (this.animating() && !this.frozen()) { this.loop(); }
  }

  /** Menu : la partie en cours est mise en pause et peut être continuée. */
  openMenu() {
    const playing = ['aiming', 'flying', 'holed'].includes(this.phase);
    this.paused = playing;
    this.pointer.abort();
    this.ui['btn-continue'].hidden = !playing;
    this.showPanel('panel-menu');
    this.document.querySelector('input[name="mode"]:checked')?.focus({ preventScroll: true });
  }

  /** Continuer : retour au bilan du trou s'il était affiché, sinon reprise du jeu. */
  closeMenu() {
    if (this.phase !== 'holed') {
      this.resume();
      return;
    }
    this.paused = false;
    this.showPanel('panel-result');
    this.wake();
  }

  openHelp() {
    this.pointer.abort();
    this.openDialog(this.ui['help-dialog']);
  }

  /** @param {HTMLDialogElement} dialog - Dialogue modal natif : focus piégé et Échap fournis par le navigateur. */
  openDialog(dialog) {
    if (!dialog.open) { dialog.showModal(); }
  }

  /** @param {string} id - Panneau à afficher au-dessus du terrain ; les autres sont masqués. */
  showPanel(id) {
    for (const panel of PANELS) { this.ui[panel].hidden = panel !== id; }
    const shown = { 'panel-pause': 'paused', 'panel-menu': 'menu' };
    this.ui.app.dataset.phase = shown[id] ?? this.phase;
    this.ui[id].querySelector('.primary')?.focus({ preventScroll: true });
  }

  hidePanels() {
    for (const panel of PANELS) { this.ui[panel].hidden = true; }
  }

  toggleSound() {
    this.setSound(!this.sound.enabled);
  }

  /** @param {boolean} wanted - Son voulu, refusé si le portail l'a coupé. */
  setSound(wanted) {
    const enabled = this.sound.setEnabled(wanted && this.kit.isSoundEnabled());
    this.ui['btn-sound'].setAttribute('aria-pressed', String(enabled));
    this.ui['btn-sound'].setAttribute('aria-label', enabled ? 'Couper le son' : 'Activer le son');
  }

  /**
   * Clavier global ; les champs de formulaire et les boutons gardent leurs touches natives.
   * @param {KeyboardEvent} event - Touche.
   */
  keyDown(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    // Dialogue ouvert : aucune commande ; en pause, seule P (reprise) passe.
    if (this.frozen() && (key !== 'p' || !this.paused)) { return; }
    const native = event.target.closest?.('input, button, a, select, textarea, dialog');
    const command = this.commands.get(key);
    if (command && (!native || command.global)) {
      event.preventDefault();
      command.run();
      return;
    }
    this.arrowKey(event, native);
  }

  /**
   * @param {KeyboardEvent} event - Flèche éventuelle.
   * @param {Element|null} native - Contrôle natif ciblé (les flèches y gardent leur sens).
   */
  arrowKey(event, native) {
    if (native || this.phase !== 'aiming') { return; }
    const aim = aimFromKey(this.aim, event.key, event.shiftKey);
    if (aim) {
      event.preventDefault();
      this.setAim(aim, true);
    }
  }

  /** Taille du canvas, puis nouvelle image. */
  resize() {
    if (this.renderer.resize()) { this.draw(); }
  }

  /** @returns {object} Scène courante à dessiner : vol animé ou visée. */
  frame() {
    const common = { trail: this.trail.points, burst: this.burst, drift: { x: 0, y: 0 } };
    if (this.phase === 'flying') { return { ...common, ...this.flightFrame() }; }
    const scene = { ...common, hole: this.hole(), time: this.state.levelTime, ball: this.state.ball };
    if (this.phase !== 'aiming') { return scene; }
    return { ...scene, aim: this.aim, hint: this.hint, preview: this.preview?.points, impact: this.preview?.impact };
  }

  /** @returns {object} Position animée de la balle, des lunes et parallaxe des étoiles. */
  flightFrame() {
    const { hole, shot, samples, index } = this.flight;
    const sample = samples[index];
    const drift = this.reducedMotion ? { x: 0, y: 0 } : { x: sample.x / 1000, y: sample.y / 1000 };
    return { hole, time: shot.t0 + sample.t, ball: sample, drift };
  }

  draw() {
    this.renderer.draw(this.frame());
  }

  /** Bandeau : trou, par, coups et total par rapport au par ; boutons selon la phase. */
  renderHud() {
    const { state, ui } = this;
    const hole = this.hole();
    ui['hud-hole'].textContent = `Trou ${state.holeIndex + 1}/${state.holeCount}`;
    ui['hud-par'].textContent = `Par ${hole.par}`;
    ui['hud-strokes'].textContent = `Coups ${state.strokes[state.holeIndex]}`;
    ui['hud-total'].textContent = `Total ${formatToPar(cardTotals(state).toPar)}`;
    ui.app.dataset.phase = this.phase;
    ui['btn-shoot'].disabled = this.phase !== 'aiming';
    for (const button of this.nudges) { button.disabled = this.phase !== 'aiming'; }
    ui['btn-restart'].disabled = this.phase !== 'aiming' || state.strokes[state.holeIndex] === 0;
    ui.field.setAttribute('aria-label', this.describeField(hole));
    this.renderCard(ui.card);
  }

  /**
   * Description textuelle du terrain : distance et direction du trou depuis la balle.
   * @param {object} hole - Trou courant.
   * @returns {string} Libellé du canvas.
   */
  describeField(hole) {
    const { ball } = this.state;
    const distance = Math.round(Math.hypot(hole.hole.x - ball.x, hole.hole.y - ball.y));
    const bearing = aimToward(ball, hole.hole).angle;
    const support = ball.on === null ? 'dans le vide' : 'posée sur une planète';
    return `${hole.name} : balle ${support}, trou à ${distance} unités, direction ${formatAngle(bearing)}. ${hole.bodies.length} corps céleste${hole.bodies.length > 1 ? 's' : ''}.`;
  }

  /** @param {HTMLTableElement} table - Carte de score : trous, par et coups. */
  renderCard(table) {
    const { state } = this;
    const rows = [['Trou'], ['Par'], ['Coups']];
    for (let index = 0; index < state.holeCount; index++) {
      const known = state.course[index];
      rows[0].push(String(index + 1));
      rows[1].push(known ? String(known.par) : '–');
      rows[2].push(index < cardTotals(state).played ? String(state.strokes[index]) : '–');
    }
    table.replaceChildren(...rows.map(cells => {
      const row = this.document.createElement('tr');
      row.append(...cells.map((text, index) => {
        const cell = this.document.createElement(index === 0 ? 'th' : 'td');
        if (index === 0) { cell.scope = 'row'; }
        cell.textContent = text;
        return cell;
      }));
      return row;
    }));
  }

  /** Records des trois modes dans le panneau latéral. */
  renderRecords() {
    const today = localDate(this.now());
    const entries = [
      ['Initiation', this.records.best('course')],
      ['Trou du jour', this.records.best('daily', today)],
      ['Parcours libre', this.records.best('free')],
    ];
    this.ui.records.replaceChildren(...entries.flatMap(([name, best]) => {
      const term = this.document.createElement('dt');
      const value = this.document.createElement('dd');
      term.textContent = name;
      value.textContent = best === null ? '—' : `${best} coups`;
      return [term, value];
    }));
  }

  /** @param {string} message - Message bref affiché sur le terrain puis effacé. */
  toast(message) {
    const { toast } = this.ui;
    toast.textContent = message;
    toast.hidden = false;
    this.announce(message);
    this.later(() => { toast.hidden = true; }, TOAST_MS);
  }

  /** @param {string} message - Message durable (stockage, audio). */
  notice(message) {
    this.ui['storage-notice'].textContent = message;
    this.ui['storage-notice'].hidden = false;
  }

  /** @param {string} message - Annonce pour les lecteurs d'écran. */
  announce(message) {
    this.ui.status.textContent = message;
  }

  /**
   * @param {() => void} callback - Action différée, annulée au démontage.
   * @param {number} delay - Délai en ms.
   */
  later(callback, delay) {
    const id = this.window.setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, delay);
    this.timers.add(id);
  }

  /** Démontage : frame, minuteurs, écouteurs, observateur, audio et points d'accroche. */
  dispose() {
    if (this.disposed) { return; }
    this.disposed = true;
    for (const id of [this.frameId, this.paintFrame]) {
      if (id !== null) { this.window.cancelAnimationFrame(id); }
    }
    this.frameId = null;
    this.paintFrame = null;
    for (const id of this.timers) { this.window.clearTimeout(id); }
    this.timers.clear();
    this.abort.abort();
    this.resizer?.disconnect();
    this.sound.dispose();
    for (const [name, previous] of this.savedHooks) { this.window[name] = previous; }
  }
}
