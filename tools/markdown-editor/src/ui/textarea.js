/**
 * Application d'un état `{ text, start, end }` à une zone de saisie.
 *
 * On ne remplace que la portion modifiée, via `execCommand('insertText')`
 * quand le navigateur le permet : la modification entre alors dans
 * l'historique natif (Ctrl+Z / Ctrl+Maj+Z). Sinon `setRangeText` sert de repli.
 *
 * @module ui/textarea
 */

import { diffText } from '../editor-commands.js';

/**
 * @param {HTMLTextAreaElement} textarea
 * @param {string} insert
 * @returns {boolean}
 */
function nativeInsert(textarea, insert) {
  try {
    const doc = textarea.ownerDocument;
    return insert === '' ? doc.execCommand('delete', false) : doc.execCommand('insertText', false, insert);
  } catch {
    return false;
  }
}

/**
 * État courant de la zone de saisie.
 * @param {HTMLTextAreaElement} textarea
 * @returns {import('../editor-commands.js').EditorState}
 */
export function readState(textarea) {
  return { text: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd };
}

/**
 * Applique un nouvel état.
 * @param {HTMLTextAreaElement} textarea
 * @param {import('../editor-commands.js').EditorState} next
 * @param {{ focus?: boolean }} [options] - `focus: false` évite d'ouvrir le
 *   clavier virtuel (modification depuis l'aperçu) ; l'historique n'est alors
 *   pas conservé.
 */
export function applyState(textarea, next, { focus = true } = {}) {
  const before = textarea.value;
  if (before !== next.text) {
    const { from, to, insert } = diffText(before, next.text);
    let done = false;
    if (focus) {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(from, to);
      done = nativeInsert(textarea, insert) && textarea.value === next.text;
    }
    if (!done) {
      textarea.value = next.text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  textarea.setSelectionRange(next.start, next.end);
}
