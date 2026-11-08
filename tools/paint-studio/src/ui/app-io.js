/**
 * Entrées / sorties de l'application : ouvrir, enregistrer, importer, exporter,
 * coller, glisser-déposer et sauvegarde automatique en IndexedDB.
 */

import {
  defaultFilename,
  deserializeDocument,
  downloadBlob,
  EXPORT_FORMATS,
  exportImage,
  imageToCanvas,
  isImageFile,
  isProjectFile,
  PROJECT_EXTENSION,
  serializeDocument,
} from './files.js';
import { loadValue, saveValue } from './storage.js';
import { PaintDocument } from '../core/document.js';

const AUTOSAVE_KEY = 'autosave-project';
const AUTOSAVE_DELAY = 2000;

/** Ouvre le sélecteur de fichiers natif. */
export function openPicker(id) {
  const input = /** @type {HTMLInputElement} */ (document.getElementById(id));
  input.value = '';
  input.click();
}

/** Message d'erreur lisible. */
const reason = (error) => (error instanceof Error ? error.message : String(error));

/** Télécharge le projet (calques, modes, opacités) au format .paint.json. */
export function saveProject(app) {
  app.editor.selection.commit();
  let json;
  try {
    json = serializeDocument(app.editor.doc);
  } catch (error) {
    // Mieux vaut refuser que télécharger un fichier qui ne se rouvrirait pas.
    app.toast(`Enregistrement impossible : ${reason(error)}`);
    return;
  }
  downloadBlob(new Blob([json], { type: 'application/json' }), defaultFilename(PROJECT_EXTENSION));
  app.toast('Projet enregistré (téléchargement).');
}

/**
 * Exporte l'image aplatie.
 * @param {any} app
 * @param {{format: string, quality: number}} choice
 */
export async function exportCurrentImage(app, { format, quality }) {
  const { editor } = app;
  editor.selection.commit();
  try {
    const blob = await exportImage(editor.compositeContext().canvas, /** @type {any} */ (format), quality);
    downloadBlob(blob, defaultFilename(EXPORT_FORMATS[format]?.extension ?? 'png'));
    app.toast(`Image exportée en ${format.toUpperCase()}.`);
  } catch (error) {
    app.toast(`Export impossible : ${reason(error)}`);
  }
}

/**
 * Ouvre un fichier : projet .paint.json, ou image comme nouveau document.
 * @param {any} app
 * @param {File} file
 */
export async function openFile(app, file) {
  try {
    if (isProjectFile(file)) {
      app.editor.setDocument(await deserializeDocument(await file.text()));
      app.toast(`Projet « ${file.name} » ouvert.`);
      return;
    }
    if (!isImageFile(file)) {
      throw new Error('format non reconnu (projet .paint.json ou image attendus).');
    }
    const canvas = await imageToCanvas(file);
    const doc = app.editor.blankDocument(canvas.width, canvas.height, false);
    doc.layers[0].name = file.name.replace(/\.[^.]+$/, '').slice(0, 64) || 'Image';
    doc.layers[0].surface.ctx.drawImage(canvas, 0, 0);
    app.editor.setDocument(doc);
    app.toast(`Image ouverte (${canvas.width} × ${canvas.height}).`);
  } catch (error) {
    app.toast(`Ouverture impossible : ${reason(error)}`);
  }
}

/**
 * Ajoute une image dans un nouveau calque, réduite pour tenir dans le document et centrée.
 * @param {any} app
 * @param {Blob} blob
 * @param {string} name
 */
export async function importImageLayer(app, blob, name) {
  const { editor } = app;
  try {
    const canvas = await imageToCanvas(blob, editor.doc);
    editor.selection.commit();
    const entry = editor.doc.addLayer({ name: name.slice(0, 64) || 'Image', label: 'Importer une image' });
    if (!entry) {
      app.toast('Limite de calques atteinte.');
      return;
    }
    const layer = editor.doc.activeLayer;
    layer.surface.ctx.drawImage(canvas, Math.round((editor.doc.width - canvas.width) / 2), Math.round((editor.doc.height - canvas.height) / 2));
    // L'instantané d'historique doit contenir l'image : il est refait après le dessin.
    entry.snapshot = editor.doc.snapshot(layer);
    entry.bytes = PaintDocument.snapshotBytes(entry.snapshot);
    editor.record(entry);
    app.toast('Image importée dans un nouveau calque.');
  } catch (error) {
    app.toast(`Import impossible : ${reason(error)}`);
  }
}

/** Fichiers déposés : un projet est ouvert, les images deviennent des calques. */
export async function dropFiles(app, files) {
  for (const file of files) {
    if (isProjectFile(file)) {
      await openFile(app, file);
    } else if (isImageFile(file)) {
      await importImageLayer(app, file, file.name.replace(/\.[^.]+$/, ''));
    }
  }
}

/**
 * Événement « paste » : image du système en calque, sinon presse-papiers interne.
 * @param {any} app
 * @param {ClipboardEvent} e
 */
export function handlePaste(app, e) {
  const file = [...(e.clipboardData?.files ?? [])].find(isImageFile);
  if (file) {
    e.preventDefault();
    importImageLayer(app, file, 'Image collée');
    return;
  }
  pasteInternal(app);
}

/** Colle le presse-papiers interne comme sélection flottante. */
function pasteInternal(app) {
  const { selection } = app.editor;
  if (!selection.clipboard) {
    app.toast('Rien à coller : copiez d\'abord une sélection.');
    return;
  }
  app.editor.setTool('select');
  selection.float(selection.clipboard, app.editor.visibleCenter());
}

/** Bouton « Coller » : presse-papiers interne, sinon image du système (si permis). */
export async function pasteFromClipboard(app) {
  if (app.editor.selection.clipboard || !navigator.clipboard?.read) {
    pasteInternal(app);
    return;
  }
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) {
        await importImageLayer(app, await item.getType(type), 'Image collée');
        return;
      }
    }
    app.toast('Le presse-papiers ne contient pas d\'image.');
  } catch {
    app.toast('Accès au presse-papiers refusé : utilisez Ctrl+V ou importez l\'image.');
  }
}

/**
 * Sauvegarde automatique différée : regroupe les modifications rapprochées.
 */
export class Autosave {
  constructor(app) {
    this.app = app;
    this.timer = 0;
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.save(), AUTOSAVE_DELAY);
  }

  async save() {
    let json;
    try {
      json = serializeDocument(this.app.editor.doc);
    } catch (error) {
      // La dernière sauvegarde lisible est conservée plutôt qu'écrasée par un projet impossible à rouvrir.
      this.app.setStatus(`Sauvegarde automatique suspendue : ${reason(error)}`);
      return;
    }
    const ok = await saveValue(AUTOSAVE_KEY, json);
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.app.setStatus(ok ? `Sauvegarde automatique à ${time}.` : 'Sauvegarde automatique indisponible (stockage refusé ou plein).');
  }

  /** Restaure le dernier projet sauvegardé ; faux s'il n'y en a pas ou s'il est invalide. */
  async restore() {
    const text = await loadValue(AUTOSAVE_KEY);
    if (typeof text !== 'string') {
      return false;
    }
    try {
      this.app.editor.setDocument(await deserializeDocument(text));
      return true;
    } catch (error) {
      console.warn('Paint Studio : sauvegarde automatique illisible, ignorée.', error);
      this.app.toast(`Sauvegarde automatique non restaurée : ${reason(error)}`);
      return false;
    }
  }
}
