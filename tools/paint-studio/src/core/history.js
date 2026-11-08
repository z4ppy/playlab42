/**
 * Historique annuler/rétablir à mémoire bornée, et patches de pixels.
 *
 * Une modification de pixels n'enregistre pas une copie du calque mais un
 * « patch » : le rectangle englobant de la zone modifiée, avec ses pixels
 * avant et après. Le patch est encore réduit au rectangle des pixels qui ont
 * réellement changé. Annuler réécrit « avant », rétablir réécrit « après ».
 *
 * L'historique compte les octets retenus : au-delà de la limite, les plus
 * anciennes entrées sont oubliées (la plus récente est toujours conservée).
 */

/**
 * @typedef {{width: number, height: number, data: Uint8ClampedArray}} PixelBuffer
 * @typedef {{x: number, y: number, width: number, height: number}} Rect
 * @typedef {{label: string, bytes: number}} HistoryEntry
 */

/** Limite mémoire par défaut : adaptée à un téléphone récent. */
export const DEFAULT_HISTORY_BYTES = 160 * 1024 * 1024;
/** Nombre maximal d'étapes, même pour des patches minuscules. */
export const DEFAULT_HISTORY_ENTRIES = 200;

/**
 * Copie un rectangle (entier, inclus dans le tampon) d'un tampon de pixels.
 * @param {PixelBuffer} buffer
 * @param {Rect} rect
 * @returns {PixelBuffer}
 */
export function extractRect(buffer, rect) {
  const out = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row++) {
    const start = ((rect.y + row) * buffer.width + rect.x) * 4;
    out.set(buffer.data.subarray(start, start + rect.width * 4), row * rect.width * 4);
  }
  return { width: rect.width, height: rect.height, data: out };
}

/**
 * Écrit un tampon dans un autre à la position (x, y), en ignorant ce qui déborde.
 * @param {PixelBuffer} target - Modifié en place
 * @param {PixelBuffer} source
 * @param {number} x
 * @param {number} y
 */
export function writeRect(target, source, x, y) {
  const left = Math.max(0, -x);
  const right = Math.min(source.width, target.width - x);
  if (right <= left) {
    return;
  }
  for (let row = Math.max(0, -y); row < source.height && y + row < target.height; row++) {
    const from = (row * source.width + left) * 4;
    const to = ((y + row) * target.width + x + left) * 4;
    target.data.set(source.data.subarray(from, from + (right - left) * 4), to);
  }
}

/** Vrai si la ligne `row` diffère entre deux tampons de même forme. */
function rowDiffers(a, b, row) {
  const start = row * a.width * 4;
  for (let i = start; i < start + a.width * 4; i++) {
    if (a.data[i] !== b.data[i]) {
      return true;
    }
  }
  return false;
}

/** Vrai si la colonne `column` diffère entre deux tampons, sur [top, bottom]. */
function columnDiffers(a, b, column, top, bottom) {
  for (let row = top; row <= bottom; row++) {
    const i = (row * a.width + column) * 4;
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1]
      || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) {
      return true;
    }
  }
  return false;
}

/**
 * Plus petit rectangle (relatif aux tampons) contenant tous les pixels différents.
 * @param {PixelBuffer} before
 * @param {PixelBuffer} after - Même largeur et hauteur que before
 * @returns {Rect|null} null si aucun pixel n'a changé
 */
export function diffBounds(before, after) {
  let top = 0;
  while (top < before.height && !rowDiffers(before, after, top)) {
    top++;
  }
  if (top === before.height) {
    return null;
  }
  let bottom = before.height - 1;
  while (!rowDiffers(before, after, bottom)) {
    bottom--;
  }
  let left = 0;
  while (!columnDiffers(before, after, left, top, bottom)) {
    left++;
  }
  let right = before.width - 1;
  while (!columnDiffers(before, after, right, top, bottom)) {
    right--;
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Crée un patch de pixels réduit aux pixels modifiés.
 * @param {string} layerId
 * @param {Rect} rect - Position des tampons dans le calque
 * @param {PixelBuffer} before
 * @param {PixelBuffer} after
 * @param {string} [label]
 * @returns {null|{kind: 'pixels', label: string, layerId: string, rect: Rect, before: PixelBuffer, after: PixelBuffer, bytes: number}}
 *   null si rien n'a changé (aucune étape inutile dans l'historique)
 */
export function createPixelPatch(layerId, rect, before, after, label = 'Dessin') {
  const changed = diffBounds(before, after);
  if (!changed) {
    return null;
  }
  const tight = changed.width === before.width && changed.height === before.height;
  return {
    kind: 'pixels',
    label,
    layerId,
    rect: { x: rect.x + changed.x, y: rect.y + changed.y, width: changed.width, height: changed.height },
    before: tight ? before : extractRect(before, changed),
    after: tight ? after : extractRect(after, changed),
    bytes: changed.width * changed.height * 8,
  };
}

/**
 * Pile annuler/rétablir. Les entrées sont opaques : l'appelant sait les appliquer.
 * @template {HistoryEntry} T
 */
export class History {
  /**
   * @param {{maxBytes?: number, maxEntries?: number}} [options]
   */
  constructor(options = {}) {
    this.maxBytes = options.maxBytes ?? DEFAULT_HISTORY_BYTES;
    this.maxEntries = options.maxEntries ?? DEFAULT_HISTORY_ENTRIES;
    /** @type {T[]} */
    this.entries = [];
    /** Nombre d'entrées appliquées (les suivantes sont « à rétablir »). */
    this.cursor = 0;
    this.usedBytes = 0;
  }

  /**
   * Enregistre une étape : l'avenir « à rétablir » est abandonné.
   * @param {T|null} entry - null est ignoré
   */
  push(entry) {
    if (!entry) {
      return;
    }
    for (const dropped of this.entries.splice(this.cursor)) {
      this.usedBytes -= dropped.bytes;
    }
    this.entries.push(entry);
    this.usedBytes += entry.bytes;
    this.cursor = this.entries.length;
    this.enforceLimits();
  }

  /** Oublie les plus anciennes étapes tant qu'une limite est dépassée. */
  enforceLimits() {
    while (this.entries.length > 1
      && (this.usedBytes > this.maxBytes || this.entries.length > this.maxEntries)) {
      const dropped = /** @type {T} */ (this.entries.shift());
      this.usedBytes -= dropped.bytes;
      this.cursor--;
    }
  }

  get canUndo() {
    return this.cursor > 0;
  }

  get canRedo() {
    return this.cursor < this.entries.length;
  }

  /**
   * Recule d'une étape.
   * @returns {T|null} L'entrée à défaire, ou null
   */
  undo() {
    if (!this.canUndo) {
      return null;
    }
    this.cursor--;
    return this.entries[this.cursor];
  }

  /**
   * Avance d'une étape.
   * @returns {T|null} L'entrée à refaire, ou null
   */
  redo() {
    if (!this.canRedo) {
      return null;
    }
    this.cursor++;
    return this.entries[this.cursor - 1];
  }

  /** Libellés des prochaines actions, pour les infobulles. */
  peekLabels() {
    return {
      undo: this.canUndo ? this.entries[this.cursor - 1].label : null,
      redo: this.canRedo ? this.entries[this.cursor].label : null,
    };
  }

  /** Vide l'historique (nouveau document, ouverture). */
  clear() {
    this.entries = [];
    this.cursor = 0;
    this.usedBytes = 0;
  }
}
