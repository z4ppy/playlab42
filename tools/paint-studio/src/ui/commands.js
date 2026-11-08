/**
 * Commandes nommées de l'application : déclenchées par les boutons
 * (data-command), les raccourcis clavier (src/core/shortcuts.js) et les menus.
 * Une seule table : un bouton et son raccourci font exactement la même chose.
 */

import { askExport, askNewDocument, askResize, showHelp } from './dialogs.js';
import { exportCurrentImage, openPicker, pasteFromClipboard, saveProject } from './app-io.js';

/** Facteur de [ et ] sur la taille de l'outil. */
const SIZE_STEP = 1.25;

/**
 * Taille suivante : multiplicative (fine pour les petits pinceaux), au moins ±1 px.
 * @param {number} size
 * @param {number} direction - +1 ou −1
 */
export function nextSize(size, direction) {
  const scaled = direction > 0 ? size * SIZE_STEP : size / SIZE_STEP;
  return direction > 0 ? Math.max(size + 1, Math.round(scaled)) : Math.min(size - 1, Math.round(scaled));
}

/**
 * @param {any} app
 * @returns {Record<string, (arg: string|null) => unknown>}
 */
export function createCommands(app) {
  const editor = app.editor;
  const selection = editor.selection;

  /** Modifie un réglage de l'outil actif s'il le possède. */
  const adjust = (name, compute) => {
    const settings = editor.settingsFor(editor.tool.id);
    if (name in settings) {
      editor.setSetting(editor.tool.id, name, compute(settings[name]));
      app.options.render();
    }
  };

  return {
    tool: (id) => editor.setTool(id),
    'tool-cycle': (list) => {
      const ids = String(list).split(',');
      editor.setTool(ids[(ids.indexOf(editor.tool.id) + 1) % ids.length]);
    },
    size: (direction) => adjust(editor.tool.options.includes('fontSize') ? 'fontSize' : 'size', (size) => nextSize(size, Number(direction))),
    opacity: (percent) => adjust('opacity', () => Number(percent)),
    'swap-colors': () => editor.swapColors(),
    'default-colors': () => editor.defaultColors(),
    undo: () => editor.step('undo'),
    redo: () => editor.step('redo'),
    'select-all': () => selection.selectAll(),
    deselect: () => selection.deselect(),
    escape: () => app.escape(),
    commit: () => selection.commit(),
    copy: () => selection.copy() && app.toast('Sélection copiée.'),
    cut: () => selection.cut(),
    paste: () => pasteFromClipboard(app),
    'delete-selection': () => selection.erase(),
    save: () => saveProject(app),
    open: () => openPicker('file-open'),
    import: () => openPicker('file-import'),
    export: async () => {
      const choice = await askExport();
      return choice && exportCurrentImage(app, choice);
    },
    new: async () => {
      const choice = await askNewDocument();
      if (choice) {
        editor.setDocument(editor.blankDocument(choice.width, choice.height, choice.white));
      }
    },
    resize: async () => {
      const choice = await askResize(editor.doc);
      if (choice) {
        editor.selection.commit();
        const done = editor.record(editor.doc.resizeCanvas(choice.width, choice.height, choice.anchor));
        if (done) {
          editor.selection.setRect(null);
          editor.documentResized();
        }
      }
    },
    'new-layer': () => app.layerAction('add'),
    zoom: (direction) => editor.zoomStep(Number(direction)),
    'zoom-fit': () => editor.fit(),
    'zoom-100': () => editor.zoomActual(),
    'toggle-grid': () => {
      editor.showGrid = !editor.showGrid;
      editor.requestRender(false);
      editor.notify('settings', 'view');
    },
    help: () => showHelp(),
  };
}
