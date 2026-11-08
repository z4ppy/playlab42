/**
 * Modèle de document : opérations de calques réversibles et patches de pixels.
 */

import { History, createPixelPatch } from '../src/core/history.js';
import { isTransparent, isValidSize, MAX_LAYERS, PaintDocument, solidBuffer } from '../src/core/document.js';
import { createMemorySurface, filled, pixelAt } from './helpers/memory-surface.js';

function newDoc(width = 4, height = 3) {
  const doc = new PaintDocument({ width, height, createSurface: createMemorySurface });
  const background = doc.createLayer({ name: 'Fond', buffer: solidBuffer(width, height) });
  doc.layers.push(background);
  doc.activeId = background.id;
  return doc;
}

/** Applique une opération et l'enregistre, comme le fait l'application. */
function run(doc, history, entry) {
  history.push(entry);
  return entry;
}

function undo(doc, history) {
  doc.apply(history.undo(), 'undo');
}

function redo(doc, history) {
  doc.apply(history.redo(), 'redo');
}

const names = (doc) => doc.layers.map((layer) => layer.name);

describe('création', () => {
  it('valide la taille', () => {
    expect(() => new PaintDocument({ width: 0, height: 10, createSurface: createMemorySurface })).toThrow(RangeError);
    expect(isValidSize(4096, 1)).toBe(true);
    expect(isValidSize(4097, 1)).toBe(false);
    expect(isValidSize(1.5, 1)).toBe(false);
  });

  it('crée un fond blanc et des noms uniques', () => {
    const doc = newDoc();
    expect(pixelAt(doc.layers[0].surface, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(doc.defaultName()).toBe('Calque 2');
    doc.layers.push(doc.createLayer({ name: 'Calque 2' }));
    expect(doc.defaultName()).toBe('Calque 3');
  });

  it('détecte un tampon transparent', () => {
    expect(isTransparent(solidBuffer(2, 2, { r: 0, g: 0, b: 0, a: 0 }))).toBe(true);
    expect(isTransparent(solidBuffer(2, 2))).toBe(false);
  });
});

describe('opérations de calques avec annuler / rétablir', () => {
  it('ajoute au-dessus du calque actif, annule et rétablit', () => {
    const doc = newDoc();
    const history = new History();
    run(doc, history, doc.addLayer());
    expect(names(doc)).toEqual(['Fond', 'Calque 2']);
    expect(doc.activeLayer.name).toBe('Calque 2');
    undo(doc, history);
    expect(names(doc)).toEqual(['Fond']);
    expect(doc.activeLayer.name).toBe('Fond');
    redo(doc, history);
    expect(names(doc)).toEqual(['Fond', 'Calque 2']);
  });

  it('refuse d\'ajouter au-delà de la limite', () => {
    const doc = newDoc(1, 1);
    for (let i = 1; i < MAX_LAYERS; i++) {
      expect(doc.addLayer()).not.toBeNull();
    }
    expect(doc.addLayer()).toBeNull();
  });

  it('duplique avec les pixels et les propriétés', () => {
    const doc = newDoc();
    doc.updateLayer(doc.layers[0].id, { opacity: 0.5, blend: 'multiply' });
    const entry = doc.duplicateLayer(doc.layers[0].id);
    expect(entry.label).toBe('Dupliquer le calque');
    expect(names(doc)).toEqual(['Fond', 'Fond (copie)']);
    expect(doc.layers[1].opacity).toBe(0.5);
    expect(doc.layers[1].blend).toBe('multiply');
    expect(doc.layers[1].id).not.toBe(doc.layers[0].id);
    expect(pixelAt(doc.layers[1].surface, 3, 2)).toEqual([255, 255, 255, 255]);
    expect(doc.duplicateLayer('absent')).toBeNull();
  });

  it('supprime un calque et le restaure avec ses pixels', () => {
    const doc = newDoc();
    const history = new History();
    run(doc, history, doc.addLayer({ name: 'Encre', buffer: filled(4, 3, [1, 2, 3, 255]) }));
    const id = doc.activeLayer.id;
    run(doc, history, doc.removeLayer(id));
    expect(names(doc)).toEqual(['Fond']);
    expect(doc.activeLayer.name).toBe('Fond');
    undo(doc, history);
    expect(names(doc)).toEqual(['Fond', 'Encre']);
    expect(doc.getLayer(id)).not.toBeNull();
    expect(pixelAt(doc.getLayer(id).surface, 1, 1)).toEqual([1, 2, 3, 255]);
    redo(doc, history);
    expect(names(doc)).toEqual(['Fond']);
  });

  it('garde toujours au moins un calque', () => {
    const doc = newDoc();
    expect(doc.removeLayer(doc.layers[0].id)).toBeNull();
    expect(doc.removeLayer('absent')).toBeNull();
  });

  it('réordonne et annule le déplacement', () => {
    const doc = newDoc();
    const history = new History();
    doc.addLayer({ name: 'A' });
    doc.addLayer({ name: 'B' });
    run(doc, history, doc.moveLayer(doc.layers[2].id, 0));
    expect(names(doc)).toEqual(['B', 'Fond', 'A']);
    undo(doc, history);
    expect(names(doc)).toEqual(['Fond', 'A', 'B']);
    redo(doc, history);
    expect(names(doc)).toEqual(['B', 'Fond', 'A']);
    expect(doc.moveLayer(doc.layers[0].id, -5)).toBeNull();
    expect(doc.moveLayer('absent', 1)).toBeNull();
  });

  it('modifie les propriétés valides seulement, de façon réversible', () => {
    const doc = newDoc();
    const history = new History();
    const id = doc.layers[0].id;
    const entry = doc.updateLayer(id, { name: 'Papier', opacity: 0.25, visible: false, locked: true, blend: 'screen', id: 'pirate', extra: 1 });
    run(doc, history, entry);
    expect(entry.after).toEqual({ name: 'Papier', opacity: 0.25, visible: false, locked: true, blend: 'screen' });
    expect(doc.layers[0].id).toBe(id);
    undo(doc, history);
    expect(doc.layers[0]).toMatchObject({ name: 'Fond', opacity: 1, visible: true, locked: false, blend: 'source-over' });
    redo(doc, history);
    expect(doc.layers[0].name).toBe('Papier');
    expect(doc.updateLayer(id, { name: '   ', opacity: 2, blend: 'plasma' })).toBeNull();
    expect(doc.updateLayer(id, { name: 'Papier' })).toBeNull();
    expect(doc.updateLayer('absent', { name: 'x' })).toBeNull();
  });

  it('fusionne vers le bas avec opacité et mode, et annule', () => {
    const doc = newDoc(2, 1);
    const history = new History();
    run(doc, history, doc.addLayer({ name: 'Rouge', buffer: filled(2, 1, [255, 0, 0, 255]), opacity: 0.5 }));
    const upperId = doc.activeLayer.id;
    run(doc, history, doc.mergeDown(upperId));
    expect(names(doc)).toEqual(['Fond']);
    expect(pixelAt(doc.layers[0].surface, 0, 0)).toEqual([255, 128, 128, 255]);
    undo(doc, history);
    expect(names(doc)).toEqual(['Fond', 'Rouge']);
    expect(pixelAt(doc.layers[0].surface, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(doc.getLayer(upperId).opacity).toBe(0.5);
    redo(doc, history);
    expect(pixelAt(doc.layers[0].surface, 1, 0)).toEqual([255, 128, 128, 255]);
    expect(doc.activeLayer.name).toBe('Fond');
  });

  it('refuse la fusion du calque du bas, masqué, ou vers un calque verrouillé', () => {
    const doc = newDoc();
    expect(doc.mergeDown(doc.layers[0].id)).toBeNull();
    doc.addLayer({ name: 'Caché', visible: false });
    expect(doc.mergeDown(doc.layers[1].id)).toBeNull();
    doc.updateLayer(doc.layers[1].id, { visible: true });
    doc.updateLayer(doc.layers[0].id, { locked: true });
    expect(doc.mergeDown(doc.layers[1].id)).toBeNull();
  });

  it('aplatit les calques visibles (mode produit) et annule', () => {
    const doc = newDoc(1, 1);
    const history = new History();
    doc.addLayer({ name: 'Jaune', buffer: filled(1, 1, [255, 255, 0, 255]) });
    doc.addLayer({ name: 'Cyan', buffer: filled(1, 1, [0, 255, 255, 255]), blend: 'multiply' });
    doc.addLayer({ name: 'Masqué', buffer: filled(1, 1, [0, 0, 0, 255]), visible: false });
    run(doc, history, doc.flatten());
    expect(names(doc)).toEqual(['Fond']);
    expect(pixelAt(doc.layers[0].surface, 0, 0)).toEqual([0, 255, 0, 255]);
    undo(doc, history);
    expect(names(doc)).toEqual(['Fond', 'Jaune', 'Cyan', 'Masqué']);
    expect(doc.layers[2].blend).toBe('multiply');
    redo(doc, history);
    expect(doc.layers).toHaveLength(1);
    expect(doc.flatten()).toBeNull();
  });

  it('crée des identifiants neufs après une restauration', () => {
    const doc = newDoc();
    const history = new History();
    doc.addLayer();
    run(doc, history, doc.flatten());
    undo(doc, history);
    doc.addLayer();
    const ids = doc.layers.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('redimensionnement du canevas', () => {
  it('ancre le contenu et annule', () => {
    const doc = newDoc(2, 2);
    const history = new History();
    doc.layers[0].surface.write(filled(1, 1, [9, 9, 9, 255]), 1, 1);
    run(doc, history, doc.resizeCanvas(4, 4, 'top-left'));
    expect([doc.width, doc.height]).toEqual([4, 4]);
    expect(pixelAt(doc.layers[0].surface, 1, 1)).toEqual([9, 9, 9, 255]);
    expect(pixelAt(doc.layers[0].surface, 3, 3)).toEqual([0, 0, 0, 0]);
    undo(doc, history);
    expect([doc.width, doc.height]).toEqual([2, 2]);
    redo(doc, history);
    run(doc, history, doc.resizeCanvas(2, 2, 'bottom-right'));
    expect(pixelAt(doc.layers[0].surface, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('refuse une taille invalide ou identique', () => {
    const doc = newDoc(2, 2);
    expect(doc.resizeCanvas(2, 2, 'center')).toBeNull();
    expect(doc.resizeCanvas(0, 2, 'center')).toBeNull();
  });
});

describe('patches de pixels', () => {
  it('annule et rétablit plusieurs tracés successifs', () => {
    const doc = newDoc(4, 4);
    const history = new History();
    const layer = doc.layers[0];
    const paint = (x, y, rgba) => {
      const rect = { x, y, width: 2, height: 2 };
      const before = layer.surface.read(rect);
      layer.surface.write(filled(2, 2, rgba), x, y);
      run(doc, history, createPixelPatch(layer.id, rect, before, layer.surface.read(rect)));
    };
    paint(0, 0, [255, 0, 0, 255]);
    paint(1, 1, [0, 0, 255, 255]);
    expect(pixelAt(layer.surface, 1, 1)).toEqual([0, 0, 255, 255]);
    undo(doc, history);
    expect(pixelAt(layer.surface, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(layer.surface, 2, 2)).toEqual([255, 255, 255, 255]);
    undo(doc, history);
    expect(pixelAt(layer.surface, 0, 0)).toEqual([255, 255, 255, 255]);
    redo(doc, history);
    redo(doc, history);
    expect(pixelAt(layer.surface, 2, 2)).toEqual([0, 0, 255, 255]);
  });

  it('refuse une entrée inconnue', () => {
    expect(() => newDoc().apply({ kind: 'magie' }, 'undo')).toThrow(TypeError);
  });

  it('expose l\'état complet et le recharge', () => {
    const doc = newDoc(2, 2);
    doc.addLayer({ name: 'Vide' });
    const state = doc.state();
    expect(state.layers[1].buffer).toBeNull();
    const copy = new PaintDocument({ width: 1, height: 1, createSurface: createMemorySurface });
    copy.loadState(state);
    expect(names(copy)).toEqual(['Fond', 'Vide']);
    expect(copy.activeLayer.name).toBe('Vide');
    copy.setActive('absent');
    expect(copy.activeLayer.name).toBe('Vide');
    copy.setActive(copy.layers[0].id);
    expect(copy.activeLayer.name).toBe('Fond');
  });
});
