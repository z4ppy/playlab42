/**
 * Contrôleur du client Sudoku : relie le DOM, le moteur, les bots et GameKit.
 *
 * Répartition des rôles :
 * - le moteur (engine.js) décide de ce qui est légal et calcule chaque nouvel état ;
 * - ce fichier traduit les gestes (clic, toucher, clavier) en actions du moteur,
 *   gère le chronomètre, la pause, l'indice, l'IA et la sauvegarde locale ;
 * - les vues (board-view.js, pad-view.js) affichent sans calculer de règle.
 */

import GameKit from '../../../lib/gamekit.js';
import { getTheme, setTheme } from '../../../lib/theme.js';
import { isEditableTarget } from '../../../lib/dom.js';
import { SeededRandom } from '../../../lib/seeded-random.js';
import { createBoardNavigation } from '../../board-navigation.js';
import { SudokuEngine } from '../engine.js';
import { cellLongName, findConflicts } from '../engine/grid.js';
import { levelById } from '../engine/difficulty.js';
import { LogicBot } from '../bots/logic.js';
import { BacktrackingBot } from '../bots/backtracking.js';
import { createBoardView, remainingCounts } from './board-view.js';
import { createPadView } from './pad-view.js';
import { commandForKey } from './keyboard.js';
import { createClock, formatDuration, spokenDuration } from './clock.js';
import { createProgressStore } from './progress-store.js';
import { createHintCoach, hintDecorations, hintText } from './hint-coach.js';
import { createAutoPlayer } from './auto-player.js';
import { createPuzzleFactory } from './generation.js';
import { formatPuzzleHash, parsePuzzleHash, randomSeed } from './share.js';

const PLAYER = 'joueur';
const engine = new SudokuEngine();
const byId = (id) => document.getElementById(id);

const dom = {
  board: byId('board'), pad: byId('pad'), message: byId('message'), announcer: byId('announcer'),
  label: byId('puzzle-label'), timer: byId('timer'), pause: byId('pause'), cover: byId('pause-cover'),
  pauseText: byId('pause-text'), level: byId('level'), newGame: byId('new-game'), newGameButton: byId('new-game-button'),
  notesMode: byId('notes-mode'), erase: byId('erase'), undo: byId('undo'), redo: byId('redo'), fillNotes: byId('fill-notes'),
  hint: byId('hint'), check: byId('check'), applyHint: byId('apply-hint'), coachText: byId('coach-text'),
  bot: byId('bot'), speed: byId('speed'), aiRun: byId('ai-run'), aiStep: byId('ai-step'), aiLog: byId('ai-log'),
  conflicts: byId('opt-conflicts'), highlight: byId('opt-highlight'), theme: byId('theme'),
  openGrid: byId('open-grid'), gridNumber: byId('grid-number'), share: byId('share'), shareOutput: byId('share-output'),
  restart: byId('restart'), victory: byId('victory'), victorySummary: byId('victory-summary'), victoryStats: byId('victory-stats'),
};

/** État du client (l'état de jeu lui-même vit dans `session.state`, produit par le moteur). */
const session = {
  state: null,
  selected: null,
  notesMode: false,
  paused: false,
  generating: false,
  hints: 0,
  assisted: false,
  aiCells: new Set(),
  aiPattern: new Set(),
};

const clock = createClock();
const coach = createHintCoach();
const bots = { logic: new LogicBot(), backtracking: new BacktrackingBot() };
const factory = createPuzzleFactory({
  engine,
  createWorker: typeof Worker === 'function'
    ? () => new Worker(new URL('./generation-worker.js', import.meta.url), { type: 'module' })
    : null,
});

GameKit.init('sudoku');
const store = createProgressStore(GameKit, (text) => showMessage(text));
const navigation = createBoardNavigation(dom.board, 9);
const boardView = createBoardView(dom.board, selectCell);
const padView = createPadView(dom.pad, inputDigit);
const autoPlayer = createAutoPlayer({
  step: playAiMove,
  delay: () => Number(dom.speed.value),
  onStop: () => render(),
});

const view = () => engine.getPlayerView(session.state, PLAYER);
const canPlay = () => Boolean(session.state) && !session.state.gameOver && !session.paused && !session.generating;

function showMessage(text) {
  dom.message.textContent = text;
}

function announce(text) {
  dom.announcer.textContent = text;
}

// --- Rendu ---------------------------------------------------------------

function decorations(currentView) {
  const conflicts = dom.conflicts.checked ? findConflicts(currentView.values) : [];
  return {
    selected: session.selected,
    highlight: dom.highlight.checked,
    conflicts: new Set(conflicts),
    aiCells: session.aiCells,
    ...hintDecorations(coach.state()),
    // Pendant la résolution par l'IA, le motif de la dernière déduction reste visible.
    ...(session.aiPattern.size > 0 && { hintPattern: session.aiPattern }),
  };
}

function renderStatus(currentView) {
  const level = levelById(currentView.level).label;
  const fallback = currentView.level === currentView.requestedLevel
    ? '' : ` (niveau ${levelById(currentView.requestedLevel).label.toLowerCase()} demandé : grille la plus proche)`;
  dom.label.textContent = currentView.custom
    ? `Grille imposée · ${level}`
    : `Grille n° ${currentView.seed} · ${level}${fallback}`;
}

function renderTools(currentView) {
  const playable = canPlay() && !autoPlayer.isRunning();
  const selectedEditable = session.selected !== null && currentView.givens[session.selected] === 0;
  dom.notesMode.setAttribute('aria-pressed', String(session.notesMode));
  dom.erase.disabled = !playable || !selectedEditable;
  dom.undo.disabled = !playable || !currentView.canUndo;
  dom.redo.disabled = !playable || !currentView.canRedo;
  dom.fillNotes.disabled = !playable || !engine.isValidAction(session.state, { type: 'fillNotes' }, PLAYER);
  dom.check.disabled = !playable || !engine.isValidAction(session.state, { type: 'check' }, PLAYER);
  dom.hint.disabled = !playable;
  dom.restart.disabled = !playable || !engine.isValidAction(session.state, { type: 'restart' }, PLAYER);
}

function renderCoach() {
  const hint = coach.state();
  dom.hint.textContent = hint.stage === 1 ? 'Voir l’explication' : 'Indice';
  dom.applyHint.hidden = hint.stage !== 2 || !hint.advice;
}

function renderAi() {
  const running = autoPlayer.isRunning();
  const playable = canPlay();
  dom.aiRun.textContent = running ? 'Arrêter l’IA' : 'Lancer l’IA';
  dom.aiRun.setAttribute('aria-pressed', String(running));
  dom.aiRun.disabled = !playable && !running;
  dom.aiStep.disabled = !playable || running;
  dom.bot.disabled = running;
}

function render() {
  if (!session.state) {
    return;
  }
  const currentView = view();
  navigation.beforeRender();
  boardView.render(currentView, decorations(currentView));
  navigation.afterRender();
  padView.render(remainingCounts(currentView.values), {
    notesMode: session.notesMode, disabled: !canPlay() || autoPlayer.isRunning(),
  });
  renderStatus(currentView);
  renderTools(currentView);
  renderCoach();
  renderAi();
  dom.cover.hidden = !session.paused;
  dom.board.inert = session.paused;
  dom.pause.setAttribute('aria-pressed', String(session.paused));
  dom.pause.textContent = session.paused ? 'Reprendre' : 'Pause';
}

// --- Chronomètre et sauvegarde ------------------------------------------

function renderTimer() {
  const elapsed = clock.elapsed();
  dom.timer.textContent = formatDuration(elapsed);
  dom.timer.setAttribute('aria-label', `Temps écoulé : ${spokenDuration(elapsed)}`);
}

function saveCurrent() {
  if (session.state && !session.state.gameOver && !session.state.custom) {
    store.saveCurrent({ state: session.state, elapsedMs: clock.elapsed(), hints: session.hints, assisted: session.assisted });
  }
}

// --- Actions de jeu ------------------------------------------------------

/**
 * Transmet une action au moteur, puis met à jour l'interface.
 * @param {object} action
 * @param {{byAi?: boolean}} [options]
 * @returns {boolean} Vrai si l'action a été appliquée.
 */
function dispatch(action, { byAi = false } = {}) {
  if (!engine.isValidAction(session.state, action, PLAYER)) {
    return false;
  }
  session.state = engine.applyAction(session.state, action, PLAYER);
  session.assisted ||= byAi;
  session.aiCells = byAi && Number.isInteger(action.cell) ? new Set([action.cell]) : new Set();
  session.aiPattern = new Set();
  coach.reset();
  saveCurrent();
  render();
  if (session.state.gameOver) {
    finishGame();
  }
  return true;
}

function describeMove(action) {
  if (action.type === 'place') {
    return `${action.value} en ${cellLongName(action.cell)}`;
  }
  return `${cellLongName(action.cell)} effacée`;
}

function selectCell(cell) {
  if (session.selected !== cell) {
    session.selected = cell;
    render();
  }
}

/** Refuse un geste quand la partie n'accepte pas d'entrée, avec une raison visible. */
function blockedReason() {
  if (autoPlayer.isRunning()) {
    return 'L’IA est en train de jouer : arrêtez-la pour reprendre la main.';
  }
  if (session.paused) {
    return 'Partie en pause : reprenez pour jouer.';
  }
  if (!canPlay()) {
    return 'La grille n’accepte plus de saisie.';
  }
  if (session.selected === null) {
    return 'Sélectionnez d’abord une case.';
  }
  return session.state.givens[session.selected] !== 0 ? 'Cette case est donnée : elle ne peut pas changer.' : null;
}

function inputDigit(digit) {
  const reason = blockedReason();
  if (reason) {
    showMessage(reason);
    return;
  }
  const cell = session.selected;
  const current = session.state.values[cell];
  if (session.notesMode) {
    if (!dispatch({ type: 'note', cell, value: digit })) {
      showMessage('Une note ne se pose que dans une case vide.');
    }
    return;
  }
  // Retaper le chiffre déjà posé l'efface : un geste naturel sur mobile.
  const action = current === digit ? { type: 'erase', cell } : { type: 'place', cell, value: digit };
  if (dispatch(action)) {
    showMessage('');
    announce(describeMove(action));
  }
}

function eraseSelected() {
  const reason = blockedReason();
  if (reason || !dispatch({ type: 'erase', cell: session.selected })) {
    showMessage(reason ?? 'Cette case est déjà vide.');
    return;
  }
  announce(describeMove({ type: 'erase', cell: session.selected }));
}

function runHistory(type) {
  if (canPlay() && !autoPlayer.isRunning() && dispatch({ type })) {
    announce(type === 'undo' ? 'Coup annulé' : 'Coup refait');
  }
}

/** Commande d'édition globale (notes auto, recommencer), suivie d'un message. */
function runEdit(action, success) {
  if (canPlay() && !autoPlayer.isRunning() && dispatch(action)) {
    showMessage(success);
  }
}

function toggleNotesMode() {
  session.notesMode = !session.notesMode;
  showMessage(session.notesMode ? 'Mode notes : les chiffres deviennent des notes.' : 'Mode chiffres.');
  render();
}

// --- Assistant : indice et vérification ---------------------------------

function requestHint() {
  if (!canPlay() || autoPlayer.isRunning()) {
    return;
  }
  const hint = coach.next(view());
  if (hint.stage === 1) {
    session.hints++;
    saveCurrent();
  }
  dom.coachText.textContent = hintText(hint);
  render();
}

function applyHint() {
  const { advice } = coach.state();
  if (advice && dispatch(advice.action, { byAi: true })) {
    dom.coachText.textContent = `Appliqué : ${describeMove(advice.action)}.`;
  }
}

function checkGrid() {
  if (!canPlay() || !dispatch({ type: 'check' })) {
    return;
  }
  const errors = session.state.errorCells.length;
  dom.coachText.textContent = errors === 0
    ? 'Aucune erreur pour l’instant : tous vos chiffres sont compatibles avec la solution.'
    : `${errors} erreur${errors > 1 ? 's' : ''} signalée${errors > 1 ? 's' : ''} en rouge.`;
}

// --- IA ------------------------------------------------------------------

function playAiMove() {
  if (!canPlay()) {
    return false;
  }
  const bot = bots[dom.bot.value];
  const action = bot.chooseAction(view(), engine.getValidActions(session.state, PLAYER), new SeededRandom(session.state.moves));
  dispatch(action, { byAi: true });
  const advice = bot.lastAdvice;
  dom.aiLog.textContent = `${advice.technique} : ${advice.detail}`;
  // Une chaîne (paire, X-Wing...) est montrée sur la grille jusqu'au coup suivant.
  const chain = advice.steps?.length > 1 ? advice.steps : [];
  session.aiPattern = new Set(chain.flatMap((step) => step.cells));
  render();
  return canPlay();
}

function toggleAi() {
  if (autoPlayer.isRunning()) {
    autoPlayer.stop();
  } else if (canPlay()) {
    autoPlayer.start();
  }
  render();
}

// --- Partie : création, pause, victoire ---------------------------------

function begin(state, { elapsedMs = 0, hints = 0, assisted = false } = {}) {
  autoPlayer.stop();
  session.state = state;
  session.hints = hints;
  session.assisted = assisted;
  session.aiCells = new Set();
  session.paused = false;
  coach.reset();
  clock.reset(elapsedMs);
  clock.start();
  dom.level.value = state.requestedLevel;
  dom.coachText.textContent = 'Besoin d’un coup de pouce ? L’indice montre d’abord où regarder, puis explique la déduction.';
  if (!state.custom) {
    history.replaceState(null, '', formatPuzzleHash(state.requestedLevel, state.seed));
  }
  renderTimer();
  render();
}

async function startGame(level, seed) {
  autoPlayer.stop();
  session.generating = true;
  dom.newGameButton.disabled = true;
  dom.label.textContent = `Génération d’une grille ${levelById(level).label.toLowerCase()}…`;
  render();
  try {
    begin(await factory.generate({ seed, playerIds: [PLAYER], difficulty: level }));
    saveCurrent();
    announce(`Nouvelle grille, niveau ${levelById(session.state.level).label}.`);
  } catch (error) {
    showMessage(`La grille n’a pas pu être générée : ${error.message}`);
  } finally {
    session.generating = false;
    dom.newGameButton.disabled = false;
    render();
  }
}

function setPaused(paused) {
  if (!session.state || session.state.gameOver || session.paused === paused) {
    return;
  }
  session.paused = paused;
  if (paused) {
    autoPlayer.stop();
    clock.pause();
    saveCurrent();
  } else {
    clock.start();
  }
  renderTimer();
  render();
  if (!paused) {
    boardView.cells[session.selected ?? 0].focus();
  }
}

function finishGame() {
  autoPlayer.stop();
  clock.pause();
  renderTimer();
  const elapsed = clock.elapsed();
  const { level } = session.state;
  const record = session.assisted ? false : store.recordTime(level, elapsed);
  if (session.assisted) {
    store.saveCurrent(null);
  }
  const best = store.best(level);
  dom.victorySummary.textContent = session.assisted
    ? `Grille ${levelById(level).label.toLowerCase()} terminée avec l’aide de l’IA en ${formatDuration(elapsed)}.`
    : `Bravo ! Grille ${levelById(level).label.toLowerCase()} résolue en ${formatDuration(elapsed)}.`;
  const stats = [
    record ? 'Nouveau record personnel pour ce niveau !' : `Meilleur temps : ${best === null ? '—' : formatDuration(best)}`,
    `Indices demandés : ${session.hints}`,
    `Vérifications : ${session.state.checks}`,
  ];
  dom.victoryStats.replaceChildren(...stats.map((text) => Object.assign(document.createElement('li'), { textContent: text })));
  announce(dom.victorySummary.textContent);
  if (!dom.victory.open) {
    dom.victory.showModal();
  }
}

// --- Branchements --------------------------------------------------------

const KEY_COMMANDS = {
  digit: (command) => inputDigit(command.value),
  erase: () => eraseSelected(),
  undo: () => runHistory('undo'),
  redo: () => runHistory('redo'),
  toggleNotes: () => toggleNotesMode(),
  hint: () => requestHint(),
  pause: () => setPaused(!session.paused),
};

function onKeyDown(event) {
  if (isEditableTarget(event.target) || dom.victory.open || !session.state) {
    return;
  }
  const command = commandForKey(event);
  if (command) {
    event.preventDefault();
    KEY_COMMANDS[command.type](command);
  }
}

function onShare() {
  const url = location.href;
  const done = () => { dom.shareOutput.textContent = 'Lien copié.'; };
  const manual = () => { dom.shareOutput.textContent = `Copiez ce lien : ${url}`; };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(done, manual);
  } else {
    manual();
  }
}

function bindControls() {
  document.addEventListener('keydown', onKeyDown);
  dom.newGame.addEventListener('submit', (event) => {
    event.preventDefault();
    startGame(dom.level.value, randomSeed(Math.random));
  });
  dom.openGrid.addEventListener('submit', (event) => {
    event.preventDefault();
    const target = parsePuzzleHash(`${dom.level.value}-${dom.gridNumber.value.trim()}`);
    if (target) {
      startGame(target.level, target.seed);
    } else {
      showMessage('Numéro de grille invalide : saisissez un entier.');
    }
  });
  dom.pause.addEventListener('click', () => setPaused(!session.paused));
  byId('resume').addEventListener('click', () => setPaused(false));
  dom.notesMode.addEventListener('click', toggleNotesMode);
  dom.erase.addEventListener('click', eraseSelected);
  dom.undo.addEventListener('click', () => runHistory('undo'));
  dom.redo.addEventListener('click', () => runHistory('redo'));
  dom.fillNotes.addEventListener('click', () => runEdit({ type: 'fillNotes' }, 'Notes remplies avec tous les candidats.'));
  dom.restart.addEventListener('click', () => runEdit({ type: 'restart' }, 'Grille remise à zéro (annulable).'));
  dom.hint.addEventListener('click', requestHint);
  dom.applyHint.addEventListener('click', applyHint);
  dom.check.addEventListener('click', checkGrid);
  dom.aiRun.addEventListener('click', toggleAi);
  dom.aiStep.addEventListener('click', () => playAiMove());
  dom.conflicts.addEventListener('change', render);
  dom.highlight.addEventListener('change', render);
  dom.theme.value = getTheme();
  dom.theme.addEventListener('change', () => setTheme(dom.theme.value));
  dom.share.addEventListener('click', onShare);
  dom.victory.addEventListener('close', () => {
    if (dom.victory.returnValue === 'new') {
      startGame(dom.level.value, randomSeed(Math.random));
    }
  });
}

/** Au démarrage : grille du lien partagé, sinon partie sauvegardée, sinon nouvelle grille. */
function boot() {
  bindControls();
  const fromLink = parsePuzzleHash(location.hash);
  const saved = store.current();
  const sameAsLink = saved && fromLink && saved.state.seed === fromLink.seed && saved.state.requestedLevel === fromLink.level;
  if (saved && (!fromLink || sameAsLink)) {
    begin(saved.state, saved);
    showMessage('Partie précédente reprise.');
    return;
  }
  const target = fromLink ?? { level: dom.level.value, seed: randomSeed(Math.random) };
  startGame(target.level, target.seed);
}

const ticker = setInterval(() => {
  if (clock.isRunning()) {
    renderTimer();
  }
}, 1000);

// Pause automatique (onglet masqué, portail) ; la reprise reste un geste volontaire.
window.onGamePause = () => setPaused(true);
window.onGameResume = () => {
  if (session.paused) {
    dom.pauseText.textContent = 'Partie en pause : appuyez sur « Reprendre » pour continuer.';
  }
};
window.onGameDispose = () => {
  saveCurrent();
  autoPlayer.stop();
  clearInterval(ticker);
  factory.dispose();
  document.removeEventListener('keydown', onKeyDown);
};

boot();
