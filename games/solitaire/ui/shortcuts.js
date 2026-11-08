/**
 * Raccourcis globaux du Solitaire (hors navigation de la table).
 * Une table de correspondance plutôt qu'une cascade de conditions : la liste
 * documentée dans l'aide se lit ici telle quelle.
 *
 * @module games/solitaire/ui/shortcuts
 */

/** Touche (minuscule) → commande. */
export const SHORTCUTS = Object.freeze({
  z: 'undo',
  y: 'redo',
  p: 'talon',
  i: 'hint',
  a: 'watch',
  t: 'finish',
  n: 'newDeal',
  f: 'foundation',
  '?': 'help',
});

/**
 * Commande associée à un événement clavier, ou `null`.
 * Ctrl (ou Cmd) n'est accepté que pour Ctrl+Z, Ctrl+Maj+Z et Ctrl+Y.
 * @param {{key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, shiftKey?: boolean}} event
 * @returns {string|null}
 */
export function shortcutFor(event) {
  const key = event.key.toLowerCase();
  if (event.altKey) {
    return null;
  }
  if (event.ctrlKey || event.metaKey) {
    if (key === 'z') {
      return event.shiftKey ? 'redo' : 'undo';
    }
    return key === 'y' ? 'redo' : null;
  }
  return SHORTCUTS[key] ?? null;
}
