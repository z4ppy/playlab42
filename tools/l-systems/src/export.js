/**
 * Exports PNG / SVG et copie du lien de partage (dépend du DOM).
 * Chaque fonction renvoie un message court à afficher ; les échecs lèvent
 * une erreur au message lisible, affichée sans boîte de dialogue bloquante.
 */

import { buildSvg } from './svg-export.js';
import { fitView } from './view.js';
import { strokePaths, buildPaths } from './renderer.js';
import { findPreset } from './presets.js';

/** Côté le plus long de l'image PNG exportée (px). */
export const PNG_SIZE = 2400;

/**
 * Nom de fichier lisible tiré du préréglage.
 * @param {import('./hash-state.js').ToolState} state - État
 * @param {string} extension - Extension
 * @returns {string}
 */
export function fileName(state, extension) {
  const base = findPreset(state.preset)?.id ?? 'l-systeme';
  return `${base}-n${state.iterations}.${extension}`;
}

/**
 * Déclenche le téléchargement d'un Blob.
 * @param {Blob} blob - Contenu
 * @param {string} name - Nom de fichier
 */
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function backgroundColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#101827';
}

/**
 * Vérifie qu'un dessin est disponible.
 * @param {{ drawing: object|null, styleIndex: object|null }} app - Application
 */
function requireDrawing(app) {
  if (!app.drawing || !app.styleIndex || app.drawing.count === 0) {
    throw new Error('Rien à exporter pour le moment.');
  }
}

/**
 * Exporte le dessin entier en PNG haute définition, fond du thème compris.
 * L'épaisseur des traits est proportionnée à ce que montre l'écran.
 * @param {{ drawing: any, styleIndex: any, state: any }} app - Application
 * @param {{ stage: HTMLElement }} els - Éléments
 * @returns {Promise<string>}
 */
export async function exportPng(app, els) {
  requireDrawing(app);
  const { bounds } = app.drawing;
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-9);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-9);
  const ratio = spanX / spanY;
  const width = Math.round(ratio >= 1 ? PNG_SIZE : Math.max(PNG_SIZE * ratio, PNG_SIZE / 4));
  const height = Math.round(ratio >= 1 ? Math.max(PNG_SIZE / ratio, PNG_SIZE / 4) : PNG_SIZE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = backgroundColor();
  ctx.fillRect(0, 0, width, height);
  const view = fitView(bounds, width, height, PNG_SIZE * 0.04);
  const screenSize = Math.max(els.stage.clientWidth, els.stage.clientHeight, 320);
  strokePaths(ctx, buildPaths(app.drawing, app.styleIndex), app.styleIndex, view, { pixelRatio: Math.max(width, height) / screenSize, zoomRatio: 1 });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('Le navigateur n’a pas pu produire l’image PNG.');
  }
  download(blob, fileName(app.state, 'png'));
  return `Image PNG ${width} × ${height} exportée.`;
}

/**
 * Exporte le dessin entier en SVG vectoriel.
 * @param {{ drawing: any, styleIndex: any, state: any }} app - Application
 * @returns {string}
 */
export function exportSvg(app) {
  requireDrawing(app);
  const name = findPreset(app.state.preset)?.name ?? 'L-système personnalisé';
  const svg = buildSvg(app.drawing, app.styleIndex, {
    background: backgroundColor(),
    title: `${name} (n = ${app.state.iterations})`,
  });
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  download(blob, fileName(app.state, 'svg'));
  return `SVG exporté (${Math.round(blob.size / 1024)} Ko).`;
}

/**
 * Copie le lien de partage dans le presse-papiers.
 * @param {string} hash - Fragment de l'état
 * @returns {Promise<string>}
 */
export async function copyLink(hash) {
  const url = new URL(location.href);
  url.hash = hash;
  try {
    await navigator.clipboard.writeText(url.href);
    return 'Lien copié dans le presse-papiers.';
  } catch {
    // Presse-papiers refusé (iframe, http) : le lien reste dans la barre d'adresse.
    history.replaceState(null, '', url.hash);
    return 'Copie refusée par le navigateur : le lien à jour est dans la barre d’adresse.';
  }
}
