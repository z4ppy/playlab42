/**
 * Format de projet Paint Studio : JSON versionné, un PNG (data URL) par calque.
 *
 * {
 *   "format": "playlab42-paint-studio",
 *   "version": 1,
 *   "width": 1024, "height": 768,
 *   "activeLayer": 0,
 *   "layers": [{ "name", "visible", "locked", "opacity", "blend", "image": "data:image/png;base64,..." }]
 * }
 *
 * Un fichier ouvert est une donnée non fiable : tout est vérifié (types,
 * bornes, taille du texte, nombre de calques, schéma des images) et seul un
 * objet reconstruit champ par champ est renvoyé, jamais l'objet décodé brut.
 */

import { isBlendMode } from './blend.js';
import { MAX_LAYERS, MAX_NAME_LENGTH, isValidSize } from './document.js';

export const PROJECT_FORMAT = 'playlab42-paint-studio';
export const PROJECT_VERSION = 1;
/** Extension proposée à l'enregistrement. */
export const PROJECT_EXTENSION = '.paint.json';
/**
 * Taille maximale d'un fichier projet (caractères). L'enregistrement applique
 * la même borne (voir stringifyProject) : ce que l'outil écrit, il le rouvre.
 */
export const MAX_PROJECT_CHARS = 120 * 1024 * 1024;

const PNG_PREFIX = 'data:image/png;base64,';
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]*={0,2}$/;
/** Signature PNG puis longueur (13) et type du premier bloc, qui doit être IHDR. */
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];

/** Erreur de lecture d'un projet, au message affichable tel quel. */
export class ProjectFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProjectFormatError';
  }
}

function check(condition, message) {
  if (!condition) {
    throw new ProjectFormatError(message);
  }
}

/** Vrai pour un objet JSON simple (ni tableau, ni null). */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Dimensions déclarées par l'en-tête IHDR d'un PNG en data URL, sans décoder
 * l'image : les 24 premiers octets suffisent (32 caractères base64).
 * @param {string} dataUrl
 * @returns {{width: number, height: number}|null} null si l'en-tête est absent ou invalide
 */
export function readPngSize(dataUrl) {
  let head;
  try {
    head = atob(dataUrl.slice(PNG_PREFIX.length, PNG_PREFIX.length + 32));
  } catch {
    return null;
  }
  if (head.length < 24 || PNG_HEAD.some((byte, i) => head.charCodeAt(i) !== byte)) {
    return null;
  }
  const uint32 = (offset) => [0, 1, 2, 3].reduce((value, i) => value * 256 + head.charCodeAt(offset + i), 0);
  return { width: uint32(16), height: uint32(20) };
}

/**
 * Construit l'objet projet à enregistrer.
 * @param {{width: number, height: number, activeLayer: number, layers: Array<{name: string, visible: boolean, locked: boolean, opacity: number, blend: string, image: string}>}} data
 */
export function buildProject({ width, height, activeLayer, layers }) {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    width,
    height,
    activeLayer,
    layers: layers.map(({ name, visible, locked, opacity, blend, image }) => ({ name, visible, locked, opacity, blend, image })),
  };
}

/**
 * Valide un calque décodé et renvoie une copie propre.
 * @param {unknown} raw
 * @param {number} index - Pour les messages d'erreur (1 = premier)
 * @param {{width: number, height: number}} size - Dimensions du document
 */
function parseLayer(raw, index, size) {
  const where = `Calque ${index}`;
  check(isPlainObject(raw), `${where} : objet attendu.`);
  const layer = /** @type {Record<string, unknown>} */ (raw);
  check(typeof layer.name === 'string' && layer.name.trim() !== '' && layer.name.length <= MAX_NAME_LENGTH,
    `${where} : nom absent ou trop long (${MAX_NAME_LENGTH} caractères au plus).`);
  check(typeof layer.visible === 'boolean' && typeof layer.locked === 'boolean', `${where} : visibilité ou verrou invalide.`);
  check(typeof layer.opacity === 'number' && layer.opacity >= 0 && layer.opacity <= 1, `${where} : opacité hors de [0, 1].`);
  check(isBlendMode(layer.blend), `${where} : mode de fusion inconnu.`);
  check(typeof layer.image === 'string' && PNG_DATA_URL.test(layer.image), `${where} : image PNG (data URL base64) attendue.`);
  // Les dimensions réelles sont lues avant tout décodage : un PNG minuscule
  // une fois compressé peut cacher une image géante (bombe de décompression).
  const png = readPngSize(/** @type {string} */ (layer.image));
  check(png !== null, `${where} : en-tête PNG invalide.`);
  check(png.width === size.width && png.height === size.height,
    `${where} : image de ${png.width} × ${png.height} px au lieu de ${size.width} × ${size.height}.`);
  return {
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    blend: /** @type {string} */ (layer.blend),
    image: /** @type {string} */ (layer.image),
  };
}

/**
 * Décode et valide un projet.
 * @param {string} text - Contenu du fichier
 * @param {{maxChars?: number}} [limits] - Taille maximale acceptée (caractères)
 * @returns {ReturnType<typeof buildProject>}
 * @throws {ProjectFormatError} Fichier invalide, d'une autre application ou d'une version future
 */
export function parseProject(text, limits = {}) {
  check(typeof text === 'string', 'Le fichier projet doit être du texte.');
  check(text.length <= (limits.maxChars ?? MAX_PROJECT_CHARS), 'Fichier projet trop volumineux.');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProjectFormatError('Ce fichier n\'est pas un JSON valide.');
  }
  checkHeader(raw);
  const layers = raw.layers.map((layer, i) => parseLayer(layer, i + 1, raw));
  const activeLayer = Number.isInteger(raw.activeLayer) && raw.activeLayer >= 0 && raw.activeLayer < layers.length
    ? raw.activeLayer
    : layers.length - 1;
  return buildProject({ width: raw.width, height: raw.height, activeLayer, layers });
}

/**
 * Texte du projet à enregistrer, refusé s'il ne pourrait pas être rouvert.
 * @param {ReturnType<typeof buildProject>} project
 * @param {{maxChars?: number}} [limits]
 * @returns {string}
 * @throws {ProjectFormatError} Projet trop lourd (au-delà de la limite de lecture ou d'une chaîne JavaScript)
 */
export function stringifyProject(project, limits = {}) {
  const tooHeavy = 'Projet trop lourd pour être enregistré : réduisez le nombre de calques ou la taille du document.';
  let text;
  try {
    text = JSON.stringify(project);
  } catch (error) {
    // RangeError : chaîne plus longue que ce que le moteur JavaScript accepte.
    if (error instanceof RangeError) {
      throw new ProjectFormatError(tooHeavy);
    }
    throw error;
  }
  check(text.length <= (limits.maxChars ?? MAX_PROJECT_CHARS), tooHeavy);
  return text;
}

/**
 * Vérifie l'identité, la version, la taille et le nombre de calques.
 * @param {any} raw - JSON décodé
 */
function checkHeader(raw) {
  check(isPlainObject(raw) && raw.format === PROJECT_FORMAT, 'Ce fichier n\'est pas un projet Paint Studio.');
  check(Number.isInteger(raw.version) && raw.version >= 1, 'Version de projet invalide.');
  check(raw.version <= PROJECT_VERSION, `Projet créé par une version plus récente (v${raw.version}) : mettez l'outil à jour.`);
  check(isValidSize(raw.width, raw.height), 'Dimensions du document invalides.');
  check(Array.isArray(raw.layers) && raw.layers.length >= 1 && raw.layers.length <= MAX_LAYERS,
    `Le projet doit contenir entre 1 et ${MAX_LAYERS} calques.`);
}
