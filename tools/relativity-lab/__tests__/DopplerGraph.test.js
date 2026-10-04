/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { DopplerGraph } from '../ui/DopplerGraph.js';
import { createContext2d } from './support/browser-boundary.js';

let ctx;
let resizeObservers;

beforeEach(() => {
  ctx = createContext2d();
  resizeObservers = [];
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 400, height: 200 });
  window.devicePixelRatio = 2;
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; resizeObservers.push(this); }
    observe() {}
  };
  document.body.innerHTML = '<div id="graph"></div>';
});

afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

const observers = (history = []) => [
  { id: 'lab', name: 'Lab', color: 0xffffff, properTime: 20, receptionHistory: history },
  { id: 'a', name: 'Alice', color: 0xff6b6b },
  { id: 'b', name: 'Bob' },
];

function create() {
  return new DopplerGraph(document.getElementById('graph'));
}

function draw(graph, list, referenceId = 'lab') {
  ctx.calls.length = 0;
  graph.update({ referenceId }, list);
  return ctx.calls;
}

describe('DopplerGraph : panneau', () => {
  test('dimensionne le canvas selon le conteneur et la densité de pixels', () => {
    const graph = create();
    expect(graph.canvas.width).toBe(800);
    expect(graph.canvas.height).toBe(400);
    expect(graph.canvas.style.width).toBe('400px');
    expect(ctx.calls).toContainEqual(['scale', 2, 2]);
    resizeObservers[0].callback();
    expect(graph.width).toBe(400);
  });

  test('le sélecteur fixe la fenêtre temporelle ou revient en automatique', () => {
    const graph = create();
    const select = document.getElementById('doppler-timewindow');
    select.value = '600';
    select.dispatchEvent(new Event('change'));
    expect(graph.timeWindowMode).toBe('600');
    expect(graph.timeWindow).toBe(600);
    select.value = 'auto';
    select.dispatchEvent(new Event('change'));
    expect(graph.timeWindowMode).toBe('auto');
    expect(graph.timeWindow).toBe(600);
  });

  test('setTimeWindow impose au moins une seconde', () => {
    const graph = create();
    graph.setTimeWindow(0);
    expect(graph.timeWindow).toBe(1);
    graph.setTimeWindow(42);
    expect(graph.timeWindow).toBe(42);
  });

  test.each([
    [0, 10], [29.9, 10], [30, 30], [179, 30], [180, 60], [599, 60],
    [600, 300], [3599, 300], [3600, 1800], [86399, 1800], [86400, 7200],
  ])('en mode auto, τ=%f choisit une fenêtre de %i s', (tau, expected) => {
    const graph = create();
    const list = observers();
    list[0].properTime = tau;
    draw(graph, list);
    expect(graph.timeWindow).toBe(expected);
  });

  test('en mode fixe, la fenêtre n’est pas adaptée', () => {
    const graph = create();
    graph.timeWindowMode = '10';
    graph.timeWindow = 77;
    draw(graph, observers());
    expect(graph.timeWindow).toBe(77);
  });

  test('sans observateur de référence, ne dessine rien', () => {
    const graph = create();
    expect(draw(graph, observers(), 'absent')).toEqual([]);
  });

  test('mémorise nom et couleur des sources hors référence', () => {
    const graph = create();
    draw(graph, observers());
    expect([...graph.sourceInfo]).toEqual([
      ['a', { name: 'Alice', color: '#ff6b6b' }],
      ['b', { name: 'Bob', color: '#4fc3f7' }],
    ]);
  });
});

describe('DopplerGraph : dessin', () => {
  test('affiche l’attente sans historique', () => {
    const graph = create();
    const calls = draw(graph, observers());
    expect(calls).toEqual(expect.arrayContaining([
      ['clearRect', 0, 0, 400, 200],
      ['fillRect', 0, 0, 400, 200],
      ['fillText', 'En attente de réceptions...', 200, 100],
    ]));
    expect(calls.some(([name]) => name === 'arc')).toBe(false);
    const empty = draw(graph, [{ ...observers()[0], receptionHistory: undefined }, observers()[1]]);
    expect(empty.some(([name, text]) => name === 'fillText' && text === 'En attente de réceptions...')).toBe(true);
  });

  test('sans source, dessine le fond et s’arrête avant les axes', () => {
    const graph = create();
    const calls = draw(graph, [observers([{ tau: 5, sourceId: 'a' }])[0]]);
    expect(calls.map(([name]) => name)).toEqual(['clearRect', 'set:fillStyle', 'fillRect']);
  });

  test('trace lignes de sources, noms de repli, graduations et ligne « maintenant »', () => {
    const graph = create();
    const list = observers([{ tau: 10, sourceId: 'a', dopplerFactor: 1, clockType: 'H' }]);
    list[2].name = '';
    const calls = draw(graph, list);
    const texts = calls.filter(([name]) => name === 'fillText').map(([, text]) => text);
    expect(texts).toEqual(['Alice', 'b', '10.0s', '12.0s', '14.0s', '16.0s', '18.0s', '20.0s', 'τ']);
    expect(calls.filter(([name]) => name === 'fillRect').slice(1)).toEqual([
      ['fillRect', 60, 10, 330, 82.5],
      ['fillRect', 60, 92.5, 330, 82.5],
    ]);
    expect(calls).toContainEqual(['setLineDash', [3, 3]]);
    expect(calls).toContainEqual(['moveTo', 390, 10]);
    expect(calls).toContainEqual(['lineTo', 390, 175]);
    expect(calls.at(-1)).toEqual(['fillText', 'τ', 387, 15]);
  });

  test('place les réceptions simples par type d’horloge avec leur couleur Doppler', () => {
    const graph = create();
    const calls = draw(graph, observers([
      { tau: 20, sourceId: 'a', dopplerFactor: 1, clockType: 'H' },
      { tau: 20, sourceId: 'b', dopplerFactor: 1.5, clockType: 'V' },
      { tau: 10, sourceId: 'a', dopplerFactor: 0.5, clockType: 'V' },
    ]));
    const arcs = calls.filter(([name]) => name === 'arc');
    expect(arcs).toEqual([
      ['arc', 390, 47.25, 4, 0, Math.PI * 2],
      ['arc', 390, 137.75, 4, 0, Math.PI * 2],
      ['arc', 60, 55.25, 4, 0, Math.PI * 2],
    ]);
    const fills = calls.filter(([name]) => name === 'set:fillStyle').map(([, value]) => value);
    expect(fills).toEqual(expect.arrayContaining(['rgb(74, 222, 128)', 'rgb(0, 122, 255)', 'rgb(255, 72, 0)']));
    const strokes = calls.filter(([name]) => name === 'set:strokeStyle').map(([, value]) => value);
    expect(strokes).toEqual(expect.arrayContaining(['rgba(255, 107, 107, 0.8)', 'rgba(74, 222, 128, 0.8)']));
  });

  test('représente une réception agrégée par une barre bornée', () => {
    const graph = create();
    const calls = draw(graph, observers([
      { tau: 15, sourceId: 'a', dopplerFactor: 1, aggregated: true, bucketSize: 0.1, tickNumber: 3 },
      { tau: 20, sourceId: 'b', dopplerFactor: 1, aggregated: true, bucketSize: 5, tickNumber: 100 },
    ]));
    const near = (call, expected) => expected.forEach((value, i) => expect(call[i + 1]).toBeCloseTo(value));
    const bars = calls.filter(([name], i) => name === 'fillRect' && calls[i - 1]?.[0] === 'set:globalAlpha');
    expect(bars).toHaveLength(2);
    near(bars[0], [223.35, 48.25, 3.3, 6]);
    near(bars[1], [307.5, 94.5, 165, 78.5]);
    const outlines = calls.filter(([name]) => name === 'strokeRect');
    expect(outlines).toHaveLength(2);
    near(outlines[0], [223.35, 48.25, 3.3, 6]);
    expect(calls.filter(([name, value]) => name === 'set:globalAlpha' && value === 0.7)).toHaveLength(2);
  });

  test('ignore les réceptions hors fenêtre ou d’une source inconnue', () => {
    const graph = create();
    const list = observers([
      { tau: 9.9, sourceId: 'a', dopplerFactor: 1 },
      { tau: 20.1, sourceId: 'a', dopplerFactor: 1 },
      { tau: 15, sourceId: 'inconnue', dopplerFactor: 1 },
    ]);
    expect(draw(graph, list).some(([name]) => name === 'arc')).toBe(false);
  });

  test.each([
    [5, '5.0s'], [59.94, '59.9s'], [60, '1m0s'], [3599, '59m59s'],
    [3600, '1h0m'], [86399, '23h59m'], [86400, '1j0h'], [90000, '1j1h'],
  ])('formate %f s en %s sur l’axe', (tau, label) => {
    const graph = create();
    graph.timeWindowMode = 'fixed';
    graph.timeWindow = 0.001;
    const list = observers([{ tau, sourceId: 'a', dopplerFactor: 1 }]);
    list[0].properTime = tau;
    const texts = draw(graph, list).filter(([name]) => name === 'fillText').map(([, text]) => text);
    expect(texts).toContain(label);
  });

  test('sérialise fidèlement une scène complète de dessin', () => {
    const graph = create();
    const calls = draw(graph, observers([
      { tau: 12, sourceId: 'a', dopplerFactor: 1.2, clockType: 'H' },
      { tau: 16, sourceId: 'b', dopplerFactor: 0.8, clockType: 'V' },
      { tau: 18, sourceId: 'a', dopplerFactor: 1, aggregated: true, bucketSize: 2, tickNumber: 4 },
    ]));
    expect(calls).toMatchSnapshot();
  });
});
