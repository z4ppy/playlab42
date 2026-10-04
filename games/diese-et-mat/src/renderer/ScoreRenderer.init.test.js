/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const journal = [];

class FakeStave {
  constructor(...args) { journal.push(['stave', ...args]); }
  addClef(clef) { journal.push(['clef', clef]); }
  addTimeSignature(signature) { journal.push(['time', signature]); }
  setContext() { return { draw: () => journal.push(['draw']) }; }
}

class FakeRenderer {
  static Backends = { SVG: 'svg' };
  constructor(container, backend) { journal.push(['renderer', container.id, backend]); }
  resize(width, height) { journal.push(['resize', width, height]); }
  getContext() {
    return { setFont: (...args) => journal.push(['font', ...args]), clear: () => journal.push(['clear']) };
  }
}

jest.unstable_mockModule('vexflow', () => ({
  Renderer: FakeRenderer,
  Stave: FakeStave,
  VexFlow: { setFonts: (...args) => journal.push(['setFonts', ...args]) },
}));

const { ScoreRenderer } = await import('./ScoreRenderer.js');

describe('ScoreRenderer : initialisation unique et destruction définitive', () => {
  let container;
  let loadFont;
  let logged;

  beforeEach(() => {
    journal.length = 0;
    container = document.createElement('div');
    container.id = 'score';
    container.innerHTML = '<p>ancien</p>';
    loadFont = jest.fn().mockResolvedValue([{}]);
    Object.defineProperty(document, 'fonts', { value: { load: loadFont }, configurable: true });
    logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logged.mockRestore();
  });

  test('init charge les fontes, crée le rendu puis la portée avec les options par défaut', async () => {
    const renderer = new ScoreRenderer(container);
    expect(renderer.ready).toBe(false);
    await expect(renderer.init()).resolves.toBeUndefined();
    expect(renderer.ready).toBe(true);
    expect(loadFont.mock.calls).toEqual([['16px Bravura'], ['16px Academico']]);
    expect(journal).toEqual([
      ['setFonts', 'Bravura', 'Academico'],
      ['renderer', 'score', 'svg'],
      ['resize', 300, 150],
      ['font', 'Arial', 10],
      ['stave', 10, 35, 280],
      ['clef', 'treble'],
      ['draw'],
    ]);
    expect(container.innerHTML).toBe('');
    expect(renderer._initPromise).toBeNull();
  });

  test('la signature rythmique est ajoutée à la portée', async () => {
    const renderer = new ScoreRenderer(container, { timeSignature: { beats: 3, beatValue: 8 }, clef: 'bass' });
    await renderer.init();
    expect(journal).toContainEqual(['clef', 'bass']);
    expect(journal).toContainEqual(['time', '3/8']);
  });

  test('deux init simultanés partagent une seule initialisation', async () => {
    const renderer = new ScoreRenderer(container);
    const first = renderer.init();
    const second = renderer.init();
    expect(second).toBe(first);
    await first;
    expect(loadFont).toHaveBeenCalledTimes(2);
    expect(journal.filter(([name]) => name === 'renderer')).toHaveLength(1);
  });

  test('un renderer prêt répond sans recharger ni redessiner', async () => {
    const renderer = new ScoreRenderer(container);
    await renderer.init();
    journal.length = 0;
    loadFont.mockClear();
    await expect(renderer.init()).resolves.toBeUndefined();
    expect(journal).toEqual([]);
    expect(loadFont).not.toHaveBeenCalled();
  });

  test.each([
    ['aucune face disponible', [[{}], []]],
    ['liste de faces vide', [[], [{}]]],
  ])('des fontes locales indisponibles (%s) échouent avec la cause et permettent un nouvel essai', async (_label, faces) => {
    loadFont.mockResolvedValueOnce(faces[0]).mockResolvedValueOnce(faces[1]);
    const renderer = new ScoreRenderer(container);
    const failure = await renderer.init().catch((error) => error);
    expect(failure.message).toBe('Impossible de charger VexFlow');
    expect(failure.cause.message).toBe('Fontes musicales locales indisponibles');
    expect(logged).toHaveBeenCalledWith('Erreur lors du chargement de VexFlow:', failure.cause);
    expect(renderer.ready).toBe(false);
    expect(renderer._initPromise).toBeNull();

    loadFont.mockResolvedValue([{}]);
    await expect(renderer.init()).resolves.toBeUndefined();
    expect(renderer.ready).toBe(true);
  });

  test('un échec de chargement d\'une fonte est propagé comme cause', async () => {
    const fontError = new Error('réseau coupé');
    loadFont.mockRejectedValueOnce(fontError);
    const renderer = new ScoreRenderer(container);
    const failure = await renderer.init().catch((error) => error);
    expect(failure.message).toBe('Impossible de charger VexFlow');
    expect(failure.cause).toBe(fontError);
  });

  test('détruit avant init : rejet immédiat sans journal ni chargement', async () => {
    const renderer = new ScoreRenderer(container);
    renderer.dispose();
    await expect(renderer.init()).rejects.toThrow('Renderer détruit');
    expect(loadFont).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
    expect(renderer.ready).toBe(false);
  });

  test('détruit pendant le chargement des fontes : échec enveloppé et rien n\'est créé', async () => {
    let finish;
    loadFont.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const renderer = new ScoreRenderer(container);
    const pending = renderer.init();
    await Promise.resolve();
    renderer.dispose();
    finish([{}]);
    const failure = await pending.catch((error) => error);
    expect(failure.message).toBe('Impossible de charger VexFlow');
    expect(failure.cause.message).toBe('Renderer détruit');
    expect(renderer.ready).toBe(false);
    expect(journal.filter(([name]) => name === 'renderer')).toHaveLength(0);
    await expect(renderer.init()).rejects.toThrow('Renderer détruit');
  });

  test('dispose libère le rendu, vide le conteneur et rend le renderer inutilisable', async () => {
    const renderer = new ScoreRenderer(container);
    await renderer.init();
    container.innerHTML = '<svg></svg>';
    renderer.dispose();
    expect(container.innerHTML).toBe('');
    expect([renderer.renderer, renderer.context, renderer.stave, renderer.VF]).toEqual([null, null, null, null]);
    expect(renderer.ready).toBe(false);
    await expect(renderer.init()).rejects.toThrow('Renderer détruit');
  });
});
