/**
 * Fichiers : export d'image, enregistrement et ouverture de projet, import d'image.
 * Tout reste local : aucun envoi réseau, les fichiers sont téléchargés.
 */

import { PaintDocument } from '../core/document.js';
import { buildProject, parseProject, PROJECT_EXTENSION, stringifyProject } from '../core/project-format.js';
import { createCanvas, createCanvasSurface, context2d, loadImage } from './canvas-surface.js';

/** Formats d'export : type MIME, extension et prise en charge de la qualité. */
export const EXPORT_FORMATS = Object.freeze({
  png: { mime: 'image/png', extension: 'png', lossy: false },
  jpeg: { mime: 'image/jpeg', extension: 'jpg', lossy: true },
  webp: { mime: 'image/webp', extension: 'webp', lossy: true },
});

/** Côté maximal d'une image importée comme nouveau document. */
const MAX_IMPORT_SIDE = 4096;

/**
 * Propose le téléchargement d'un blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Laisse le temps au navigateur de lancer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Promesse de canvas.toBlob (null si le format n'est pas pris en charge). */
function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/**
 * Image aplatie prête à exporter. JPEG n'a pas de transparence : fond blanc.
 * @param {HTMLCanvasElement} composite - Image composée
 * @param {keyof typeof EXPORT_FORMATS} format
 * @param {number} quality - Dans [0, 1] (formats avec perte)
 * @returns {Promise<Blob>}
 */
export async function exportImage(composite, format, quality) {
  const spec = EXPORT_FORMATS[format] ?? EXPORT_FORMATS.png;
  let source = composite;
  if (format === 'jpeg') {
    source = createCanvas(composite.width, composite.height);
    const ctx = context2d(source);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, source.width, source.height);
    ctx.drawImage(composite, 0, 0);
  }
  const blob = await canvasToBlob(source, spec.mime, spec.lossy ? quality : undefined);
  if (!blob) {
    throw new Error(`Format ${spec.extension.toUpperCase()} non pris en charge par ce navigateur.`);
  }
  return blob;
}

/**
 * Sérialise le document (un PNG par calque).
 * @param {PaintDocument} doc
 * @returns {string} JSON
 * @throws {Error} Projet trop lourd pour être rouvert (voir stringifyProject)
 */
export function serializeDocument(doc) {
  const layers = doc.layers.map((layer) => ({
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    blend: layer.blend,
    image: layer.surface.canvas.toDataURL('image/png'),
  }));
  return stringifyProject(buildProject({ width: doc.width, height: doc.height, activeLayer: doc.indexOf(doc.activeLayer.id), layers }));
}

/**
 * Ouvre un projet : validation complète puis décodage des images des calques.
 * @param {string} text
 * @returns {Promise<PaintDocument>}
 * @throws {Error} Message affichable (fichier invalide, image illisible)
 */
export async function deserializeDocument(text) {
  const project = parseProject(text);
  const doc = new PaintDocument({ width: project.width, height: project.height, createSurface: createCanvasSurface });
  for (const [index, data] of project.layers.entries()) {
    const layer = doc.createLayer(data);
    try {
      const image = await loadImage(data.image);
      // Seconde barrière après l'en-tête IHDR vérifié par parseProject.
      if (image.width !== project.width || image.height !== project.height) {
        throw new Error('dimensions inattendues');
      }
      layer.surface.ctx.drawImage(image, 0, 0);
    } catch {
      throw new Error(`Image du calque ${index + 1} illisible.`);
    }
    doc.layers.push(layer);
  }
  doc.activeId = doc.layers[project.activeLayer].id;
  return doc;
}

/** Nom de fichier par défaut, horodaté. */
export function defaultFilename(extension) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `paint-studio-${stamp}${extension.startsWith('.') ? '' : '.'}${extension}`;
}

export { PROJECT_EXTENSION };

/** Vrai si le fichier ressemble à un projet (JSON). */
export function isProjectFile(file) {
  return /\.json$/i.test(file.name) || file.type === 'application/json';
}

/** Vrai si le fichier est une image lisible par le navigateur. */
export function isImageFile(file) {
  return /^image\//.test(file.type);
}

/**
 * Décode une image et la réduit si nécessaire pour tenir dans `max` x `max`.
 * @param {Blob} blob
 * @param {{width: number, height: number}} [fit] - Boîte cible (sinon MAX_IMPORT_SIDE)
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function imageToCanvas(blob, fit = { width: MAX_IMPORT_SIDE, height: MAX_IMPORT_SIDE }) {
  const image = await loadImage(blob);
  const scale = Math.min(1, fit.width / image.width, fit.height / image.height);
  const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
