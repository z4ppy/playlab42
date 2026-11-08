/**
 * Historique : patches de zone modifiée, annuler/rétablir multiples, limite mémoire.
 */

import { createPixelPatch, diffBounds, extractRect, History, writeRect } from '../src/core/history.js';
import { filled } from './helpers/memory-surface.js';

const entry = (label, bytes = 10) => ({ label, bytes });

describe('extractRect / writeRect', () => {
  it('copie et réécrit un rectangle', () => {
    const buffer = filled(4, 3, [0, 0, 0, 0]);
    buffer.data.set([1, 2, 3, 4], (1 * 4 + 2) * 4);
    const part = extractRect(buffer, { x: 2, y: 1, width: 2, height: 2 });
    expect(part.width).toBe(2);
    expect([...part.data.slice(0, 4)]).toEqual([1, 2, 3, 4]);
    const target = filled(4, 3, [9, 9, 9, 9]);
    writeRect(target, part, 0, 0);
    expect([...target.data.slice(0, 4)]).toEqual([1, 2, 3, 4]);
  });

  it('ignore ce qui déborde, y compris en négatif', () => {
    const target = filled(3, 3, [0, 0, 0, 0]);
    writeRect(target, filled(2, 2, [5, 5, 5, 5]), -1, -1);
    expect([...target.data.slice(0, 4)]).toEqual([5, 5, 5, 5]);
    expect([...target.data.slice(4, 8)]).toEqual([0, 0, 0, 0]);
    writeRect(target, filled(2, 2, [7, 7, 7, 7]), 2, 2);
    expect([...target.data.slice(32, 36)]).toEqual([7, 7, 7, 7]);
    writeRect(target, filled(2, 2, [8, 8, 8, 8]), 5, 0);
    expect(target.data.includes(8)).toBe(false);
  });
});

describe('diffBounds et createPixelPatch', () => {
  it('réduit le patch au rectangle réellement modifié', () => {
    const before = filled(10, 10, [0, 0, 0, 0]);
    const after = filled(10, 10, [0, 0, 0, 0]);
    after.data.set([255, 0, 0, 255], (3 * 10 + 4) * 4);
    after.data.set([0, 0, 0, 1], (6 * 10 + 7) * 4);
    expect(diffBounds(before, after)).toEqual({ x: 4, y: 3, width: 4, height: 4 });
    const patch = createPixelPatch('layer-1', { x: 100, y: 50, width: 10, height: 10 }, before, after);
    expect(patch.rect).toEqual({ x: 104, y: 53, width: 4, height: 4 });
    expect(patch.bytes).toBe(4 * 4 * 8);
    expect(patch.before.width).toBe(4);
    expect([...patch.after.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  });

  it('ne crée aucune étape si rien n\'a changé', () => {
    const same = filled(5, 5, [1, 2, 3, 4]);
    expect(diffBounds(same, filled(5, 5, [1, 2, 3, 4]))).toBeNull();
    expect(createPixelPatch('l', { x: 0, y: 0, width: 5, height: 5 }, same, same)).toBeNull();
  });

  it('garde les tampons tels quels si tout a changé', () => {
    const before = filled(2, 2, [0, 0, 0, 0]);
    const after = filled(2, 2, [1, 1, 1, 1]);
    const patch = createPixelPatch('l', { x: 0, y: 0, width: 2, height: 2 }, before, after, 'Remplir');
    expect(patch.before).toBe(before);
    expect(patch.label).toBe('Remplir');
  });

  it('détecte un changement sur le seul canal alpha d\'une colonne', () => {
    const before = filled(3, 1, [0, 0, 0, 0]);
    const after = filled(3, 1, [0, 0, 0, 0]);
    after.data[2 * 4 + 3] = 9;
    expect(diffBounds(before, after)).toEqual({ x: 2, y: 0, width: 1, height: 1 });
  });
});

describe('History', () => {
  it('annule et rétablit plusieurs étapes dans l\'ordre', () => {
    const history = new History();
    history.push(entry('a'));
    history.push(entry('b'));
    history.push(entry('c'));
    expect(history.undo().label).toBe('c');
    expect(history.undo().label).toBe('b');
    expect(history.peekLabels()).toEqual({ undo: 'a', redo: 'b' });
    expect(history.redo().label).toBe('b');
    expect(history.redo().label).toBe('c');
    expect(history.redo()).toBeNull();
    expect(history.canRedo).toBe(false);
  });

  it('abandonne l\'avenir après une nouvelle action', () => {
    const history = new History();
    history.push(entry('a', 5));
    history.push(entry('b', 7));
    history.undo();
    history.push(entry('c', 3));
    expect(history.usedBytes).toBe(8);
    expect(history.canRedo).toBe(false);
    expect(history.undo().label).toBe('c');
    expect(history.undo().label).toBe('a');
    expect(history.undo()).toBeNull();
    expect(history.peekLabels()).toEqual({ undo: null, redo: 'a' });
  });

  it('ignore une entrée nulle', () => {
    const history = new History();
    history.push(null);
    expect(history.canUndo).toBe(false);
  });

  it('respecte la limite mémoire en oubliant les plus anciennes étapes', () => {
    const history = new History({ maxBytes: 100 });
    for (let i = 0; i < 10; i++) {
      history.push(entry(`e${i}`, 30));
    }
    expect(history.usedBytes).toBeLessThanOrEqual(100);
    expect(history.entries.map((e) => e.label)).toEqual(['e7', 'e8', 'e9']);
    expect(history.cursor).toBe(3);
  });

  it('garde toujours la dernière étape même si elle dépasse la limite seule', () => {
    const history = new History({ maxBytes: 10 });
    history.push(entry('petite', 5));
    history.push(entry('énorme', 500));
    expect(history.entries.map((e) => e.label)).toEqual(['énorme']);
    expect(history.undo().label).toBe('énorme');
  });

  it('respecte le nombre maximal d\'étapes', () => {
    const history = new History({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      history.push(entry(`e${i}`, 0));
    }
    expect(history.entries).toHaveLength(3);
    history.clear();
    expect(history.canUndo).toBe(false);
    expect(history.usedBytes).toBe(0);
  });
});
