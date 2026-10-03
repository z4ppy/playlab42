/**
 * Diese & Mat - Raccourcis clavier globaux de l'application
 *
 * Ordre conservé : événement consommé, Échap, saisie, piano, tap rythmique,
 * puis touches 1-7. Chaque étape retourne true quand elle termine le traitement.
 *
 * @module AppKeyboard
 */

const EDITABLE_SELECTOR = 'input, select, textarea, [contenteditable="true"]';
const NATIVE_ACTIVATION_SELECTOR = 'button, a[href]';

/** Surcouches fermées par Échap, de la plus prioritaire à la moins prioritaire. */
const OVERLAY_CLOSERS = [
  [(app) => app.metronomeController?.isVisible(), (app) => app.metronomeController.hide()],
  [(app) => app.tunerController?.isVisible(), (app) => app.tunerController.hide()],
  [(app) => app.synthController?.isVisible(), (app) => app.hideSynth()],
  [(app) => app.pianoController?.isVisible(), (app) => app.hidePiano()],
  [(app) => app.elements.memoOverlay?.classList.contains('visible'), (app) => app.hideMemo()],
];

function matchesTarget(event, selector) {
  return Boolean(event.target.closest?.(selector));
}

function closeOverlayOrView(app) {
  const overlay = OVERLAY_CLOSERS.find(([isOpen]) => isOpen(app));
  if (overlay) {
    overlay[1](app);
  } else if (app.currentView !== 'menu') {
    app.showView('menu');
  }
}

function playPianoKey(app, event) {
  if (!app.pianoController?.isVisible()) {return false;}
  const key = event.key.toLowerCase();
  if (!app.pianoController.keyMap[key] || event.repeat) {return false;}
  event.preventDefault();
  app.pianoController.handleKeyDown(key);
  return true;
}

// Le tap ne termine pas le traitement : le comportement historique poursuit vers les chiffres.
function tapRhythm(app, event) {
  if (event.key !== ' ' || !app.rhythmController?.state) {return;}
  if (matchesTarget(event, NATIVE_ACTIVATION_SELECTOR)) {return;}
  event.preventDefault();
  app.rhythmController.handleKeydown(event);
}

function answerWithNoteKey(app, event) {
  if (app.currentView !== 'exercise' || !app.engine?.isRunning()) {return;}
  const keyNum = parseInt(event.key);
  if (keyNum >= 1 && keyNum <= 7 && app.currentExercise?.mode !== 'rhythm') {
    app.submitAnswer(keyNum - 1);
  }
}

/**
 * Applique les raccourcis clavier globaux à l'application.
 * @param {Object} app - Instance de App
 * @param {KeyboardEvent} event - Événement clavier
 */
export function handleAppKeydown(app, event) {
  if (event.defaultPrevented) {return;}
  if (event.key === 'Escape') {
    closeOverlayOrView(app);
    return;
  }
  if (matchesTarget(event, EDITABLE_SELECTOR)) {return;}
  if (playPianoKey(app, event)) {return;}
  tapRhythm(app, event);
  answerWithNoteKey(app, event);
}
