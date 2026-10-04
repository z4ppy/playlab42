/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { mockThreeBoundary } from './support/mock-three.js';
import { startApp, press } from './support/main-harness.js';

const { THREE } = await mockThreeBoundary();

let harness;

async function boot(options) {
  harness = await startApp(options);
  return harness;
}

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
  document.body.innerHTML = '';
  localStorage.clear();
  jest.restoreAllMocks();
});

describe('main : initialisation', () => {
  test('assemble scène, simulation, panneaux, observateurs par défaut et démarre la boucle', async () => {
    const { app, frames } = await boot();
    const container = document.getElementById('canvas-container');

    expect(window.relativityApp).toBe(app);
    expect(container.querySelector('.loading')).toBeNull();
    expect(container.querySelector('canvas')).toBe(app.sceneManager.renderer.domElement);
    expect(app.simulation.observers.map((o) => [o.id, o.name])).toEqual([
      ['lab', 'Lab'], ['obs-1', 'Alice'], ['obs-2', 'Bob'], ['obs-3', 'Charlie'],
    ]);
    expect(app.simulation.referenceObserver.id).toBe('lab');
    expect(app.simulation.state).toBe('paused');
    for (const id of ['hud', 'observer-view', 'motor-panel', 'doppler-graph', 'clock-panel']) {
      expect(document.getElementById(id).children.length).toBeGreaterThan(0);
    }
    expect(document.getElementById('hud-state').textContent).toBe('⏸ Pause');
    expect(app.controlPanel).toBeDefined();
    expect(frames.length).toBeGreaterThan(0);
  });

  test('rend les panneaux déplaçables avec des positions persistées', async () => {
    localStorage.setItem('relativity-lab-hud-pos', JSON.stringify({ left: 12, top: 34 }));
    await boot();
    expect(document.getElementById('hud').style.left).toBe('12px');
    expect(document.getElementById('hud').style.top).toBe('34px');
  });

  test('fonctionne sans les panneaux optionnels', async () => {
    const { app, runFrame } = await boot({ omit: ['clock', 'observer', 'motor', 'doppler'] });
    expect(app.observerView).toBeUndefined();
    expect(app.motorPanel).toBeUndefined();
    expect(app.dopplerGraph).toBeUndefined();
    expect(app.clockPanel).toBeUndefined();
    app.simulation.play();
    runFrame();
    expect(document.getElementById('hud-state').textContent).toBe('▶ Running');
  });

  test('fonctionne sans boutons Play/Reset', async () => {
    const { app } = await boot({ omit: ['actions'] });
    expect(() => press('Space')).not.toThrow();
    expect(app.simulation.state).toBe('running');
  });

  test.each(['canvas', 'hud'])('affiche une alerte et n’initialise rien quand %s est absent', async (missing) => {
    const { app, error, frames } = await boot({ omit: [missing] });
    expect(error).toHaveBeenCalledWith('Erreur d\'initialisation:', expect.objectContaining({ message: 'Conteneurs DOM non trouvés' }));
    expect(app.sceneManager).toBeUndefined();
    expect(frames).toHaveLength(0);
    const alert = document.querySelector('#canvas-container [role="alert"]');
    if (missing === 'hud') {
      expect(alert.textContent).toContain('Conteneurs DOM non trouvés');
    } else {
      expect(alert).toBeNull();
    }
  });
});

describe('main : démarrage et échecs', () => {
  test('attend DOMContentLoaded quand le document charge encore', async () => {
    const { app } = await boot({ loading: true });
    expect(app.simulation.observers).toHaveLength(4);
  });

  test('une erreur tardive d’initialisation est affichée et la boucle ne démarre pas', async () => {
    const { app, error, runFrame } = await boot({ breakMatchMedia: true });
    expect(error).toHaveBeenCalledWith('Erreur d\'initialisation:', expect.any(TypeError));
    const alert = document.querySelector('#canvas-container [role="alert"]');
    expect(alert.textContent).toContain('Erreur de chargement');
    const rendered = app.sceneManager.renderer.rendered.length;
    runFrame();
    expect(app.sceneManager.renderer.rendered).toHaveLength(rendered);
  });
});

describe('main : boutons et clavier', () => {
  const playButton = () => document.getElementById('play-button');

  test('le bouton Play bascule la simulation et reflète l’état accessible', async () => {
    const { app } = await boot();
    playButton().click();
    expect(app.simulation.state).toBe('running');
    expect(playButton().getAttribute('aria-pressed')).toBe('true');
    expect(playButton().getAttribute('aria-label')).toBe('Mettre en pause la simulation');
    expect(playButton().classList.contains('play-button--running')).toBe(true);
    expect(playButton().querySelector('.play-button-text').textContent).toBe('Pause');
    expect(playButton().querySelector('.play-button-icon').textContent).toBe('⏸');
    playButton().click();
    expect(app.simulation.state).toBe('paused');
    expect(playButton().getAttribute('aria-pressed')).toBe('false');
    expect(playButton().querySelector('.play-button-text').textContent).toBe('Play');
    expect(playButton().classList.contains('play-button--running')).toBe(false);
  });

  test('tolère un bouton Play sans icône ni texte', async () => {
    const { app } = await boot();
    playButton().innerHTML = '';
    playButton().click();
    expect(app.simulation.state).toBe('running');
    expect(playButton().getAttribute('aria-pressed')).toBe('true');
  });

  test('Reset remet temps, observateurs, signaux et bouton à l’état initial', async () => {
    const { app, runFrame } = await boot();
    playButton().click();
    runFrame(100);
    runFrame(100);
    expect(app.simulation.labTime).toBeGreaterThan(0);
    document.getElementById('reset-button').click();
    expect(app.simulation.labTime).toBe(0);
    expect(app.simulation.state).toBe('paused');
    expect(app.simulation.signals).toHaveLength(0);
    expect(playButton().getAttribute('aria-pressed')).toBe('false');
  });

  test('Espace bascule en bloquant le défilement ; R réinitialise', async () => {
    const { app } = await boot();
    const space = press('Space');
    expect(space.defaultPrevented).toBe(true);
    expect(app.simulation.state).toBe('running');
    expect(playButton().getAttribute('aria-pressed')).toBe('true');
    press('KeyR');
    expect(app.simulation.state).toBe('paused');
    expect(playButton().getAttribute('aria-pressed')).toBe('false');
  });

  test.each([
    ['un champ de saisie', () => { const i = document.createElement('input'); document.body.append(i); return [i, {}]; }],
    ['un select', () => [document.getElementById('hud-ref-select'), {}]],
    ['un bouton', () => [document.getElementById('reset-button'), {}]],
    ['Ctrl', () => [document.body, { ctrlKey: true }]],
    ['Alt', () => [document.body, { altKey: true }]],
    ['Meta', () => [document.body, { metaKey: true }]],
  ])('ignore les raccourcis depuis %s', async (_label, setup) => {
    const { app } = await boot();
    const [target, init] = setup();
    const event = press('Space', init, target);
    expect(event.defaultPrevented).toBe(false);
    expect(app.simulation.state).toBe('paused');
  });

  test('traite une cible non-élément comme le document', async () => {
    const { app } = await boot();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true }));
    expect(app.simulation.state).toBe('running');
  });

  test.each([
    ['Digit1', 'lab'], ['Digit2', 'obs-1'], ['Digit3', 'obs-2'], ['Digit4', 'obs-3'],
  ])('%s sélectionne le référentiel %s', async (code, id) => {
    const { app } = await boot();
    press(code);
    expect(app.simulation.referenceObserver.id).toBe(id);
  });

  test('Digit5 sans cinquième référentiel conserve la référence', async () => {
    const { app } = await boot();
    press('Digit3');
    press('Digit5');
    expect(app.simulation.referenceObserver.id).toBe('obs-2');
  });

  test('G et A basculent grille et axes ; une touche inconnue ne fait rien', async () => {
    const { app } = await boot();
    press('KeyG');
    press('KeyA');
    expect(app.sceneManager.grid.visible).toBe(false);
    expect(app.sceneManager.axes.visible).toBe(false);
    press('KeyG');
    expect(app.sceneManager.grid.visible).toBe(true);
    expect(press('KeyX').defaultPrevented).toBe(false);
    expect(app.simulation.state).toBe('paused');
  });
});

describe('main : boucle, référentiel et moteur', () => {
  test('chaque frame fait avancer la simulation du delta réel et rend la scène', async () => {
    const { app, runFrame } = await boot();
    app.simulation.play();
    const rendered = app.sceneManager.renderer.rendered;
    const before = rendered.length;
    runFrame(50);
    expect(app.simulation.labTime).toBeCloseTo(0.05 * app.simulation.timeScale);
    expect(rendered).toHaveLength(before + 1);
    runFrame(50);
    expect(rendered).toHaveLength(before + 2);
    expect(document.getElementById('hud-state').textContent).toBe('▶ Running');
  });

  test('borne le delta d’une longue interruption à 0,1 s', async () => {
    const { app, runFrame } = await boot();
    app.simulation.play();
    runFrame(60000);
    expect(app.simulation.labTime).toBeCloseTo(0.1 * app.simulation.timeScale);
  });

  test('en pause, la scène est rendue mais le temps n’avance pas', async () => {
    const { app, runFrame } = await boot();
    const before = app.sceneManager.renderer.rendered.length;
    runFrame(100);
    expect(app.simulation.labTime).toBe(0);
    expect(app.sceneManager.renderer.rendered).toHaveLength(before + 1);
  });

  test('la caméra suit l’observateur de référence à chaque mise à jour', async () => {
    const { app, runFrame } = await boot();
    const setTarget = jest.spyOn(app.sceneManager, 'setTarget');
    app.simulation.play();
    press('Digit3');
    runFrame(10);
    expect(setTarget).toHaveBeenLastCalledWith(app.simulation.referenceObserver.position);
  });

  test('changer de référentiel depuis le HUD recentre la caméra', async () => {
    const { app } = await boot();
    const setTarget = jest.spyOn(app.sceneManager, 'setTarget');
    const select = document.getElementById('hud-ref-select');
    select.value = 'obs-2';
    select.dispatchEvent(new Event('change'));
    expect(app.simulation.referenceObserver.id).toBe('obs-2');
    expect(setTarget).toHaveBeenCalledWith(app.simulation.getObserver('obs-2').position);
  });

  test('un référentiel inconnu depuis le HUD ne recentre pas la caméra', async () => {
    const { app } = await boot();
    const setTarget = jest.spyOn(app.sceneManager, 'setTarget');
    app.hud.onReferenceChange('inconnu');
    expect(setTarget).not.toHaveBeenCalled();
  });

  test('applique l’impulsion du moteur à l’observateur de référence', async () => {
    const { app } = await boot();
    const applyThrust = jest.spyOn(app.simulation.referenceObserver, 'applyThrust');
    document.getElementById('motor-fire').click();
    expect(applyThrust).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Impulsion'));
  });

  test('une impulsion refusée n’est pas journalisée', async () => {
    const { app } = await boot();
    jest.spyOn(app.simulation.referenceObserver, 'applyThrust').mockReturnValue({ success: false });
    console.log.mockClear();
    document.getElementById('motor-fire').click();
    expect(console.log).not.toHaveBeenCalled();
  });

  test('la poussée continue est appliquée avant chaque mise à jour', async () => {
    const { app, runFrame } = await boot();
    const direction = new THREE.Vector3(1, 0, 0);
    jest.spyOn(app.motorPanel, 'getContinuousThrust').mockReturnValue({ direction, deltaMass: 2 });
    const applyThrust = jest.spyOn(app.simulation.referenceObserver, 'applyThrust');
    runFrame();
    expect(applyThrust).toHaveBeenCalledWith(direction, 2);
  });

  test('sans poussée ni observateur de référence, la frame se poursuit', async () => {
    const { app, runFrame } = await boot();
    const applyThrust = jest.spyOn(app.simulation.referenceObserver, 'applyThrust');
    runFrame();
    expect(applyThrust).not.toHaveBeenCalled();
    app.simulation.referenceObserver = null;
    expect(() => runFrame()).not.toThrow();
  });
});

describe('main : thème', () => {
  test('un changement de data-theme met à jour la scène', async () => {
    const { app } = await boot();
    const updateTheme = jest.spyOn(app.sceneManager, 'updateTheme');
    document.documentElement.setAttribute('data-theme', 'light');
    await Promise.resolve();
    expect(updateTheme).toHaveBeenCalledTimes(1);
    document.documentElement.removeAttribute('data-theme');
  });

  test('un changement de préférence système met à jour la scène', async () => {
    const { app, mediaListeners } = await boot();
    const updateTheme = jest.spyOn(app.sceneManager, 'updateTheme');
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    mediaListeners.find(({ type }) => type === 'change').listener();
    expect(updateTheme).toHaveBeenCalledTimes(1);
  });
});

describe('main : arrêt, reprise et libération', () => {
  test('stop interrompt la boucle ; start reprend sans saut de temps', async () => {
    const { app, runFrame, clock } = await boot();
    app.simulation.play();
    runFrame(16);
    const labTime = app.simulation.labTime;
    const rendered = app.sceneManager.renderer.rendered.length;
    app.stop();
    runFrame(16);
    expect(app.simulation.labTime).toBe(labTime);
    expect(app.sceneManager.renderer.rendered).toHaveLength(rendered);

    clock.now += 60000;
    app.start();
    runFrame(20);
    expect(app.simulation.labTime).toBeCloseTo(labTime + 0.02 * app.simulation.timeScale);
  });

  test('start est idempotent', async () => {
    const { app, runFrame } = await boot();
    const rendered = app.sceneManager.renderer.rendered;
    const before = rendered.length;
    app.start();
    app.start();
    expect(rendered).toHaveLength(before);
    runFrame();
    expect(rendered).toHaveLength(before + 1);
  });

  test('dispose arrête la boucle et libère simulation, scène et panneau de contrôle', async () => {
    const { app, runFrame } = await boot();
    const destroy = jest.spyOn(app.controlPanel, 'destroy');
    const canvas = app.sceneManager.renderer.domElement;
    const rendered = app.sceneManager.renderer.rendered;
    const before = rendered.length;
    app.dispose();
    runFrame();
    expect(rendered).toHaveLength(before);
    expect(app.simulation.observers).toHaveLength(0);
    expect(app.sceneManager.renderer.disposed).toBe(true);
    expect(canvas.isConnected).toBe(false);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
