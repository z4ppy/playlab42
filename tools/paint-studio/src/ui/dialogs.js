/**
 * Boîtes de dialogue natives (<dialog>) : nouveau document, taille du canevas,
 * export, texte et aide des raccourcis. Échap ferme et rend le focus au bouton
 * d'origine (comportement natif).
 */

import { ANCHORS, clipToDocument, isEmptyRect } from '../core/geometry.js';
import { isValidSize } from '../core/document.js';
import { SHORTCUTS } from '../core/shortcuts.js';
import { toCss } from '../core/color.js';

const ANCHOR_ARROWS = ['↖', '↑', '↗', '←', '•', '→', '↙', '↓', '↘'];
const ANCHOR_LABELS = ['haut gauche', 'haut', 'haut droite', 'gauche', 'centre', 'droite', 'bas gauche', 'bas', 'bas droite'];

/** @param {string} id */
const byId = (id) => /** @type {any} */ (document.getElementById(id));

/**
 * Ouvre un dialogue modal ; résout avec la valeur du bouton (« ok », « cancel »).
 * @param {HTMLDialogElement} dialog
 * @returns {Promise<string>}
 */
export function showDialog(dialog) {
  return new Promise((resolve) => {
    dialog.returnValue = 'cancel';
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
    dialog.showModal();
  });
}

/** Lit deux champs de dimension ; null si invalides. */
function readSize(widthId, heightId) {
  const width = Number(byId(widthId).value);
  const height = Number(byId(heightId).value);
  return isValidSize(width, height) ? { width, height } : null;
}

/** Prépare les contrôles statiques (préréglages, ancrages, aide). */
export function setupDialogs() {
  const preset = byId('new-preset');
  preset.addEventListener('change', () => {
    const match = /^(\d+)x(\d+)$/.exec(preset.value);
    if (match) {
      byId('new-width').value = match[1];
      byId('new-height').value = match[2];
    }
  });
  for (const id of ['new-width', 'new-height']) {
    byId(id).addEventListener('input', () => {
      preset.value = 'custom';
    });
  }
  byId('resize-anchor').replaceChildren(...ANCHORS.map((anchor, i) => {
    const label = document.createElement('label');
    label.className = 'ps-anchor-cell';
    const input = document.createElement('input');
    Object.assign(input, { type: 'radio', name: 'anchor', value: anchor, checked: anchor === 'center' });
    input.setAttribute('aria-label', `Ancrer en ${ANCHOR_LABELS[i]}`);
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = ANCHOR_ARROWS[i];
    label.append(input, arrow);
    return label;
  }));
  const quality = byId('export-quality');
  quality.addEventListener('input', () => {
    byId('export-quality-value').value = `${quality.value} %`;
  });
  byId('export-format').addEventListener('change', () => {
    quality.disabled = byId('export-format').value === 'png';
  });
  quality.disabled = true;
  renderShortcutHelp();
}

/** Liste des raccourcis documentés. */
function renderShortcutHelp() {
  const items = [];
  for (const shortcut of SHORTCUTS.filter((s) => s.keys)) {
    const term = document.createElement('dt');
    const kbd = document.createElement('kbd');
    kbd.textContent = shortcut.keys;
    term.append(kbd);
    const detail = document.createElement('dd');
    detail.textContent = shortcut.label;
    items.push(term, detail);
  }
  byId('shortcut-list').replaceChildren(...items);
}

/**
 * Demande la taille et le fond d'un nouveau document.
 * @returns {Promise<{width: number, height: number, white: boolean}|null>}
 */
export async function askNewDocument() {
  if (await showDialog(byId('dialog-new')) !== 'ok') {
    return null;
  }
  const size = readSize('new-width', 'new-height');
  return size && { ...size, white: byId('new-background').value === 'white' };
}

/**
 * Demande la nouvelle taille du canevas et l'ancrage.
 * @param {{width: number, height: number}} current
 * @returns {Promise<{width: number, height: number, anchor: string}|null>}
 */
export async function askResize(current) {
  byId('resize-width').value = String(current.width);
  byId('resize-height').value = String(current.height);
  if (await showDialog(byId('dialog-resize')) !== 'ok') {
    return null;
  }
  const size = readSize('resize-width', 'resize-height');
  const anchor = /** @type {HTMLInputElement|null} */ (document.querySelector('#resize-anchor input:checked'))?.value ?? 'center';
  return size && { ...size, anchor };
}

/**
 * Demande le format d'export.
 * @returns {Promise<{format: string, quality: number}|null>}
 */
export async function askExport() {
  if (await showDialog(byId('dialog-export')) !== 'ok') {
    return null;
  }
  return { format: byId('export-format').value, quality: Number(byId('export-quality').value) / 100 };
}

/** Affiche l'aide des raccourcis. */
export function showHelp() {
  return showDialog(byId('dialog-help'));
}

/**
 * Demande un texte puis le dessine sur le calque actif à la position donnée.
 * @param {any} editor
 * @param {{x: number, y: number}} point
 */
export async function placeText(editor, point) {
  const input = byId('text-input');
  if (await showDialog(byId('dialog-text')) !== 'ok' || !input.value.trim()) {
    return;
  }
  const layer = editor.editableLayer();
  if (!layer) {
    return;
  }
  const settings = editor.settingsFor('text');
  const ctx = layer.surface.ctx;
  const lines = input.value.split('\n');
  const lineHeight = Math.ceil(settings.fontSize * 1.25);
  const font = `${settings.bold ? 'bold ' : ''}${settings.fontSize}px ${settings.fontFamily}`;
  ctx.font = font;
  const width = Math.max(...lines.map((line) => ctx.measureText(line).width));
  // Marge d'un demi-corps : jambages, italiques et anticrénelage restent dans le patch.
  const margin = Math.ceil(settings.fontSize / 2);
  const area = clipToDocument({ x: point.x - margin, y: point.y - margin, width: width + 2 * margin, height: lines.length * lineHeight + 2 * margin }, editor.doc.width, editor.doc.height);
  if (isEmptyRect(area)) {
    return;
  }
  editor.commitPixels(layer, area, 'Texte', () => {
    ctx.save();
    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.globalAlpha = settings.opacity / 100;
    ctx.fillStyle = toCss(editor.colors.primary);
    lines.forEach((line, i) => ctx.fillText(line, point.x, point.y + i * lineHeight));
    ctx.restore();
  });
  editor.requestRender();
}
