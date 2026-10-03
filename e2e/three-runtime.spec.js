import { test, expect } from './fixtures.js';

test.setTimeout(60_000);

test('Relativity : versions verrouillées et imports transitifs locaux sans CDN', async ({ page, baseURL }) => {
  const external = [];
  const paths = new Set();
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== new URL(baseURL).origin && ['https:', 'http:'].includes(url.protocol)) {
      external.push(url.href);
    }
    paths.add(url.pathname);
  });
  await page.goto('/tools/relativity-lab/index.html');
  await expect(page.locator('#canvas-container canvas')).toBeVisible();
  const versions = await page.evaluate(async () => {
    const THREE = await import('three');
    const { default: GUI } = await import('lil-gui');
    const manifest = await (await fetch('../../assets/vendor/manifest.json')).json();
    return {
      revision: THREE.REVISION,
      gui: window.relativityApp.controlPanel instanceof GUI,
      webgl2: window.relativityApp.sceneManager.renderer.getContext() instanceof WebGL2RenderingContext,
      libraries: manifest.libraries.filter(item => ['three', 'lil-gui'].includes(item.package)),
      licenses: manifest.licenses.filter(item => ['three', 'lil-gui'].includes(item.package))
        .map(({ package: name, version, license }) => ({ name, version, license })),
    };
  });
  expect(versions.revision).toBe('186');
  expect(versions.gui).toBe(true);
  expect(versions.webgl2).toBe(true);
  expect(versions.libraries).toEqual([
    { package: 'three', version: '0.186.1', destination: 'three' },
    { package: 'lil-gui', version: '0.21.0', destination: 'lil-gui' },
  ]);
  expect(versions.licenses).toEqual([
    { name: 'lil-gui', version: '0.21.0', license: 'MIT' },
    { name: 'three', version: '0.186.1', license: 'MIT' },
  ]);
  expect(external).toEqual([]);
  expect([...paths]).toEqual(expect.arrayContaining([
    '/assets/vendor/three/build/three.module.js',
    '/assets/vendor/three/build/three.core.js',
    '/assets/vendor/three/examples/jsm/controls/OrbitControls.js',
    '/assets/vendor/lil-gui/dist/lil-gui.esm.js',
  ]));
});

test('Relativity réel : framebuffer, OrbitControls, zoom et redimensionnement', async ({ page }) => {
  await page.goto('/tools/relativity-lab/index.html');
  const canvas = page.locator('#canvas-container canvas');
  await expect(canvas).toBeVisible();
  const initial = await page.evaluate(() => {
    const manager = window.relativityApp.sceneManager;
    manager.render();
    const gl = manager.renderer.getContext();
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set();
    for (let index = 0; index < pixels.length; index += 4) {
      colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
    }
    return {
      colors: colors.size,
      error: gl.getError(),
      triangles: manager.renderer.info.render.triangles,
      colorSpace: manager.renderer.outputColorSpace,
      camera: manager.camera.position.toArray(),
    };
  });
  expect(initial.colors).toBeGreaterThan(10);
  expect(initial.error).toBe(0);
  expect(initial.triangles).toBeGreaterThan(0);
  expect(initial.colorSpace).toBe('srgb');

  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() =>
    window.relativityApp.sceneManager.camera.position.toArray(),
  )).not.toEqual(initial.camera);
  const beforeZoom = await page.evaluate(() => {
    const { camera, controls } = window.relativityApp.sceneManager;
    return camera.position.distanceTo(controls.target);
  });
  await page.mouse.wheel(0, -100);
  await expect.poll(() => page.evaluate(() => {
    const { camera, controls } = window.relativityApp.sceneManager;
    return camera.position.distanceTo(controls.target);
  })).toBeLessThan(beforeZoom);

  await page.setViewportSize({ width: 1000, height: 720 });
  await expect.poll(() => page.evaluate(() => {
    const { camera, container, renderer } = window.relativityApp.sceneManager;
    const size = renderer.domElement.getBoundingClientRect();
    return Math.abs(camera.aspect - container.clientWidth / container.clientHeight) < 0.001 &&
      size.width === container.clientWidth && size.height === container.clientHeight;
  })).toBe(true);
});

test('Relativity réel : lil-gui reconstruit les dossiers/options, signaux rendus puis reset', async ({ page }) => {
  await page.goto('/tools/relativity-lab/index.html');
  await expect(page.locator('#canvas-container canvas')).toBeVisible();
  const result = await page.evaluate(() => {
    const { simulation, controlPanel: gui, sceneManager } = window.relativityApp;
    const controller = (property) => gui.controllersRecursive().find(item => item.property === property);
    const press = (property) => controller(property).$button.click();
    const initialCount = simulation.observers.length;
    controller('newObsName').setValue('Compatibilité');
    press('add');
    const observer = simulation.observers.at(-1);
    const addedCount = simulation.observers.length;
    controller('referenceFrame').setValue(observer.id);
    const selected = simulation.referenceObserver.id;
    const frameOptions = [...controller('referenceFrame').$select.options].map(option => option.textContent);
    controller('showGrid').setValue(false);
    controller('showAxes').setValue(false);
    const hidden = [sceneManager.grid.visible, sceneManager.axesGroup.visible];
    controller('showSignals').setValue(true);
    controller('showAllSources').setValue(false);
    const sources = gui.foldersRecursive().find(folder => folder._title === 'Filtrer sources');
    const sourceController = sources.controllers.find(item => item._name === observer.name);
    sourceController.setValue(false);
    const filtered = !simulation.visibleSources.has(observer.id);
    controller('showAllSources').setValue(true);
    controller('playing').setValue(true);
    for (let tick = 0; tick < 150 && simulation.signals.length === 0; tick++) {
      simulation.update(0.1);
    }
    sceneManager.render();
    const signals = simulation.signals.length;
    const rendered = simulation.signals.every(signal => signal.mesh.visible && signal.mesh.parent);
    const geometries = simulation.signals.map(signal => signal.mesh.geometry);
    let disposed = 0;
    geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposed++));
    press('reset');
    const reset = { signals: simulation.signals.length, state: simulation.state, disposed };
    const folder = gui.foldersRecursive().find(item => item._title === observer.name);
    folder.controllers.find(item => item.property === 'remove').$button.click();
    const removed = !simulation.getObserver(observer.id);
    const remainingOptions = [...controller('referenceFrame').$select.options].map(option => option.textContent);
    return { initialCount, addedCount, selected, id: observer.id, frameOptions, hidden,
      filtered, signals, rendered, reset, removed, remainingOptions, finalCount: simulation.observers.length };
  });
  expect(result.addedCount).toBe(result.initialCount + 1);
  expect(result.selected).toBe(result.id);
  expect(result.frameOptions).toContain('Compatibilité');
  expect(result.hidden).toEqual([false, false]);
  expect(result.filtered).toBe(true);
  expect(result.signals).toBeGreaterThan(0);
  expect(result.rendered).toBe(true);
  expect(result.reset).toEqual({ signals: 0, state: 'paused', disposed: result.signals });
  expect(result.removed).toBe(true);
  expect(result.remainingOptions).not.toContain('Compatibilité');
  expect(result.finalCount).toBe(result.initialCount);
});
