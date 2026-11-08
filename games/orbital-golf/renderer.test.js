import { normalizeHole } from './engine/level.js';
import { INITIATION } from './engine/levels.js';
import { GolfRenderer, readPalette } from './renderer.js';
import { Burst, Trail, createStarfield, drawDots, drawStarfield, fieldGrid } from './renderer-effects.js';

/** Contexte 2D factice : journalise appels et affectations, dans l'ordre. */
function fakeContext(log) {
  const gradient = { addColorStop: (...args) => log.push(['stop', ...args]) };
  return new Proxy({}, {
    get: (_, key) => (...args) => {
      log.push([String(key), ...args]);
      return String(key).startsWith('create') ? gradient : undefined;
    },
    set: (_, key, value) => { log.push([`${String(key)}=`, value]); return true; },
  });
}

function setup({ width = 344, ratio = 2, variables = {} } = {}) {
  const log = [];
  const canvas = { clientWidth: width, width: 0, height: 0, getContext: () => fakeContext(log) };
  const host = {
    devicePixelRatio: ratio,
    getComputedStyle: () => ({ getPropertyValue: name => variables[name] ?? '' }),
  };
  return { log, canvas, host, renderer: new GolfRenderer(canvas, host) };
}

const calls = (log, name) => log.filter(([key]) => key === name);
const grandTour = normalizeHole(INITIATION[8]);

describe('Palette et taille', () => {
  test('lit les variables CSS du thème, avec des valeurs de secours', () => {
    const host = { getComputedStyle: () => ({ getPropertyValue: name => (name === '--golf-aim' ? '  #123456 ' : '') }) };
    const palette = readPalette(host, {});
    expect(palette.aim).toBe('#123456');
    expect(palette.spaceTop).toBe('#0b1226');
  });

  test('relit la palette après un changement de thème', () => {
    const variables = {};
    const { renderer } = setup({ variables });
    variables['--golf-ball'] = '#ff0000';
    renderer.refreshPalette();
    expect(renderer.palette.ball).toBe('#ff0000');
  });

  test('suit la densité de l’écran, bornée à 3, et ne redimensionne qu’au changement', () => {
    const { canvas, renderer } = setup({ ratio: 4 });
    expect(renderer.resize()).toBe(true);
    expect([canvas.width, canvas.height, renderer.ratio]).toEqual([344 * 3, 344 * 3, 3]);
    expect(renderer.resize()).toBe(false);
    canvas.clientWidth = 0;
    expect(renderer.resize()).toBe(true);
    expect(renderer.side).toBe(1);
  });

  test('sans devicePixelRatio, la définition reste à 1 pixel par px CSS', () => {
    const { canvas, renderer, host } = setup();
    delete host.devicePixelRatio;
    renderer.resize();
    expect(canvas.width).toBe(344);
  });

  test('projette le monde sur le canvas et revient au point de départ', () => {
    const { renderer } = setup();
    renderer.resize();
    const view = renderer.view(grandTour);
    expect(view.scale).toBeCloseTo(344 / 1160, 12);
    expect(view.x(-80)).toBe(0);
    const world = renderer.toWorld(grandTour, view.x(500), view.y(250));
    expect(world.x).toBeCloseTo(500, 9);
    expect(world.y).toBeCloseTo(250, 9);
  });
});

describe('Dessin d’une scène', () => {
  const scene = (patch = {}) => ({
    hole: grandTour, time: 1.5, ball: { x: 100, y: 900 }, aim: { angle: 3000, power: 60 },
    hint: { angle: 2950, power: 78 }, preview: [[110, 890], [120, 880]], impact: { x: 130, y: 870 },
    trail: [[90, 910], [95, 905]], burst: new Burst(), drift: { x: 0.1, y: 0.2 }, ...patch,
  });

  test('dessine fond, grille, cible, chaque corps, guides, traînée et balle', () => {
    const { log, renderer } = setup();
    renderer.resize();
    renderer.draw(scene());
    expect(log[0]).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
    expect(calls(log, 'createLinearGradient')).toHaveLength(1);
    // Deux planètes et une lune en dégradé radial, plus le halo du trou noir.
    expect(calls(log, 'createRadialGradient')).toHaveLength(4);
    expect(calls(log, 'setLineDash')).toEqual([['setLineDash', [3, 3]], ['setLineDash', []], ['setLineDash', [2, 6]], ['setLineDash', []]]);
    expect(log.filter(([key, value]) => key === 'fillStyle=' && value === '#ffd166').length).toBeGreaterThanOrEqual(2);
    expect(log.filter(([key, value]) => key === 'strokeStyle=' && value === '#7dd3fc')).toHaveLength(1);
    const ballArcs = calls(log, 'arc').filter(([, x, y]) => x === renderer.view(grandTour).x(100) && y === renderer.view(grandTour).y(900));
    expect(ballArcs.map(([, , , radius]) => radius)).toEqual([6 * 2.2, 6]);
  });

  test('sans balle, visée ni aperçu, seuls le décor et le terrain sont dessinés', () => {
    const { log, renderer } = setup();
    renderer.resize();
    const burst = new Burst();
    burst.start(900, 120);
    renderer.draw({ hole: grandTour, time: 0, ball: null, burst });
    expect(log.some(([key, value]) => key === 'fillStyle=' && String(value).startsWith('rgba(255, 214, 102'))).toBe(true);
    expect(log.some(([key, value]) => key === 'strokeStyle=' && value === '#ffd166')).toBe(false);
  });

  test('une planète sans palette connue garde des teintes neutres ; la grille est calculée une fois par trou', () => {
    const { log, renderer } = setup();
    renderer.resize();
    const hole = normalizeHole({ ...INITIATION[1], bodies: [{ kind: 'planet', x: 500, y: 540, radius: 80, mass: 4, palette: 'inconnue' }] });
    renderer.draw({ hole, time: 0, ball: hole.tee });
    const grid = renderer.grid;
    renderer.draw({ hole, time: 0, ball: hole.tee });
    expect(renderer.grid).toBe(grid);
    expect(calls(log, 'stop')).toContainEqual(['stop', 0, '#d7dbe6']);
  });
});

describe('Effets', () => {
  test('le ciel étoilé est identique à chaque visite, en trois couches', () => {
    const stars = createStarfield();
    expect(stars.map(layer => layer.length)).toEqual([70, 40, 18]);
    expect(createStarfield()).toEqual(stars);
    expect(stars.flat().every(star => star.x >= 0 && star.x < 1 && star.alpha <= 0.85)).toBe(true);
  });

  test('les étoiles reviennent dans le cadre quelle que soit la parallaxe', () => {
    const log = [];
    drawStarfield(fakeContext(log), [[{ x: 0.1, y: 0.9, size: 1, alpha: 0.5, depth: 1 }]], 100, { x: 0.3, y: -0.3 });
    expect(calls(log, 'fillRect')[0][1]).toBeCloseTo(80, 9);
    expect(calls(log, 'fillRect')[0][2]).toBeCloseTo(20, 9);
    expect(log.at(-1)).toEqual(['globalAlpha=', 1]);
  });

  test('la grille de champ se creuse vers les masses et reste droite dans le vide', () => {
    const empty = fieldGrid(normalizeHole(INITIATION[0]));
    expect(empty).toHaveLength(50);
    expect(empty[0][0]).toEqual([-80, -80]);
    const curved = fieldGrid(normalizeHole(INITIATION[1]));
    const node = curved[24][12];
    const straight = empty[24][12];
    expect(Math.hypot(node[0] - 500, node[1] - 540)).toBeLessThan(Math.hypot(straight[0] - 500, straight[1] - 540));
  });

  test('la traînée garde les 40 dernières positions', () => {
    const trail = new Trail();
    for (let index = 0; index < 45; index++) { trail.push(index, -index); }
    expect(trail.points).toHaveLength(40);
    expect(trail.points[0]).toEqual([5, -5]);
    trail.clear();
    expect(trail.points).toEqual([]);
  });

  test('la gerbe d’arrivée compte 48 particules qui s’éteignent en moins d’une seconde', () => {
    const burst = new Burst();
    expect(burst.alive).toBe(false);
    burst.start(10, 20);
    expect(burst.particles).toHaveLength(48);
    burst.update(0.5);
    expect(burst.alive).toBe(true);
    expect(burst.particles[0].x).not.toBe(10);
    burst.update(0.4);
    expect(burst.alive).toBe(false);
  });

  test('les points d’aperçu s’estompent de 1 à 0', () => {
    const log = [];
    drawDots(fakeContext(log), [[0, 0], [1, 1], [2, 2], [3, 3]], '#fff', 2);
    expect(log.filter(([key]) => key === 'globalAlpha=').map(([, value]) => value)).toEqual([1, 0.75, 0.5, 0.25, 1]);
  });
});
