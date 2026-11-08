/**
 * Traduction des touches en commandes de jeu (fonction pure, testable sans DOM).
 *
 * Les chiffres sont lus par `event.code` (Digit1…, Numpad1…) autant que par
 * `event.key` : sur un clavier AZERTY, la rangée du haut donne « & é " ' ... »
 * sans Maj. On accepte donc la touche physique, avec ou sans Maj.
 * Les flèches ne sont pas traitées ici : board-navigation.js déplace le focus.
 */

/** @typedef {{type: 'digit', value: number} | {type: 'erase'} | {type: 'undo'} | {type: 'redo'}
 *   | {type: 'toggleNotes'} | {type: 'hint'} | {type: 'pause'}} KeyCommand */

const LETTER_COMMANDS = { n: 'toggleNotes', h: 'hint', p: 'pause' };

function digitOf(event) {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code ?? '') ?? /^([1-9])$/.exec(event.key ?? '');
  return match ? Number(match[1]) : null;
}

/** Ctrl+Z / Cmd+Z annule ; Ctrl+Y ou Ctrl+Maj+Z refait. */
function historyCommand(event) {
  const key = (event.key ?? '').toLowerCase();
  if (key === 'y' || (key === 'z' && event.shiftKey)) {
    return { type: 'redo' };
  }
  return key === 'z' ? { type: 'undo' } : null;
}

/**
 * @param {{key?: string, code?: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, shiftKey?: boolean}} event
 * @returns {KeyCommand | null} Commande, ou null si la touche ne concerne pas le jeu.
 */
export function commandForKey(event) {
  if (event.altKey) {
    return null;
  }
  if (event.ctrlKey || event.metaKey) {
    return historyCommand(event);
  }
  const digit = digitOf(event);
  if (digit !== null) {
    return { type: 'digit', value: digit };
  }
  if (['Backspace', 'Delete', '0'].includes(event.key) || event.code === 'Numpad0') {
    return { type: 'erase' };
  }
  const letter = LETTER_COMMANDS[(event.key ?? '').toLowerCase()];
  return letter ? { type: letter } : null;
}
