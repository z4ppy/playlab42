/**
 * Catalogue des commandes de la barre d'outils et de leurs raccourcis.
 * Ctrl+Maj+H et Ctrl+Maj+Q sont volontairement absents : certains
 * navigateurs les réservent (historique, fermeture) sans laisser la page
 * les intercepter.
 * Pur : l'interface construit les boutons et route le clavier à partir de
 * cette table, que les tests vérifient sans DOM.
 *
 * @module commands
 */

import {
  cycleHeading, indentLines, insertCode, insertLink, insertTable, toggleLinePrefix, toggleWrap,
} from './editor-commands.js';

/**
 * @typedef {object} Command
 * @property {string} id
 * @property {string} label - Nom accessible (français).
 * @property {string} icon - Glyphe affiché.
 * @property {string} [key] - Touche du raccourci (avec Ctrl ou Cmd).
 * @property {boolean} [shift] - Raccourci avec Maj.
 * @property {string} [hint] - Raccourci affiché quand il ne passe pas par Ctrl (Tab).
 * @property {boolean} [listOnly] - N'agit que si la sélection touche une liste.
 * @property {(state: import('./editor-commands.js').EditorState) => import('./editor-commands.js').EditorState} run
 */

/** @type {Command[]} */
export const COMMANDS = [
  { id: 'bold', label: 'Gras', icon: 'B', key: 'b', run: (s) => toggleWrap(s, '**', 'texte en gras') },
  { id: 'italic', label: 'Italique', icon: 'I', key: 'i', run: (s) => toggleWrap(s, '*', 'texte en italique') },
  { id: 'strike', label: 'Barré', icon: 'S', key: 'x', shift: true, run: (s) => toggleWrap(s, '~~', 'texte barré') },
  { id: 'heading', label: 'Titre (niveau suivant)', icon: 'H', run: cycleHeading },
  { id: 'link', label: 'Lien', icon: '🔗', key: 'k', run: insertLink },
  { id: 'code', label: 'Code', icon: '</>', key: 'e', run: insertCode },
  { id: 'quote', label: 'Citation', icon: '❝', run: (s) => toggleLinePrefix(s, 'quote') },
  { id: 'bullet', label: 'Liste à puces', icon: '•≡', key: '8', shift: true, run: (s) => toggleLinePrefix(s, 'bullet') },
  { id: 'ordered', label: 'Liste numérotée', icon: '1≡', key: '7', shift: true, run: (s) => toggleLinePrefix(s, 'ordered') },
  { id: 'task', label: 'Liste de tâches', icon: '☑', key: '9', shift: true, run: (s) => toggleLinePrefix(s, 'task') },
  // Équivalents tactiles de Tab et Maj+Tab : rien n'est réservé au clavier.
  { id: 'indent', label: 'Augmenter le retrait', icon: '⇥', hint: 'Tab', listOnly: true, run: (s) => indentLines(s, 1) },
  { id: 'outdent', label: 'Diminuer le retrait', icon: '⇤', hint: 'Maj+Tab', listOnly: true, run: (s) => indentLines(s, -1) },
  { id: 'table', label: 'Tableau', icon: '▦', run: insertTable },
];

/**
 * Libellé du raccourci (« Ctrl+B », « ⌘⇧8 »).
 * @param {Command} command
 * @param {boolean} mac
 * @returns {string}
 */
export function shortcutLabel(command, mac) {
  if (!command.key) {
    return command.hint ?? '';
  }
  const key = command.key.toUpperCase();
  if (mac) {
    return `⌘${command.shift ? '⇧' : ''}${key}`;
  }
  return `Ctrl+${command.shift ? 'Maj+' : ''}${key}`;
}

/**
 * Commande correspondant à un événement clavier, s'il y en a une.
 * `event.code` sert de repli pour les chiffres (Maj+8 donne « * » ou « _ »
 * selon la disposition du clavier).
 * @param {{ key: string, code?: string, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean, altKey: boolean }} event
 * @returns {Command|null}
 */
export function commandForKey(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return null;
  }
  const key = event.key.toLowerCase();
  const digit = /^Digit(\d)$/.exec(event.code ?? '')?.[1];
  return COMMANDS.find((command) => command.key
    && Boolean(command.shift) === event.shiftKey
    && (command.key === key || command.key === digit)) ?? null;
}
