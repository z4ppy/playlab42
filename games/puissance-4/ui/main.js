/**
 * Point d'entrée de la page : relie réglages, grille, IA (Web Worker) et GameKit.
 *
 * Le contrôleur ne connaît pas les règles : il les délègue à GameSession (et
 * donc au moteur), et ne fait que séquencer les tours, l'affichage et l'IA.
 * Chaque changement de position incrémente `ui.generation` : une réponse de
 * l'IA arrivée après une annulation ou une nouvelle partie est ignorée.
 */

import GameKit from '../../../lib/gamekit.js';
import { isEditableTarget } from '../../../lib/dom.js';
import { getTheme, initTheme, setTheme } from '../../../lib/theme.js';
import { AiClient } from '../ai/client.js';
import { DEFAULT_BUDGET } from '../ai/search.js';
import { COLUMNS } from '../engine/board.js';
import { LEVELS } from '../bots/levels.js';
import { createBoardView } from './board-view.js';
import { renderEvaluation, renderFinalEvaluation, renderHistory } from './panels.js';
import { GameSession } from './session.js';
import { describeMove, hintText, statusText } from './text.js';

/** Durée minimale du tour de l'IA : laisse voir la chute du jeton et « l'IA réfléchit ». */
const AI_MIN_DELAY_MS = 450;

const stopTheme = initTheme();
GameKit.init('puissance-4');

const byId = (id) => document.getElementById(id);
const elements = {
  status: byId('status'),
  board: byId('board'),
  hint: byId('hint'),
  history: byId('history'),
  settings: byId('settings'),
  aiSettings: byId('ai-settings'),
  showEval: byId('show-eval'),
  evalPanel: byId('eval-panel'),
  evaluation: { meter: byId('eval-meter'), label: byId('eval-label') },
  undo: byId('btn-undo'),
  hintButton: byId('btn-hint'),
  newGame: byId('btn-new'),
  theme: byId('theme-select'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const session = new GameSession();
const ai = new AiClient();
const ui = { paused: false, thinking: false, generation: 0, announcement: '', analysis: null, analysisColor: 'red', hint: null, hintMessage: '' };
const board = createBoardView(elements.board, { onPlay: playHuman });

/** @param {number} ms - Délai @returns {Promise<void>} */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @returns {boolean} Un humain peut-il jouer maintenant ? */
function isHumanTurn() {
  return !ui.paused && !session.state.gameOver && !session.isAiTurn();
}

/** Lit le formulaire de réglages ; la graine vient de l'horloge du client. */
function readSettings() {
  const form = new FormData(elements.settings);
  return {
    mode: form.get('mode') === 'duo' ? 'duo' : 'ai',
    humanColor: form.get('humanColor') === 'yellow' ? 'yellow' : 'red',
    firstColor: form.get('firstColor') === 'yellow' ? 'yellow' : 'red',
    level: String(form.get('level')),
    seed: Date.now() >>> 0,
  };
}

/** Oublie tout ce qui dépendait de la position précédente. */
function resetPositionState() {
  ui.generation++;
  Object.assign(ui, { thinking: false, analysis: null, hint: null, hintMessage: '' });
}

// --- Rendu ---------------------------------------------------------------

/**
 * Redessine toute la page depuis la session et l'état du client.
 * @param {{ animateLast?: boolean }} [options] - Animer la chute du dernier jeton
 */
function render({ animateLast = false } = {}) {
  const { state } = session;
  board.render(state, {
    interactive: isHumanTurn(),
    turnColor: state.colors[state.currentPlayerId],
    hintColumn: ui.hint?.column ?? null,
    animateLast: animateLast && !reducedMotion.matches,
  });
  elements.board.setAttribute('aria-busy', String(ui.thinking));
  elements.status.textContent = [ui.announcement, statusText(state, session.names, ui)].filter(Boolean).join(' ');
  elements.status.dataset.tone = state.gameOver ? 'final' : '';
  elements.hint.textContent = ui.hintMessage;
  renderHistory(elements.history, state, session.names);
  renderEvaluationPanel();
  elements.undo.disabled = !session.canUndo();
  elements.hintButton.disabled = !isHumanTurn();
}

/** Barre d'évaluation : masquée sur demande, figée en fin de partie. */
function renderEvaluationPanel() {
  elements.evalPanel.hidden = !elements.showEval.checked;
  if (session.state.gameOver) {
    renderFinalEvaluation(elements.evaluation, session.state);
  } else {
    renderEvaluation(elements.evaluation, ui.analysis, ui.analysisColor);
  }
}

// --- Déroulement de la partie ---------------------------------------------

/** Démarre une partie avec les réglages du formulaire. */
function newGame() {
  ai.cancelAll();
  session.start(readSettings());
  resetPositionState();
  ui.announcement = 'Nouvelle partie.';
  render();
  continueGame();
}

/**
 * Coup demandé par l'humain (clic, toucher, Entrée, Espace ou touche 1-7).
 * @param {number} column - Colonne (0 à 6)
 */
function playHuman(column) {
  if (!isHumanTurn()) {
    return;
  }
  if (!session.canHumanPlay(column)) {
    ui.hintMessage = `La colonne ${column + 1} est pleine : choisissez-en une autre.`;
    render();
    return;
  }
  applyMove(session.play(column));
}

/**
 * Affiche un coup qui vient d'être joué, puis enchaîne.
 * @param {import('../engine.js').Move} move - Coup joué
 */
function applyMove(move) {
  // Une analyse encore en cours porte sur l'ancienne position : on l'abandonne.
  if (ai.busy) {
    ai.cancelAll();
  }
  resetPositionState();
  ui.announcement = describeMove(session.names, move);
  render({ animateLast: true });
  if (session.state.gameOver) {
    finishGame();
  } else {
    continueGame();
  }
}

/** Fait jouer l'IA si c'est son tour, sinon prépare l'évaluation pour l'humain. */
function continueGame() {
  if (ui.paused || session.state.gameOver) {
    return;
  }
  if (session.isAiTurn()) {
    playAi();
  } else {
    requestEvaluation();
  }
}

/** Tour de l'IA, calculé dans le worker ; l'interface reste utilisable. */
async function playAi() {
  const generation = ui.generation;
  ui.thinking = true;
  render();
  const request = ai.request({ kind: 'move', view: session.state, level: session.settings.level, rngState: session.rngState });
  const [response] = await Promise.all([request, delay(reducedMotion.matches ? 0 : AI_MIN_DELAY_MS)]);
  if (response.cancelled || generation !== ui.generation) {
    return;
  }
  ui.thinking = false;
  if (!response.ok) {
    ui.announcement = `L’IA n’a pas pu jouer : ${response.error}`;
    render();
    return;
  }
  applyMove(session.play(response.action.column, response.rngState));
}

/** Analyse légère après chaque coup, pour la barre d'évaluation. */
async function requestEvaluation() {
  if (!elements.showEval.checked || !isHumanTurn()) {
    return;
  }
  const generation = ui.generation;
  const colorToMove = session.state.colors[session.state.currentPlayerId];
  const response = await ai.request({ kind: 'analyze', view: session.state });
  if (response.ok && generation === ui.generation) {
    Object.assign(ui, { analysis: response.analysis, analysisColor: colorToMove });
    renderEvaluationPanel();
  }
}

/** Indice : analyse complète (budget du niveau Expert) et explication. */
async function showHint() {
  if (!isHumanTurn()) {
    return;
  }
  const generation = ui.generation;
  const colorToMove = session.state.colors[session.state.currentPlayerId];
  ui.hintMessage = 'L’IA cherche le meilleur coup…';
  render();
  const response = await ai.request({ kind: 'analyze', view: session.state, budget: { maxNodes: DEFAULT_BUDGET.maxNodes } });
  if (response.cancelled || generation !== ui.generation) {
    return;
  }
  if (response.ok) {
    Object.assign(ui, { hint: response.analysis, hintMessage: hintText(response.analysis), analysis: response.analysis, analysisColor: colorToMove });
  } else {
    ui.hintMessage = `Indice indisponible : ${response.error}`;
  }
  render();
}

/** Annule le dernier coup humain (et la réponse de l'IA qui a suivi). */
function undo() {
  ai.cancelAll();
  if (!session.undo()) {
    return;
  }
  resetPositionState();
  ui.announcement = 'Coup annulé.';
  render();
  continueGame();
}

/** Fin de partie : victoire contre l'IA enregistrée via GameKit (scores locaux). */
function finishGame() {
  const winner = session.state.winners?.[0];
  if (session.aiPlayerId === null || !winner || winner === session.aiPlayerId) {
    return;
  }
  if (!GameKit.saveScore(LEVELS[session.settings.level].points)) {
    ui.announcement += ' (Le score n’a pas pu être enregistré.)';
    render();
  }
}

// --- Entrées ---------------------------------------------------------------

/**
 * Touches 1 à 7 : jouer directement une colonne, hors champs de saisie.
 * @param {KeyboardEvent} event - Touche pressée
 */
function onKeydown(event) {
  if (isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const column = Number.parseInt(event.key, 10) - 1;
  if (column >= 0 && column < COLUMNS && event.key.length === 1) {
    event.preventDefault();
    board.focusColumn(column);
    playHuman(column);
  }
}

/** Les réglages propres à l'IA n'ont de sens que contre elle. */
function syncModeFields() {
  const duo = new FormData(elements.settings).get('mode') === 'duo';
  elements.aiSettings.hidden = duo;
  elements.aiSettings.querySelectorAll('select').forEach((select) => { select.disabled = duo; });
}

elements.settings.addEventListener('submit', (event) => {
  event.preventDefault();
  newGame();
});
elements.settings.addEventListener('change', syncModeFields);
elements.showEval.addEventListener('change', () => {
  render();
  requestEvaluation();
});
elements.newGame.addEventListener('click', newGame);
elements.undo.addEventListener('click', undo);
elements.hintButton.addEventListener('click', showHint);
elements.theme.value = getTheme();
elements.theme.addEventListener('change', () => setTheme(elements.theme.value));
document.addEventListener('keydown', onKeydown);

// Pause du portail ou onglet masqué : le calcul en cours est abandonné, puis
// relancé à la reprise — l'IA étant déterministe, elle jouera le même coup.
window.onGamePause = () => {
  ui.paused = true;
  if (ui.thinking) {
    ai.cancelAll();
    resetPositionState();
  }
  render();
};
window.onGameResume = () => {
  ui.paused = false;
  render();
  continueGame();
};
window.onGameDispose = () => {
  ai.cancelAll();
  document.removeEventListener('keydown', onKeydown);
  stopTheme();
};

syncModeFields();
newGame();
