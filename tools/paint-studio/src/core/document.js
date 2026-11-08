/**
 * Modèle du document : pile de calques et opérations réversibles.
 *
 * Le modèle ne dépend pas du DOM : les pixels de chaque calque vivent dans une
 * « surface » fournie par une fabrique (canvas dans le navigateur, tampon
 * mémoire dans les tests). Chaque opération modifie le document et renvoie une
 * entrée d'historique décrivant comment la défaire et la refaire ; `apply`
 * rejoue une entrée dans un sens ou dans l'autre.
 */

import { DEFAULT_BLEND, isBlendMode } from './blend.js';
import { anchorOffset } from './geometry.js';

/**
 * @typedef {{width: number, height: number, data: Uint8ClampedArray}} PixelBuffer
 * @typedef {{x: number, y: number, width: number, height: number}} Rect
 *
 * @typedef {object} Surface - Pixels d'un calque
 * @property {number} width
 * @property {number} height
 * @property {(rect: Rect) => PixelBuffer} read - Copie d'un rectangle inclus dans la surface
 * @property {(buffer: PixelBuffer, x: number, y: number) => void} write - Remplace des pixels
 * @property {(source: Surface, opacity: number, mode: string) => void} composite
 *   Dessine `source` par-dessus, avec opacité et mode de fusion
 *
 * @typedef {object} Layer
 * @property {string} id
 * @property {string} name
 * @property {boolean} visible
 * @property {boolean} locked
 * @property {number} opacity - Dans [0, 1]
 * @property {string} blend - Mode de fusion (voir blend.js)
 * @property {Surface} surface
 *
 * @typedef {Omit<Layer, 'surface'> & {buffer: PixelBuffer|null}} LayerSnapshot
 *   buffer null : calque entièrement transparent (rien à mémoriser)
 */

/** Nombre maximal de calques (mémoire d'un téléphone). */
export const MAX_LAYERS = 32;
/** Côté maximal du document, en pixels. */
export const MAX_SIZE = 4096;
/** Longueur maximale d'un nom de calque. */
export const MAX_NAME_LENGTH = 64;

/** Propriétés modifiables d'un calque, avec leur validation. */
const LAYER_PROPS = {
  name: (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_NAME_LENGTH,
  visible: (value) => typeof value === 'boolean',
  locked: (value) => typeof value === 'boolean',
  opacity: (value) => typeof value === 'number' && value >= 0 && value <= 1,
  blend: isBlendMode,
};

/**
 * Vrai si les dimensions sont des entiers dans [1, MAX_SIZE].
 * @param {unknown} width
 * @param {unknown} height
 */
export function isValidSize(width, height) {
  const valid = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_SIZE;
  return valid(width) && valid(height);
}

/**
 * Vrai si aucun pixel n'est visible (alpha nul partout).
 * @param {PixelBuffer} buffer
 */
export function isTransparent(buffer) {
  for (let i = 3; i < buffer.data.length; i += 4) {
    if (buffer.data[i] !== 0) {
      return false;
    }
  }
  return true;
}

/** Tampon uni (blanc opaque par défaut, transparent si color.a = 0). */
export function solidBuffer(width, height, color = { r: 255, g: 255, b: 255, a: 255 }) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
    data[i + 3] = color.a;
  }
  return { width, height, data };
}

export class PaintDocument {
  /**
   * @param {{width: number, height: number, createSurface: (w: number, h: number) => Surface}} options
   */
  constructor({ width, height, createSurface }) {
    if (!isValidSize(width, height)) {
      throw new RangeError(`Taille de document invalide : ${width} x ${height}`);
    }
    this.width = width;
    this.height = height;
    this.createSurface = createSurface;
    /** @type {Layer[]} Du bas (index 0) vers le haut. */
    this.layers = [];
    /** @type {string|null} */
    this.activeId = null;
    this.nextId = 1;
  }

  /** Calque actif (le plus haut si l'identifiant a disparu). */
  get activeLayer() {
    return this.getLayer(this.activeId) ?? this.layers[this.layers.length - 1] ?? null;
  }

  /** @param {string|null} id */
  getLayer(id) {
    return this.layers.find((layer) => layer.id === id) ?? null;
  }

  /** @param {string} id */
  indexOf(id) {
    return this.layers.findIndex((layer) => layer.id === id);
  }

  /** @param {string} id */
  setActive(id) {
    if (this.getLayer(id)) {
      this.activeId = id;
    }
  }

  /** Nom unique « Calque N » pour un nouveau calque. */
  defaultName() {
    const names = new Set(this.layers.map((layer) => layer.name));
    let n = this.layers.length + 1;
    while (names.has(`Calque ${n}`)) {
      n++;
    }
    return `Calque ${n}`;
  }

  /**
   * Fige un calque (propriétés et pixels) pour l'historique ou la sauvegarde.
   * @param {Layer} layer
   * @returns {LayerSnapshot}
   */
  snapshot(layer) {
    const buffer = layer.surface.read({ x: 0, y: 0, width: this.width, height: this.height });
    const { id, name, visible, locked, opacity, blend } = layer;
    return { id, name, visible, locked, opacity, blend, buffer: isTransparent(buffer) ? null : buffer };
  }

  /**
   * Reconstruit un calque à partir d'un instantané.
   * @param {LayerSnapshot} snap
   * @returns {Layer}
   */
  restore(snap) {
    const { buffer, ...props } = snap;
    const surface = this.createSurface(this.width, this.height);
    if (buffer) {
      surface.write(buffer, 0, 0);
    }
    return { ...props, surface };
  }

  /** Octets retenus par un instantané. */
  static snapshotBytes(snap) {
    return snap.buffer ? snap.buffer.data.byteLength : 0;
  }

  /**
   * Crée un calque sans l'enregistrer dans l'historique (document neuf, ouverture).
   * @param {Partial<LayerSnapshot>} [init]
   * @returns {Layer}
   */
  createLayer(init = {}) {
    const id = `layer-${this.nextId++}`;
    return this.restore({
      id,
      name: init.name ?? this.defaultName(),
      visible: init.visible ?? true,
      locked: init.locked ?? false,
      opacity: init.opacity ?? 1,
      blend: init.blend ?? DEFAULT_BLEND,
      buffer: init.buffer ?? null,
    });
  }

  // ---------------------------------------------------------------- calques

  /**
   * Ajoute un calque au-dessus du calque actif (ou à l'index donné).
   * @param {Partial<LayerSnapshot> & {index?: number}} [init]
   * @returns {object|null} Entrée d'historique, null si la limite est atteinte
   */
  addLayer(init = {}) {
    if (this.layers.length >= MAX_LAYERS) {
      return null;
    }
    const index = init.index ?? this.indexOf(this.activeLayer?.id ?? '') + 1;
    const layer = this.createLayer(init);
    this.insertAt(index, layer);
    const snap = this.snapshot(layer);
    return { kind: 'layer-insert', label: init.label ?? 'Nouveau calque', index, snapshot: snap, bytes: PaintDocument.snapshotBytes(snap) };
  }

  /**
   * Duplique un calque juste au-dessus de lui.
   * @param {string} id
   */
  duplicateLayer(id) {
    const source = this.getLayer(id);
    if (!source) {
      return null;
    }
    const snap = this.snapshot(source);
    return this.addLayer({ ...snap, name: `${source.name} (copie)`.slice(0, MAX_NAME_LENGTH), index: this.indexOf(id) + 1, label: 'Dupliquer le calque' });
  }

  /**
   * Supprime un calque (le document garde toujours au moins un calque).
   * @param {string} id
   */
  removeLayer(id) {
    const index = this.indexOf(id);
    if (index < 0 || this.layers.length <= 1) {
      return null;
    }
    const snap = this.snapshot(this.layers[index]);
    this.removeAt(index);
    return { kind: 'layer-delete', label: 'Supprimer le calque', index, snapshot: snap, bytes: PaintDocument.snapshotBytes(snap) };
  }

  /**
   * Déplace un calque dans la pile.
   * @param {string} id
   * @param {number} to - Index cible (borné)
   */
  moveLayer(id, to) {
    const from = this.indexOf(id);
    const target = Math.max(0, Math.min(this.layers.length - 1, to));
    if (from < 0 || from === target) {
      return null;
    }
    this.move(from, target);
    return { kind: 'layer-move', label: 'Déplacer le calque', from, to: target, bytes: 0 };
  }

  /**
   * Modifie des propriétés (nom, visibilité, verrou, opacité, mode).
   * Les valeurs invalides ou inchangées sont ignorées.
   * @param {string} id
   * @param {Partial<Omit<Layer, 'id'|'surface'>>} props
   */
  updateLayer(id, props) {
    const layer = this.getLayer(id);
    if (!layer) {
      return null;
    }
    const before = {};
    const after = {};
    for (const [key, value] of Object.entries(props)) {
      if (Object.hasOwn(LAYER_PROPS, key) && LAYER_PROPS[key](value) && layer[key] !== value) {
        before[key] = layer[key];
        after[key] = value;
      }
    }
    if (Object.keys(after).length === 0) {
      return null;
    }
    Object.assign(layer, after);
    return { kind: 'layer-props', label: 'Propriétés du calque', layerId: id, before, after, bytes: 0 };
  }

  /**
   * Fusionne un calque dans celui du dessous (opacité et mode appliqués).
   * Refusé si le calque est en bas, masqué, ou si celui du dessous est verrouillé.
   * @param {string} id
   */
  mergeDown(id) {
    const index = this.indexOf(id);
    const upper = this.layers[index];
    const lower = this.layers[index - 1];
    if (index < 1 || !upper.visible || lower.locked) {
      return null;
    }
    const whole = { x: 0, y: 0, width: this.width, height: this.height };
    const lowerBefore = lower.surface.read(whole);
    const snap = this.snapshot(upper);
    lower.surface.composite(upper.surface, upper.opacity, upper.blend);
    const lowerAfter = lower.surface.read(whole);
    this.removeAt(index);
    this.activeId = lower.id;
    return {
      kind: 'merge-down', label: 'Fusionner vers le bas', index, snapshot: snap, lowerId: lower.id, lowerBefore, lowerAfter,
      bytes: PaintDocument.snapshotBytes(snap) + lowerBefore.data.byteLength * 2,
    };
  }

  /**
   * Aplatit les calques visibles en un seul calque opaque ou non (les calques masqués disparaissent).
   */
  flatten() {
    if (this.layers.length <= 1) {
      return null;
    }
    const before = this.state();
    const result = this.createLayer({ name: this.layers[0].name });
    for (const layer of this.layers.filter((item) => item.visible)) {
      result.surface.composite(layer.surface, layer.opacity, layer.blend);
    }
    this.layers = [result];
    this.activeId = result.id;
    return this.replaceEntry('Aplatir l\'image', before);
  }

  /**
   * Redimensionne le canevas sans mise à l'échelle : le contenu est ancré.
   * @param {number} width
   * @param {number} height
   * @param {string} anchor - Voir geometry.ANCHORS
   */
  resizeCanvas(width, height, anchor) {
    if (!isValidSize(width, height) || (width === this.width && height === this.height)) {
      return null;
    }
    const before = this.state();
    const { dx, dy } = anchorOffset(this, { width, height }, anchor);
    this.width = width;
    this.height = height;
    this.layers = before.layers.map((snap) => {
      const layer = this.restore({ ...snap, buffer: null });
      if (snap.buffer) {
        layer.surface.write(snap.buffer, dx, dy);
      }
      return layer;
    });
    return this.replaceEntry('Taille du canevas', before);
  }

  /**
   * Entrée « remplacer tout l'état » à partir de l'état précédent.
   * @param {string} label
   * @param {ReturnType<PaintDocument['state']>} before
   */
  replaceEntry(label, before) {
    const after = this.state();
    const bytes = [...before.layers, ...after.layers].reduce((sum, snap) => sum + PaintDocument.snapshotBytes(snap), 0);
    return { kind: 'replace-all', label, before, after, bytes };
  }

  /** État complet (taille, calques, calque actif). */
  state() {
    return {
      width: this.width,
      height: this.height,
      activeId: this.activeLayer?.id ?? null,
      layers: this.layers.map((layer) => this.snapshot(layer)),
    };
  }

  /**
   * Remplace tout le document par un état (annulation d'aplatissement, ouverture).
   * @param {ReturnType<PaintDocument['state']>} state
   */
  loadState(state) {
    this.width = state.width;
    this.height = state.height;
    this.layers = state.layers.map((snap) => this.restore(snap));
    this.activeId = state.activeId;
    this.syncNextId();
  }

  /** Garantit des identifiants neufs après une restauration. */
  syncNextId() {
    for (const layer of this.layers) {
      const n = Number(/^layer-(\d+)$/.exec(layer.id)?.[1] ?? 0);
      this.nextId = Math.max(this.nextId, n + 1);
    }
  }

  // ---------------------------------------------------------------- pixels

  /**
   * Enregistre des pixels (rectangle d'un calque) ; utilisé pour annuler/rétablir.
   * @param {string} layerId
   * @param {Rect} rect
   * @param {PixelBuffer} buffer
   */
  writePixels(layerId, rect, buffer) {
    this.getLayer(layerId)?.surface.write(buffer, rect.x, rect.y);
  }

  // ------------------------------------------------------------- historique

  /**
   * Rejoue une entrée d'historique.
   * @param {any} entry
   * @param {'undo'|'redo'} direction
   */
  apply(entry, direction) {
    const handler = ENTRY_HANDLERS[entry.kind];
    if (!handler) {
      throw new TypeError(`Entrée d'historique inconnue : ${entry.kind}`);
    }
    handler[direction](this, entry);
  }

  // ------------------------------------------------------- primitives internes

  insertAt(index, layer) {
    this.layers.splice(Math.max(0, Math.min(this.layers.length, index)), 0, layer);
    this.activeId = layer.id;
  }

  removeAt(index) {
    const [removed] = this.layers.splice(index, 1);
    if (removed.id === this.activeId) {
      this.activeId = this.layers[Math.max(0, index - 1)]?.id ?? null;
    }
  }

  move(from, to) {
    const [layer] = this.layers.splice(from, 1);
    this.layers.splice(to, 0, layer);
  }
}

/** Réinsère un calque figé. */
const insertSnapshot = (doc, entry) => doc.insertAt(entry.index, doc.restore(entry.snapshot));
/** Retire le calque inséré par l'entrée. */
const removeSnapshot = (doc, entry) => doc.removeAt(entry.index);

/** Comment défaire / refaire chaque type d'entrée. */
const ENTRY_HANDLERS = {
  pixels: {
    undo: (doc, e) => doc.writePixels(e.layerId, e.rect, e.before),
    redo: (doc, e) => doc.writePixels(e.layerId, e.rect, e.after),
  },
  'layer-insert': { undo: removeSnapshot, redo: insertSnapshot },
  'layer-delete': { undo: insertSnapshot, redo: removeSnapshot },
  'layer-move': {
    undo: (doc, e) => doc.move(e.to, e.from),
    redo: (doc, e) => doc.move(e.from, e.to),
  },
  'layer-props': {
    undo: (doc, e) => Object.assign(doc.getLayer(e.layerId) ?? {}, e.before),
    redo: (doc, e) => Object.assign(doc.getLayer(e.layerId) ?? {}, e.after),
  },
  'merge-down': {
    undo: (doc, e) => {
      doc.writePixels(e.lowerId, { x: 0, y: 0 }, e.lowerBefore);
      insertSnapshot(doc, e);
    },
    redo: (doc, e) => {
      doc.writePixels(e.lowerId, { x: 0, y: 0 }, e.lowerAfter);
      removeSnapshot(doc, e);
      doc.activeId = e.lowerId;
    },
  },
  'replace-all': {
    undo: (doc, e) => doc.loadState(e.before),
    redo: (doc, e) => doc.loadState(e.after),
  },
};
