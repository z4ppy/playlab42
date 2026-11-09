/**
 * Entrées sur les cases : souris, doigt et clavier traduits en trois intentions.
 *
 * - `primary` : clic gauche, appui court, Entrée ou Espace (activation native du bouton) ;
 * - `flag` : clic droit, appui long (doigt) ou touche F ;
 * - `chord` : clic milieu (l'accord est aussi déclenché par `primary` sur un chiffre).
 *
 * Les écouteurs sont posés sur un conteneur stable (délégation) : la grille
 * peut être reconstruite sans les réattacher.
 */

/** Durée d'un appui long, en millisecondes. */
export const LONG_PRESS_MS = 450;
/** Déplacement du doigt au-delà duquel l'appui devient un défilement. */
const MOVE_TOLERANCE = 10;

/**
 * Traduit une intention en action du moteur, selon le contenu de la case.
 * @param {'primary'|'flag'|'chord'} intent - Intention.
 * @param {number|string} cell - Contenu visible de la case.
 * @param {{flagMode: boolean, ready: boolean}} context - Mode drapeau et partie pas encore commencée.
 * @returns {{type: 'reveal'|'toggleFlag'|'chord'}|{message: string}|null} Action, explication ou rien.
 */
export function resolveIntent(intent, cell, { flagMode, ready }) {
  if (typeof cell === 'number') { return intent === 'flag' ? null : { type: 'chord' }; }
  if (intent === 'chord') { return null; }
  const wantsFlag = intent === 'flag' || flagMode;
  if (wantsFlag && ready) { return { message: 'Ouvrez d\'abord une case : le premier clic est toujours sûr.' }; }
  if (wantsFlag) { return { type: 'toggleFlag' }; }
  if (cell === 'flag') { return { message: 'Cette case porte un drapeau : retirez-le pour l\'ouvrir.' }; }
  return { type: 'reveal' };
}

/**
 * @param {EventTarget|null} target - Cible d'un événement.
 * @returns {number|null} Indice moteur de la case visée.
 */
function cellIndex(target) {
  const cell = target instanceof Element ? target.closest('button[data-index]') : null;
  return cell ? Number(cell.dataset.index) : null;
}

/**
 * Branche les entrées d'une grille.
 * @param {HTMLElement} root - Conteneur stable de la grille.
 * @param {{window: Window, signal: AbortSignal, onIntent: (intent: string, index: number) => void}} options - Dépendances.
 * @returns {{cancel: () => void}} Annule un appui long en cours (pause, perte de focus).
 */
export function bindCellInput(root, { window, signal, onIntent }) {
  const press = { timer: null, x: 0, y: 0, pointerType: 'mouse', suppressClick: false };
  const cancel = () => {
    if (press.timer !== null) { window.clearTimeout(press.timer); }
    press.timer = null;
  };
  const listen = (type, handler) => root.addEventListener(type, handler, { signal });

  listen('pointerdown', event => {
    cancel();
    press.pointerType = event.pointerType;
    press.suppressClick = false;
    const index = cellIndex(event.target);
    if (index === null || event.pointerType !== 'touch') { return; }
    Object.assign(press, { x: event.clientX, y: event.clientY });
    press.timer = window.setTimeout(() => {
      press.timer = null;
      press.suppressClick = true;
      window.navigator.vibrate?.(15);
      onIntent('flag', index);
    }, LONG_PRESS_MS);
  });
  listen('pointermove', event => {
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) { cancel(); }
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) { listen(type, cancel); }

  listen('click', event => {
    const index = cellIndex(event.target);
    if (index === null) { return; }
    if (press.suppressClick) { press.suppressClick = false; return; }
    onIntent('primary', index);
  });
  listen('contextmenu', event => {
    const index = cellIndex(event.target);
    if (index === null) { return; }
    event.preventDefault();
    // Au doigt, l'appui long a déjà posé le drapeau (Android émet aussi contextmenu).
    if (press.pointerType !== 'touch') { onIntent('flag', index); }
  });
  // Bouton du milieu : pas de défilement automatique, accord au relâchement.
  listen('mousedown', event => { if (event.button === 1 && cellIndex(event.target) !== null) { event.preventDefault(); } });
  listen('auxclick', event => {
    const index = cellIndex(event.target);
    if (index !== null && event.button === 1) {
      event.preventDefault();
      onIntent('chord', index);
    }
  });
  listen('keydown', event => {
    const index = cellIndex(event.target);
    if (index === null || event.ctrlKey || event.metaKey || event.altKey) { return; }
    if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      onIntent('flag', index);
    }
  });
  return { cancel };
}
