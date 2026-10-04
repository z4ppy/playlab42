/** @jest-environment jsdom */
import { createHash } from 'node:crypto';
import { TetrisEngine } from './engine.js';
import { TetrisRenderer, COLORS } from './renderer.js';

const engine = new TetrisEngine();
const sha = text => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** Canvas factice dont le contexte journalise chaque appel et affectation, dans l'ordre. */
function fakeCanvas(name, log, ratio) {
  const context = new Proxy({}, {
    get: (_, key) => (...args) => log.push(`${name}.${String(key)}(${args.join(',')})`),
    set: (_, key, value) => { log.push(`${name}.${String(key)}=${value}`); return true; },
  });
  const labels = {};
  return {
    width: 0, height: 0, labels,
    ownerDocument: { defaultView: { devicePixelRatio: ratio } },
    getContext: () => context,
    setAttribute: (key, value) => { labels[key] = value; },
  };
}

function render(state, ratio = 1) {
  const log = [];
  const canvases = { board: fakeCanvas('board', log, ratio), hold: fakeCanvas('hold', log, ratio), next: fakeCanvas('next', log, ratio) };
  const before = JSON.stringify(state);
  new TetrisRenderer(canvases).draw(state);
  expect(JSON.stringify(state)).toBe(before);
  return { log, canvases };
}

function initial(patch = {}) {
  return { ...engine.init({ seed: 42, playerIds: ['human'], mode: 'marathon' }), ...patch };
}

function filledBoard() {
  const state = initial();
  state.board = state.board.map(row => [...row]);
  state.board[19] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L', 'I', null, 'O'];
  state.board[18][0] = 'T';
  return state;
}

describe('TetrisRenderer : séquence exacte des appels de dessin', () => {
  const calls = (log, name) => log.filter(entry => entry.startsWith(`${name}.`));

  it('prépare chaque surface à la densité réelle plafonnée à trois', () => {
    const { canvases, log } = render(initial(), 5);
    expect([canvases.board.width, canvases.board.height]).toEqual([900, 1800]);
    expect([canvases.hold.width, canvases.hold.height]).toEqual([480, 264]);
    expect([canvases.next.width, canvases.next.height]).toEqual([480, 900]);
    expect(log.filter(entry => entry.includes('setTransform'))).toEqual([
      'board.setTransform(3,0,0,3,0,0)', 'hold.setTransform(3,0,0,3,0,0)', 'next.setTransform(3,0,0,3,0,0)',
    ]);
  });

  it('retombe à une densité de un sans devicePixelRatio', () => {
    const { canvases } = render(initial(), undefined);
    expect([canvases.board.width, canvases.board.height]).toEqual([300, 600]);
  });

  it('efface, peint le fond et trace onze verticales puis vingt et une horizontales', () => {
    const { log } = render(initial());
    const board = calls(log, 'board');
    expect(board.slice(0, 5)).toEqual([
      'board.setTransform(1,0,0,1,0,0)', 'board.clearRect(0,0,300,600)',
      'board.fillStyle=#0a1220', 'board.fillRect(0,0,300,600)', 'board.strokeStyle=#1c2a3c',
    ]);
    expect(board.filter(entry => entry.startsWith('board.moveTo(')).length).toBe(32);
    expect(board.slice(6, 10)).toEqual(['board.beginPath()', 'board.moveTo(0,0)', 'board.lineTo(0,600)', 'board.stroke()']);
    expect(board[5 + 1 + 11 * 4 + 1]).toBe('board.moveTo(0,0)');
  });

  it('dessine les blocs posés dans l\'ordre ligne puis colonne avec la couleur du type', () => {
    const { log } = render({ ...filledBoard(), active: null });
    const fills = calls(log, 'board').filter(entry => entry.startsWith('board.fillStyle=') && entry.includes('#') && !entry.includes('#0a1220'));
    const colours = fills.filter(entry => Object.values(COLORS).some(color => entry.endsWith(color)));
    expect(colours).toHaveLength(10);
    expect(colours[0]).toBe(`board.fillStyle=${COLORS.T}`);
    expect(colours[1]).toBe(`board.fillStyle=${COLORS.I}`);
  });

  it('empreinte complète : position initiale, grille remplie, partie terminée, sans pièce active', () => {
    const states = {
      initial: initial(),
      filled: filledBoard(),
      over: { ...filledBoard(), gameOver: true },
      none: { ...filledBoard(), active: null },
    };
    expect(Object.fromEntries(Object.entries(states).map(([name, state]) => [name, sha(render(state, 2).log.join('\n'))]))).toEqual(DIGESTS.boards);
  });

  it('ne dessine que les cases visibles de la pièce et de sa projection', () => {
    const state = initial({ active: { type: 'I', x: 3, y: -2, rotation: 1 } });
    const { log } = render(state);
    expect(log.filter(entry => entry.startsWith('board.strokeRect(')).length).toBeGreaterThan(0);
    expect(sha(log.join('\n'))).toBe(DIGESTS.offscreen);
  });

  it('réserve atténuée, file limitée à cinq pièces et libellés d\'accessibilité', () => {
    const held = render(initial({ hold: 'T', canHold: false, queue: ['I', 'O', 'S', 'Z', 'J', 'L', 'T'] }));
    expect(calls(held.log, 'hold').slice(2, 4)).toEqual(['hold.globalAlpha=0.4', 'hold.save()']);
    expect(held.canvases.hold.labels['aria-label']).toBe('Pièce en réserve : T');
    expect(held.canvases.next.labels['aria-label']).toBe('Prochaines pièces : I, O, S, Z, J');
    const fresh = render(initial({ hold: null, canHold: true, queue: ['O'] }));
    expect(calls(fresh.log, 'hold').slice(2, 4)).toEqual(['hold.globalAlpha=1', 'hold.globalAlpha=1']);
    expect(fresh.canvases.hold.labels['aria-label']).toBe('Réserve vide');
    expect(fresh.canvases.next.labels['aria-label']).toBe('Prochaines pièces : O');
    expect(sha(held.log.join('\n'))).toBe(DIGESTS.held);
    expect(sha(fresh.log.join('\n'))).toBe(DIGESTS.fresh);
    expect(render(initial({ queue: [] })).canvases.next.labels['aria-label']).toBe('Prochaines pièces : ');
  });
});

const DIGESTS = {
  boards: { initial: 'd7478f8d163e8548', filled: '86c87e1a201e0c71', over: '5fed9c283ff9548a', none: '5fed9c283ff9548a' },
  offscreen: '07e5749df5a41a98',
  held: '57ff3c8a82db85d4',
  fresh: 'b7cc099af81f464c',
};
