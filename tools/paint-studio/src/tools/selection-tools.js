/**
 * Sélection rectangulaire et déplacement.
 *
 * - Sélection : glisser trace un rectangle ; glisser depuis l'intérieur d'une
 *   sélection déplace ses pixels ; un appui hors sélection la retire.
 * - Déplacer : glisser déplace la sélection, ou tout le calque sans sélection.
 * Chaque déplacement est validé au relâchement (une étape d'historique) ;
 * un second doigt pendant le geste annule le déplacement.
 */

import { rectFromDrag } from '../core/geometry.js';

/**
 * Geste de déplacement partagé par les deux outils.
 */
function createDragMover() {
  let drag = null;
  return {
    get active() {
      return drag !== null;
    },
    start(editor, p) {
      const selection = editor.selection;
      const wasFloating = Boolean(selection.floating);
      if (!selection.lift()) {
        return false;
      }
      const f = selection.floating;
      drag = { from: { x: p.x, y: p.y }, origin: { x: f.x, y: f.y }, wasFloating };
      return true;
    },
    move(editor, p) {
      if (drag) {
        editor.selection.moveTo(drag.origin.x + p.x - drag.from.x, drag.origin.y + p.y - drag.from.y);
      }
    },
    end(editor) {
      if (drag) {
        drag = null;
        editor.selection.commit();
      }
    },
    cancel(editor) {
      if (!drag) {
        return;
      }
      const { origin, wasFloating } = drag;
      drag = null;
      if (wasFloating) {
        // Collage encore flottant : il revient simplement à sa position d'avant le geste.
        editor.selection.moveTo(origin.x, origin.y);
      } else {
        editor.selection.cancelFloating();
      }
    },
  };
}

export function createSelectTool() {
  const mover = createDragMover();
  /** @type {{x: number, y: number}|null} Début du rectangle en cours. */
  let anchor = null;

  return {
    id: 'select',
    label: 'Sélection',
    icon: '⬚',
    key: 'M',
    cursor: 'crosshair',
    options: ['selectionActions', 'constrain'],
    defaults: { constrain: false },

    down(editor, p) {
      const selection = editor.selection;
      if (selection.floating || selection.contains(p)) {
        mover.start(editor, p);
        return;
      }
      selection.commit();
      anchor = { x: Math.round(p.x), y: Math.round(p.y) };
      selection.setRect(null);
    },

    move(editor, p) {
      if (mover.active) {
        mover.move(editor, p);
        return;
      }
      if (anchor) {
        const square = editor.settingsFor('select').constrain || p.shift;
        editor.selection.setRect(rectFromDrag(anchor, { x: Math.round(p.x), y: Math.round(p.y) }, { square, fromCenter: p.alt }));
        editor.requestRender();
      }
    },

    up(editor) {
      anchor = null;
      mover.end(editor);
    },

    cancel(editor) {
      if (anchor) {
        anchor = null;
        editor.selection.setRect(null);
      }
      mover.cancel(editor);
    },
  };
}

export function createMoveTool() {
  const mover = createDragMover();
  return {
    id: 'move',
    label: 'Déplacer',
    icon: '✥',
    key: 'V',
    cursor: 'move',
    options: ['selectionActions'],
    defaults: {},
    down: (editor, p) => mover.start(editor, p),
    move: (editor, p) => mover.move(editor, p),
    up: (editor) => mover.end(editor),
    cancel: (editor) => mover.cancel(editor),
  };
}
