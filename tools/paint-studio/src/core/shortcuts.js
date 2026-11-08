/**
 * Raccourcis clavier : table pure, testable sans navigateur.
 *
 * Le clavier n'est qu'un accélérateur : chaque commande a aussi un bouton.
 * Les chiffres sont lus via `code` (Digit1…) pour fonctionner en AZERTY, où
 * la rangée du haut donne « & é " … » sans Majuscule.
 */

/**
 * Raccourcis documentés (affichés dans l'aide), dans l'ordre de l'aide.
 * keys : libellé lisible ; combo : clé normalisée (voir comboOf).
 */
export const SHORTCUTS = Object.freeze([
  { keys: 'B', label: 'Pinceau', combo: 'b', command: 'tool', arg: 'brush' },
  { keys: 'P', label: 'Crayon (pixel)', combo: 'p', command: 'tool', arg: 'pencil' },
  { keys: 'E', label: 'Gomme', combo: 'e', command: 'tool', arg: 'eraser' },
  { keys: 'L', label: 'Ligne', combo: 'l', command: 'tool', arg: 'line' },
  { keys: 'U', label: 'Rectangle / ellipse (alterne)', combo: 'u', command: 'tool-cycle', arg: 'rect,ellipse' },
  { keys: 'G', label: 'Pot de peinture', combo: 'g', command: 'tool', arg: 'fill' },
  { keys: 'I', label: 'Pipette', combo: 'i', command: 'tool', arg: 'eyedropper' },
  { keys: 'M', label: 'Sélection rectangulaire', combo: 'm', command: 'tool', arg: 'select' },
  { keys: 'V', label: 'Déplacer (sélection ou calque)', combo: 'v', command: 'tool', arg: 'move' },
  { keys: 'T', label: 'Texte', combo: 't', command: 'tool', arg: 'text' },
  { keys: 'H', label: 'Main (déplacer la vue)', combo: 'h', command: 'tool', arg: 'hand' },
  { keys: 'Espace + glisser', label: 'Déplacer la vue temporairement', combo: null, command: 'pan', arg: null },
  { keys: '[ / ]', label: 'Réduire / agrandir la taille', combo: '[', command: 'size', arg: '-1' },
  { keys: null, label: null, combo: ']', command: 'size', arg: '1' },
  { keys: 'X', label: 'Inverser couleurs principale / secondaire', combo: 'x', command: 'swap-colors', arg: null },
  { keys: 'D', label: 'Couleurs par défaut (noir / blanc)', combo: 'd', command: 'default-colors', arg: null },
  { keys: '1 … 9, 0', label: 'Opacité de l\'outil 10 % … 90 %, 100 %', combo: null, command: 'opacity', arg: null },
  { keys: 'Ctrl/Cmd + Z', label: 'Annuler', combo: 'mod+z', command: 'undo', arg: null },
  { keys: 'Ctrl/Cmd + Maj + Z, Ctrl + Y', label: 'Rétablir', combo: 'mod+shift+z', command: 'redo', arg: null },
  { keys: null, label: null, combo: 'mod+y', command: 'redo', arg: null },
  { keys: 'Ctrl/Cmd + A', label: 'Tout sélectionner', combo: 'mod+a', command: 'select-all', arg: null },
  { keys: 'Ctrl/Cmd + D, Échap', label: 'Désélectionner / annuler le geste', combo: 'mod+d', command: 'deselect', arg: null },
  { keys: null, label: null, combo: 'escape', command: 'escape', arg: null },
  { keys: 'Entrée', label: 'Valider le déplacement de la sélection', combo: 'enter', command: 'commit', arg: null },
  { keys: 'Ctrl/Cmd + C / X / V', label: 'Copier / couper / coller', combo: 'mod+c', command: 'copy', arg: null },
  { keys: null, label: null, combo: 'mod+x', command: 'cut', arg: null },
  { keys: null, label: null, combo: 'mod+v', command: 'paste', arg: null },
  { keys: 'Suppr', label: 'Effacer la sélection', combo: 'delete', command: 'delete-selection', arg: null },
  { keys: null, label: null, combo: 'backspace', command: 'delete-selection', arg: null },
  { keys: 'Ctrl/Cmd + S', label: 'Enregistrer le projet', combo: 'mod+s', command: 'save', arg: null },
  { keys: 'Ctrl/Cmd + O', label: 'Ouvrir un projet ou une image', combo: 'mod+o', command: 'open', arg: null },
  { keys: 'Ctrl/Cmd + Maj + E', label: 'Exporter l\'image', combo: 'mod+shift+e', command: 'export', arg: null },
  { keys: 'Ctrl/Cmd + Maj + N', label: 'Nouveau calque', combo: 'mod+shift+n', command: 'new-layer', arg: null },
  { keys: '+ / −', label: 'Zoomer / dézoomer', combo: '+', command: 'zoom', arg: '1' },
  { keys: null, label: null, combo: '=', command: 'zoom', arg: '1' },
  { keys: null, label: null, combo: '-', command: 'zoom', arg: '-1' },
  { keys: 'Ctrl/Cmd + 0', label: 'Ajuster à l\'écran', combo: 'mod+0', command: 'zoom-fit', arg: null },
  { keys: 'Ctrl/Cmd + 1', label: 'Taille réelle (100 %)', combo: 'mod+1', command: 'zoom-100', arg: null },
  { keys: '?', label: 'Aide des raccourcis', combo: '?', command: 'help', arg: null },
]);

const TABLE = new Map(SHORTCUTS.filter((s) => s.combo).map((s) => [s.combo, s]));

/**
 * Clé normalisée d'un événement : « mod+shift+z », « b », « escape »…
 * Majuscule n'est retenue qu'avec Ctrl/Cmd (sinon « ? » ou « + » dépendraient du clavier).
 * @param {{key: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean}} event
 */
export function comboOf(event) {
  const mod = Boolean(event.ctrlKey || event.metaKey);
  const parts = [];
  if (mod) {
    parts.push('mod');
  }
  if (mod && event.shiftKey) {
    parts.push('shift');
  }
  parts.push(String(event.key).toLowerCase());
  return parts.join('+');
}

/** Chiffre de la rangée du haut ou du pavé numérique, sans modificateur. */
function digitOf(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  const match = /^(?:Digit|Numpad)(\d)$/.exec(String(event.code ?? ''));
  return match ? Number(match[1]) : null;
}

/**
 * Commande associée à un événement clavier.
 * @param {{key: string, code?: string, ctrlKey?: boolean, metaKey?: boolean, shiftKey?: boolean, altKey?: boolean}} event
 * @returns {{command: string, arg: string|null}|null}
 */
export function resolveShortcut(event) {
  const digit = digitOf(event);
  if (digit !== null) {
    // 1 -> 10 %, …, 9 -> 90 %, 0 -> 100 %.
    return { command: 'opacity', arg: String(digit === 0 ? 100 : digit * 10) };
  }
  if (event.altKey && !(event.ctrlKey || event.metaKey)) {
    return null;
  }
  const entry = TABLE.get(comboOf(event));
  return entry ? { command: entry.command, arg: entry.arg } : null;
}

/**
 * Vrai si la touche revient au contrôle focalisé : Entrée et Espace activent
 * nativement un bouton, une case ou un lien. Ils ne servent de raccourcis
 * (valider, déplacer la vue) que sur la zone de dessin ou hors de tout contrôle.
 * Une sélection flottante garde Entrée pour sa validation, quel que soit le focus.
 * @param {{key: string, code?: string}} event
 * @param {boolean} onControl - Un contrôle autre que la zone de dessin a reçu le focus au clavier
 * @param {boolean} [floating] - Une sélection flottante attend d'être validée
 */
export function isNativeActivation(event, onControl, floating = false) {
  if (!onControl) {
    return false;
  }
  if (event.key === 'Enter') {
    return !floating;
  }
  return event.key === ' ' || event.code === 'Space';
}
