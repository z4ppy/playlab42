/**
 * Contrôleur du client Solitaire : relie session, rendu, gestes, IA et GameKit.
 *
 * Règle d'or : le rendu, les indices et l'IA ne lisent que `session.view`
 * (la vue du joueur). L'état complet n'est consulté que pour savoir si la
 * partie est finie, jamais pour afficher ou conseiller.
 *
 * @module games/solitaire/ui/app
 */

import { isEditableTarget } from '../../../lib/dom.js';
import { SeededRandom } from '../../../lib/seeded-random.js';
import { cardName } from '../engine/cards.js';
import { MAX_DEAL_NUMBER } from '../engine/deal.js';
import { takenCard } from '../ai/heuristics.js';
import { findHint } from '../ai/planner.js';
import { boardFromView } from '../ai/position.js';
import { HeuristicBot } from '../bots/heuristic.js';
import { announceAction } from './announce.js';
import { BoardView } from './board-view.js';
import { bestMove, foundationMove } from './destinations.js';
import { SolitaireDialogs } from './dialogs.js';
import { BoardKeyboard } from './keyboard.js';
import { captureCards, playMoves, shake, victoryCascade } from './motion.js';
import { DragController, TapResolver } from './pointer.js';
import { SolitaireProgress } from './progress.js';
import { GameSession } from './session.js';
import { shortcutFor } from './shortcuts.js';
import { StepPlayer, Stopwatch, formatDuration } from './timers.js';

/** Budget d'un indice dans le navigateur : nœuds bornés et 200 ms au plus. */
const HINT_BUDGET = Object.freeze({ maxNodes: 4000, timeMs: 200 });

/** Rythme de lecture : l'IA laisse le temps de lire, la fin automatique enchaîne. */
const PACE = Object.freeze({ watch: 900, finish: 140 });

/** Les numéros tirés au hasard restent courts pour être faciles à noter. */
const RANDOM_DEALS = 1_000_000;

const sameMove = (a, b) => a.from === b.from && a.to === b.to && a.count === b.count;

export class SolitaireApp {
  /**
   * @param {Object} context
   * @param {Document} context.doc
   * @param {Window} context.win
   * @param {typeof import('../../../lib/gamekit.js').GameKit} context.kit - SDK du portail
   * @param {{seed?: number, drawCount?: 1|3}} [context.initialDeal] - Première donne (adresse de la page)
   */
  constructor({ doc, win, kit, initialDeal = {} }) {
    this.doc = doc;
    this.win = win;
    this.kit = kit;
    kit.init('solitaire');
    this.$ = id => doc.getElementById(id);
    this.table = this.$('table');
    this.progress = new SolitaireProgress(kit, message => this.#notice(message));
    this.session = new GameSession();
    this.board = new BoardView(this.table);
    this.keyboard = new BoardKeyboard(this.board, { select: cursor => this.#select(cursor), cancel: () => this.#cancelSelection() });
    this.drag = new DragController(this.table, {
      canDrag: (pile, count) => count > 0 && !this.session.state.gameOver,
      canDrop: move => this.session.canPlay({ type: 'move', ...move }),
      drop: (move, ghosts) => this.play({ type: 'move', from: move.from, to: move.to, count: move.count }, ghosts),
      start: () => this.#userAction(),
    });
    this.taps = new TapResolver(win);
    this.clock = new Stopwatch(() => win.performance.now());
    this.player = new StepPlayer(win);
    this.bot = new HeuristicBot({ maxNodes: HINT_BUDGET.maxNodes });
    this.dialogs = new SolitaireDialogs(doc, {
      settings: () => this.progress.settings,
      deal: ({ settings, seed }) => this.#dealWith(settings, seed),
      statsText: () => this.#statsText(),
      newDeal: () => this.newDeal(),
      replay: () => this.replay(),
    });
    this.selection = null;
    this.hint = null;
    this.started = false;
    this.#bind();
    this.newDeal(initialDeal);
  }

  // --- Donnes ---------------------------------------------------------------

  /**
   * Distribue une donne (au hasard par défaut) avec les réglages courants.
   * @param {{seed?: number, drawCount?: 1|3, winnableOnly?: boolean}} [deal]
   */
  newDeal(deal = {}) {
    this.#userAction();
    const settings = this.progress.settings;
    const seed = deal.seed ?? Math.floor(Math.random() * RANDOM_DEALS);
    const state = this.session.start({
      seed: Math.min(MAX_DEAL_NUMBER, seed),
      drawCount: deal.drawCount ?? settings.drawCount,
      winnableOnly: deal.winnableOnly ?? settings.winnableOnly,
    });
    this.clock.reset();
    this.started = false;
    this.assisted = false;
    this.hint = null;
    this.selection = null;
    this.dialogs.closeAll();
    this.render();
    this.#message(this.#dealMessage(state));
    this.#announce(`Nouvelle donne numéro ${state.dealNumber}, pioche ${state.board.drawCount}.`);
  }

  /** Rejoue la donne en cours depuis le début (même numéro, même pioche). */
  replay() {
    const { state } = this.session;
    this.newDeal({ seed: state.dealNumber, drawCount: state.board.drawCount, winnableOnly: state.winnableOnly });
  }

  #dealWith(settings, seed) {
    this.progress.updateSettings(settings);
    this.newDeal(seed === null ? {} : { seed });
  }

  #dealMessage(state) {
    if (!state.winnableOnly) {
      return 'Cliquez ou glissez une carte pour la déplacer.';
    }
    return state.winnable
      ? `Donne n° ${state.dealNumber} : le solveur a prouvé qu’elle est gagnable.`
      : 'Aucune donne prouvée gagnable près de ce numéro : celle-ci n’est pas vérifiée.';
  }

  // --- Coups -----------------------------------------------------------------

  /**
   * Joue une action et anime la table depuis les positions précédentes.
   * @param {import('../engine/rules.js').SolitaireAction} action
   * @param {Map<string, DOMRect>} [ghosts] - Positions de départ (fin d'un glisser)
   * @returns {boolean} Faux si l'action est refusée
   */
  play(action, ghosts) {
    if (!this.session.canPlay(action)) {
      return false;
    }
    const before = this.session.view;
    const rects = ghosts ?? captureCards(this.table);
    const origin = this.board.pile('stock').getBoundingClientRect();
    this.session.play(action);
    this.#startClock();
    this.hint = null;
    this.selection = null;
    this.render();
    playMoves(this.table, rects, { origin: action.type === 'draw' ? origin : null, win: this.win });
    this.#announce(announceAction(before, action, this.session.view));
    this.#afterMove();
    return true;
  }

  #startClock() {
    if (!this.started) {
      this.started = true;
      this.progress.recordStart();
    }
    this.clock.start();
  }

  #afterMove() {
    const { state } = this.session;
    if (state.winners) {
      this.#win();
    } else if (state.gameOver) {
      this.clock.pause();
      this.#message('Plus aucun coup possible : la partie est perdue. Annulez des coups ou relancez une donne.');
    } else if (this.#canFinish() && this.progress.settings.autoFinish && !this.player.running) {
      this.finish();
    }
  }

  #win() {
    this.clock.pause();
    this.player.stop();
    const { state } = this.session;
    // Une donne où l'IA a joué n'entre ni dans les victoires ni dans les scores du joueur.
    if (!this.assisted) {
      this.progress.recordWin({ score: state.score, elapsedMs: this.clock.elapsed });
    }
    const { won, played } = this.progress.stats;
    const record = this.assisted ? 'L’IA a joué : victoire non comptée.' : `Victoires : ${won} sur ${played} parties.`;
    const summary = `${state.moves} coups, ${formatDuration(this.clock.elapsed)}, score ${state.score}. ${record}`;
    this.#message(`Bravo ! ${summary}`);
    victoryCascade(this.table, this.win).then(() => {
      if (this.session.state === state) {
        this.dialogs.openVictory(summary);
      }
    });
  }

  /** Pioche, ou recycle la défausse quand le talon est vide. */
  playTalon() {
    const { stockCount, waste } = this.session.view;
    if (stockCount || waste.length) {
      this.play({ type: stockCount ? 'draw' : 'recycle' });
    }
  }

  /**
   * Clic ou Entrée sur un élément de la table.
   * @param {HTMLElement} element - Élément portant `data-pile` et `data-count`
   * @param {number} clicks - `event.detail` : 0 au clavier, 2 pour le second clic d'un double-clic
   */
  activate(element, clicks) {
    const pile = element.dataset.pile;
    const count = Number(element.dataset.count);
    const key = `${pile}:${count}`;
    // Second clic d'un double-clic déjà traité : la carte est partie, celle du dessous ne
    // doit pas bouger. Le talon, lui, accepte les clics rapides (une pioche chacun).
    if (clicks > 1 && count > 0 && this.taps.pendingKey !== key) {
      return;
    }
    if (this.taps.pendingKey !== key) {
      this.#userAction();
    }
    const fromKeyboard = clicks === 0;
    if (this.selection) {
      this.#drop(pile);
    } else if (pile === 'stock') {
      this.playTalon();
    } else if (count > 0) {
      this.#autoMove(element, pile, count, fromKeyboard);
    }
  }

  #autoMove(element, pile, count, fromKeyboard) {
    const board = boardFromView(this.session.view);
    const primary = bestMove(board, pile, count);
    const found = foundationMove(board, pile, count);
    const double = !fromKeyboard && found && primary && !sameMove(found, primary) ? () => this.play(found) : null;
    this.taps.tap(`${pile}:${count}`, () => {
      if (!primary || !this.play(primary)) {
        this.#refuse(element, takenCard(board, pile, count));
      }
    }, double);
  }

  /** Raccourci F : la prise visée part sur sa fondation. */
  sendToFoundation() {
    this.#userAction();
    const { pile, count } = this.selection ?? this.keyboard.cursor;
    const board = boardFromView(this.session.view);
    const move = count > 0 && pile !== 'stock' ? foundationMove(board, pile, count) : null;
    if (move) {
      this.play(move);
    } else {
      this.#message('Cette carte ne peut pas monter sur une fondation.');
    }
  }

  #refuse(element, card) {
    shake(element, this.win);
    this.#message(`Aucune destination pour ${cardName(card)}.`);
  }

  // --- Prise au clavier ------------------------------------------------------

  #select(cursor) {
    this.#userAction();
    if (this.selection) {
      this.#drop(cursor.pile);
    } else if (cursor.pile === 'stock') {
      this.playTalon();
    } else if (cursor.count > 0) {
      this.selection = { pile: cursor.pile, count: cursor.count };
      this.render();
      const card = cardName(takenCard(boardFromView(this.session.view), cursor.pile, cursor.count));
      this.#announce(`${card} pris${cursor.count > 1 ? ` avec ${cursor.count - 1} carte(s)` : ''}. Choisissez une pile puis Espace, ou Échap.`);
    }
  }

  #drop(to) {
    const { pile, count } = this.selection;
    this.selection = null;
    if (to === pile || !this.play({ type: 'move', from: pile, to, count })) {
      this.render();
      this.#announce(to === pile ? 'Prise reposée.' : 'Impossible de poser ici. Prise annulée.');
    }
  }

  #cancelSelection() {
    if (this.selection) {
      this.selection = null;
      this.render();
      this.#announce('Prise annulée.');
    }
  }

  // --- Historique ------------------------------------------------------------

  undo() {
    this.#travel(() => this.session.undo(), 'Coup annulé.', 'Rien à annuler.');
  }

  redo() {
    this.#travel(() => this.session.redo(), 'Coup rejoué.', 'Rien à refaire.');
  }

  #travel(step, done, nothing) {
    this.#userAction();
    const rects = captureCards(this.table);
    if (!step()) {
      this.#announce(nothing);
      return;
    }
    this.hint = null;
    this.selection = null;
    this.dialogs.victory.close();
    if (!this.session.state.gameOver && this.started) {
      this.clock.start();
    }
    this.render();
    playMoves(this.table, rects, { win: this.win });
    this.#announce(done);
  }

  // --- IA --------------------------------------------------------------------

  /** Indice : meilleur coup selon la vue, mis en évidence et expliqué. */
  showHint() {
    this.#userAction();
    const hint = this.#computeHint(this.session.view);
    this.hint = hint.action?.type === 'move' ? { from: hint.action.from, to: hint.action.to, count: hint.action.count }
      : hint.action ? { from: 'stock', to: null, count: 0 } : null;
    this.render();
    this.#message(hint.explanation);
  }

  #computeHint(view) {
    const now = () => this.win.performance.now();
    return findHint(view, {
      maxNodes: HINT_BUDGET.maxNodes, history: this.session.historyKeys(), now, deadline: now() + HINT_BUDGET.timeMs,
    });
  }

  /** Regarder l'IA jouer (bot Heuristique), ou l'arrêter. */
  toggleWatch() {
    if (this.player.running) {
      this.player.stop();
      return;
    }
    this.#userAction();
    if (this.session.state.gameOver) {
      return;
    }
    const rng = new SeededRandom(this.session.state.dealNumber);
    this.bot.onGameStart(this.session.state.playerId, {});
    this.assisted = true;
    this.#setWatching(true);
    this.#message('L’IA réfléchit à partir de ce que vous voyez…');
    this.player.start(() => this.#botStep(rng), PACE.watch, () => this.#setWatching(false));
  }

  #botStep(rng) {
    const action = this.bot.chooseAction(this.session.view, this.session.validActions(), rng);
    const hint = this.bot.lastHint;
    if (hint.kind === 'blocked' || hint.kind === 'won') {
      this.#message(`IA : ${hint.explanation}`);
      return false;
    }
    this.#message(`IA : ${hint.explanation}`);
    this.play(action);
    return !this.session.state.gameOver;
  }

  #setWatching(on) {
    const button = this.$('btn-watch');
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? 'Arrêter l’IA' : 'Regarder l’IA';
  }

  /** Fin automatique : plus aucune carte cachée, l'IA enchaîne les coups. */
  finish() {
    if (!this.#canFinish()) {
      return;
    }
    this.#message('Fin automatique…');
    this.player.start(() => this.#finishStep(), PACE.finish, () => this.render());
  }

  #finishStep() {
    const hint = this.#computeHint(this.session.view);
    if (!hint.action) {
      this.#message(hint.explanation);
      return false;
    }
    this.play(hint.action);
    return !this.session.state.gameOver;
  }

  #canFinish() {
    const view = this.session.view;
    return !view.gameOver && view.tableau.every(column => column.downCount === 0);
  }

  /** Toute action du joueur interrompt l'IA et exécute un clic en attente. */
  #userAction() {
    this.player.stop();
    this.taps.flush();
  }

  // --- Rendu -----------------------------------------------------------------

  render() {
    const view = this.session.view;
    this.keyboard.beforeRender();
    const top = this.board.columns.getBoundingClientRect().top;
    this.board.render(view, {
      hint: this.hint, selection: this.selection, availableHeight: this.win.innerHeight - top - 12,
    });
    this.keyboard.afterRender();
    this.table.classList.toggle('is-won', Boolean(view.winners));
    this.$('stat-score').textContent = String(view.score);
    this.$('stat-moves').textContent = String(view.moves);
    this.$('deal-label').textContent = `Donne n° ${view.dealNumber} · Pioche ${view.drawCount}${view.winnable ? ' · gagnable' : ''}`;
    this.$('btn-undo').disabled = !this.session.canUndo;
    this.$('btn-redo').disabled = !this.session.canRedo;
    this.$('btn-hint').disabled = view.gameOver;
    this.$('btn-watch').disabled = view.gameOver;
    this.$('btn-finish').hidden = !this.#canFinish();
    this.#renderClock();
  }

  #renderClock() {
    const text = formatDuration(this.clock.elapsed);
    const time = this.$('stat-time');
    if (time.textContent !== text) {
      time.textContent = text;
    }
  }

  #message(text) {
    this.$('message').textContent = text;
  }

  #announce(text) {
    this.$('announcer').textContent = text;
  }

  #notice(text) {
    const notice = this.$('storage-notice');
    notice.textContent = text;
    notice.hidden = false;
  }

  #statsText() {
    const { played, won, bestTimeMs, bestScore } = this.progress.stats;
    const best = bestTimeMs === null ? '' : ` Meilleur temps : ${formatDuration(bestTimeMs)}, meilleur score : ${bestScore}.`;
    return `Parties commencées : ${played}, gagnées : ${won}.${best}`;
  }

  // --- Événements ------------------------------------------------------------

  #bind() {
    const commands = {
      undo: () => this.undo(),
      redo: () => this.redo(),
      talon: () => { this.#userAction(); this.playTalon(); },
      hint: () => this.showHint(),
      watch: () => this.toggleWatch(),
      finish: () => this.finish(),
      newDeal: () => this.newDeal(),
      foundation: () => this.sendToFoundation(),
      help: () => this.dialogs.openHelp(),
      options: () => this.dialogs.openOptions(),
      replay: () => this.replay(),
    };
    for (const [id, command] of Object.entries({
      'btn-new': 'newDeal', 'btn-replay': 'replay', 'btn-undo': 'undo', 'btn-redo': 'redo', 'btn-hint': 'hint',
      'btn-watch': 'watch', 'btn-finish': 'finish', 'btn-options': 'options', 'btn-help': 'help',
    })) {
      this.$(id).addEventListener('click', commands[command]);
    }
    this.table.addEventListener('click', event => {
      const target = event.target.closest('[data-pile]');
      if (target) {
        this.activate(target, event.detail);
      }
    });
    this.onKeydown = event => this.#shortcut(event, commands);
    this.doc.addEventListener('keydown', this.onKeydown);
    this.ticker = this.win.setInterval(() => this.#renderClock(), 500);
    this.onResize = () => this.render();
    this.win.addEventListener('resize', this.onResize);
    this.win.onGamePause = () => { this.clock.pause(); this.player.stop(); };
    this.win.onGameResume = () => { if (this.started && !this.session.state.gameOver) { this.clock.start(); } };
    this.win.onGameDispose = () => this.dispose();
  }

  #shortcut(event, commands) {
    if (event.defaultPrevented || isEditableTarget(event.target) || this.dialogs.anyOpen) {
      return;
    }
    const command = shortcutFor(event);
    if (command) {
      event.preventDefault();
      commands[command]();
    }
  }

  /** Libère minuteries et écouteurs (message `unload` du portail). */
  dispose() {
    this.player.stop();
    this.taps.flush();
    this.drag.dispose();
    this.dialogs.dispose();
    this.win.clearInterval(this.ticker);
    this.doc.removeEventListener('keydown', this.onKeydown);
    this.win.removeEventListener('resize', this.onResize);
  }
}
