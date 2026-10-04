/** @jest-environment jsdom */

import { jest } from '@jest/globals';
import { installBrowserBoundary } from './support/browser-boundary.js';
import { mockThreeBoundary } from './support/mock-three.js';

const { THREE, OrbitControls } = await mockThreeBoundary();
const { SceneManager } = await import('../src/SceneManager.js');

function createContainer(width = 800, height = 400) {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: height });
  document.body.appendChild(container);
  return container;
}

describe('SceneManager réel : construction', () => {
  let browser;
  let container;
  let manager;

  beforeEach(() => {
    browser = installBrowserBoundary();
    OrbitControls.instances.length = 0;
    container = createContainer();
    document.documentElement.style.setProperty('--color-bg', '#101820');
    manager = new SceneManager(container);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('style');
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('monte canvas accessible, caméra proportionnée et pixel ratio plafonné', () => {
    const canvas = container.querySelector('canvas');
    expect(canvas).toBe(manager.renderer.domElement);
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-describedby')).toBe('canvas-help');
    expect(manager.renderer.size).toEqual([800, 400]);
    expect(manager.renderer.options).toEqual({ antialias: true, alpha: false });
    expect(manager.camera.aspect).toBe(2);
    expect(manager.camera.fov).toBe(60);
    expect(manager.renderer.pixelRatio).toBeLessThanOrEqual(2);
  });

  test('plafonne un pixel ratio élevé à 2', () => {
    window.devicePixelRatio = 3;
    const dense = new SceneManager(createContainer());
    expect(dense.renderer.pixelRatio).toBe(2);
  });

  test('utilise les couleurs du thème avec repli lorsque la variable est absente', () => {
    expect(manager.scene.background.getHex()).toBe(0x101820);
    document.documentElement.removeAttribute('style');
    const fallback = new SceneManager(createContainer());
    expect(fallback.scene.background.getHex()).toBe(0x1a1a2e);
  });

  test('compose lumières, grille, axes colorés et leurs labels', () => {
    const kinds = manager.scene.children.map((child) => child.constructor.name);
    expect(kinds).toEqual(expect.arrayContaining(['AmbientLight', 'DirectionalLight', 'GridHelper', 'Group']));
    expect(manager.scene.children.filter((c) => c instanceof THREE.DirectionalLight)).toHaveLength(2);
    expect(manager.axesGroup.children).toHaveLength(4);
    const labels = browser.context.calls.filter(([name]) => name === 'fillText').map(([, text]) => text);
    expect(labels).toEqual(['X', 'Y', 'Z']);
    expect(manager.grid.position.y).toBe(-0.01);
  });

  test('configure les contrôles orbitaux et désactive le zoom natif', () => {
    const [controls] = OrbitControls.instances;
    expect(manager.controls).toBe(controls);
    expect(controls.camera).toBe(manager.camera);
    expect(controls.enableZoom).toBe(false);
    expect(controls.minDistance).toBe(2);
    expect(controls.maxDistance).toBe(50);
    expect(controls.enableDamping).toBe(true);
  });
});

describe('SceneManager réel : zoom, cible et rendu', () => {
  let manager;
  let canvas;

  beforeEach(() => {
    installBrowserBoundary();
    OrbitControls.instances.length = 0;
    manager = new SceneManager(createContainer());
    canvas = manager.renderer.domElement;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  function wheel(deltaY) {
    const event = new WheelEvent('wheel', { deltaY, cancelable: true });
    canvas.dispatchEvent(event);
    return event;
  }

  test('la molette annule le défilement et rapproche la caméra progressivement', () => {
    const before = manager.camera.position.distanceTo(manager.controls.target);
    expect(wheel(-500).defaultPrevented).toBe(true);
    manager.render();
    const afterOne = manager.camera.position.distanceTo(manager.controls.target);
    expect(afterOne).toBeLessThan(before);
    manager.render();
    expect(manager.camera.position.distanceTo(manager.controls.target)).toBeLessThan(afterOne);
  });

  test('borne la distance cible entre minDistance et maxDistance', () => {
    for (let i = 0; i < 200; i++) { wheel(100000); manager.render(); }
    expect(manager.camera.position.distanceTo(manager.controls.target)).toBeCloseTo(50, 1);
    for (let i = 0; i < 400; i++) { wheel(-100000); manager.render(); }
    expect(manager.camera.position.distanceTo(manager.controls.target)).toBeCloseTo(2, 1);
  });

  test('ne bouge pas la caméra quand la distance est déjà celle visée', () => {
    const before = manager.camera.position.clone();
    manager.render();
    expect(manager.camera.position).toEqual(before);
  });

  test('setTarget sans lissage déplace immédiatement cible, axes et grille horizontale', () => {
    manager.setTarget(new THREE.Vector3(4, 5, -6), false);
    expect(manager.controls.target).toMatchObject({ x: 4, y: 5, z: -6 });
    expect(manager.axesGroup.position).toMatchObject({ x: 4, y: 5, z: -6 });
    expect(manager.grid.position).toMatchObject({ x: 4, y: -0.01, z: -6 });
  });

  test('setTarget lissé copie la cible puis la suit de 8 % par frame sans l’aliaser', () => {
    const goal = new THREE.Vector3(10, 0, 0);
    manager.setTarget(goal);
    expect(manager.controls.target.x).toBe(0);
    goal.x = 99;
    manager.render();
    expect(manager.controls.target.x).toBeCloseTo(0.8);
    expect(manager.axesGroup.position.x).toBeCloseTo(0.8);
    expect(manager.grid.position.x).toBeCloseTo(0.8);
    manager.render();
    expect(manager.controls.target.x).toBeCloseTo(0.8 + 9.2 * 0.08);
  });

  test('render met à jour les contrôles puis rend la scène avec la caméra', () => {
    manager.render();
    manager.render();
    expect(manager.controls.updates).toBe(2);
    expect(manager.renderer.rendered).toEqual([[manager.scene, manager.camera], [manager.scene, manager.camera]]);
  });

  test('bascule grille et axes indépendamment', () => {
    manager.setGridVisible(false);
    manager.setAxesVisible(false);
    expect(manager.grid.visible).toBe(false);
    expect(manager.axesGroup.visible).toBe(false);
    manager.setGridVisible(true);
    expect(manager.grid.visible).toBe(true);
    expect(manager.axesGroup.visible).toBe(false);
  });

  test('updateTheme relit la variable CSS pour le fond et le brouillard', () => {
    document.documentElement.style.setProperty('--color-bg', '#ffffff');
    manager.updateTheme();
    expect(manager.scene.background.getHex()).toBe(0xffffff);
    expect(manager.scene.fog.color.getHex()).toBe(0xffffff);
    document.documentElement.removeAttribute('style');
  });

  test('updateTheme tolère l’absence de brouillard', () => {
    manager.scene.fog = null;
    expect(() => manager.updateTheme()).not.toThrow();
    expect(manager.scene.background.getHex()).toBe(0x1a1a2e);
  });
});

describe('SceneManager réel : redimensionnement et libération', () => {
  let browser;
  let container;
  let manager;

  beforeEach(() => {
    browser = installBrowserBoundary();
    container = createContainer(600, 300);
    manager = new SceneManager(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('observe le conteneur et applique la nouvelle taille', () => {
    const [observer] = browser.resizeObservers;
    expect(observer.observed).toEqual([container]);
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 500 });
    observer.callback();
    expect(manager.camera.aspect).toBe(2);
    expect(manager.camera.projectionUpdates).toBe(1);
    expect(manager.renderer.size).toEqual([1000, 500]);
  });

  test.each([[0, 300], [600, 0]])('ignore une taille nulle %i×%i', (width, height) => {
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: width });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: height });
    browser.resizeObservers[0].callback();
    expect(manager.camera.projectionUpdates).toBe(0);
    expect(manager.renderer.size).toEqual([600, 300]);
  });

  test('dispose déconnecte l’observer, libère contrôles et renderer et retire le canvas', () => {
    manager.dispose();
    expect(browser.resizeObservers[0].disconnected).toBe(true);
    expect(manager.controls.disposed).toBe(true);
    expect(manager.renderer.disposed).toBe(true);
    expect(container.querySelector('canvas')).toBeNull();
  });

  test('dispose reste sûr si le canvas a déjà été détaché', () => {
    manager.renderer.domElement.remove();
    expect(() => manager.dispose()).not.toThrow();
    expect(manager.renderer.disposed).toBe(true);
  });
});
