import { test, expect, activate, expectNoOverflow, expectVisibleHitTarget } from './fixtures.js';

// Le rendu 3D logiciel et sa fermeture depassent parfois le budget standard.
test.setTimeout(60_000);

test('Relativity: demarrage Three reel, impulsion et moteur presse/relache/blur', async ({ page }) => {
  const externalScripts = [];
  page.on('request', request => {
    if (request.resourceType() === 'script' && new URL(request.url()).origin !== new URL(page.url()).origin) {
      externalScripts.push(request.url());
    }
  });
  await page.goto('/tools/relativity-lab/index.html');
  await expect(page.locator('#canvas-container canvas')).toBeVisible();
  await expect(page.locator('#motor-forward')).toBeVisible();
  expect(await page.evaluate(async () => (await import('three')).REVISION)).toBe('186');
  expect(externalScripts).toEqual([]);
  await activate(page.locator('#play-button'));
  await expect(page.locator('#play-button')).toHaveAttribute('aria-pressed', 'true');
  const mass = page.locator('#motor-mass');
  const initialMass = Number(await mass.textContent());
  await activate(page.locator('#motor-fire'));
  await expect.poll(async () => Number(await mass.textContent())).toBeLessThan(initialMass);
  await expect(page.locator('.motor-history-item').first()).toBeVisible();
  for (const [id, key] of [['motor-forward', 'Enter'], ['motor-backward', 'Space']]) {
    const motor = page.locator(`#${id}`);
    await motor.focus();
    await page.keyboard.down(key);
    await expect(motor).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.up(key);
    await expect(motor).toHaveAttribute('aria-pressed', 'false');
  }
  const motor = page.locator('#motor-forward');
  await motor.focus();
  await page.keyboard.down('Space');
  await expect(motor).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#motor-backward').focus();
  await expect(motor).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.up('Space');
  await motor.focus();
  await page.keyboard.down('Enter');
  await expect(motor).toHaveAttribute('aria-pressed', 'true');
  // Contrat window.blur sans dependre du gestionnaire de fenetres du runner headless.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(motor).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.up('Enter');
});

test('Relativity: selection et reset actualisent le cockpit en pause', async ({ page }) => {
  await page.goto('/tools/relativity-lab/index.html');
  await expect(page.locator('#hud-ref-select')).toBeVisible();
  await page.locator('#hud-ref-select').selectOption({ label: 'Alice' });
  await expect(page.locator('#hud-my-name')).toHaveText('Alice');
  await expect(page.locator('#ov-name')).toHaveText('Alice');
  await activate(page.locator('#motor-fire'));
  await expect(page.locator('#motor-mass')).toHaveText('990');
  await activate(page.locator('#reset-button'));
  await expect(page.locator('#motor-mass')).toHaveText('1000');
  await expect(page.locator('#ov-tau')).toHaveText('τ = 0.00 s');
  await expect(page.locator('.motor-history-empty')).toBeVisible();
  await expect(page.locator('#play-button')).toHaveAttribute('aria-pressed', 'false');
});

test('Relativity: carburant invariant à 30/60/144 Hz, pas de poussée en pause', async ({ page }) => {
  await page.goto('/tools/relativity-lab/index.html');
  await expect(page.locator('#motor-forward')).toBeVisible();
  const results = await page.evaluate(() => {
    const app = window.relativityApp;
    app.stop();
    return [30, 60, 144].map(fps => {
      app.simulation.reset();
      app.simulation.play();
      document.getElementById('motor-forward').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      for (let frame = 0; frame < 2 * fps; frame++) {app.simulation.update(1 / fps);}
      const observer = app.simulation.referenceObserver;
      const result = { mass: observer.mass, time: app.simulation.labTime, speed: observer.beta };
      app.simulation.pause();
      app.simulation.update(0.1);
      return { ...result, pausedMass: observer.mass, burning: app.motorPanel.isBurning };
    });
  });
  expect(results[0]).toEqual(results[1]);
  expect(results[1]).toEqual(results[2]);
  expect(results[0].mass).toBeCloseTo(980, 8);
  expect(results[0].pausedMass).toBe(results[0].mass);
  expect(results[0].burning).toBe(false);
});

test('Relativity: annulation pointeur, répétition clavier et destruction', async ({ page }) => {
  await page.goto('/tools/relativity-lab/index.html');
  const motor = page.locator('#motor-forward');
  await expect(motor).toBeVisible();
  await motor.dispatchEvent('pointerdown', { button: 0, pointerId: 1, isPrimary: true });
  await motor.dispatchEvent('pointercancel', { pointerId: 1 });
  await expect(motor).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true, bubbles: true }));
  });
  await expect(page.locator('#play-button')).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => window.relativityApp.dispose());
  await expect(page.locator('#canvas-container canvas')).toHaveCount(0);
  await expect(page.locator('.lil-gui.lil-root')).toHaveCount(0);
  await expect(motor).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(motor).toHaveAttribute('aria-pressed', 'false');
});

test('Relativity: perte de contexte WebGL annoncée sans continuer la physique', async ({ page }) => {
  await page.goto('/tools/relativity-lab/index.html');
  await expect(page.locator('#motor-forward')).toBeVisible();
  await activate(page.locator('#play-button'));
  await page.locator('#canvas-container canvas').dispatchEvent('webglcontextlost', { cancelable: true });
  await expect(page.locator('#simulation-status')).toContainText('WebGL perdu');
  await expect(page.locator('#play-button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#play-button')).toBeDisabled();
  await expect(page.locator('#motor-fire')).toBeDisabled();
  const time = await page.evaluate(() => window.relativityApp.simulation.labTime);
  await expect.poll(() => page.evaluate(() => window.relativityApp.simulation.labTime)).toBe(time);
});

test('Relativity: lil-gui refuse une norme superluminique sans altérer les autres composantes', async ({ page }) => {
  await page.goto('/tools/relativity-lab/index.html');
  const gui = page.locator('.lil-gui.lil-root');
  await expect(gui).toBeVisible();
  await gui.getByRole('button', { name: /Alice$/ }).click();
  const x = gui.getByRole('textbox', { name: 'Vx lab' });
  const y = gui.getByRole('textbox', { name: 'Vy lab' });
  await x.fill('0.8');
  await x.press('Enter');
  await y.fill('0.8');
  await y.press('Enter');
  const velocity = await page.evaluate(() => window.relativityApp.simulation.observers[1].velocity.toArray());
  expect(velocity).toEqual([0.8, 0.3, 0]);
  await expect(page.locator('#simulation-status')).toContainText('Vitesse refusée');
});

test('Relativity: une distribution locale absente affiche un état d’erreur explicite', async ({ page }) => {
  await page.route('**/dist/vendor/three.module.js', route => route.abort('failed'));
  await page.goto('/tools/relativity-lab/index.html');
  await expect(page.locator('#canvas-container [role="alert"]')).toContainText('Modules 3D indisponibles');
  await expect(page.locator('#play-button')).toBeDisabled();
});

test.describe('Relativity tactile réel', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('pincement natif et annulation d’une poussée tactile', async ({ page }) => {
    await page.goto('/tools/relativity-lab/index.html');
    const canvas = page.locator('#canvas-container canvas');
    await expect(canvas).toBeVisible();
    const cdp = await page.context().newCDPSession(page);
    try {
      const rect = await canvas.boundingBox();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      const distance = () => page.evaluate(() => {
        const scene = window.relativityApp.sceneManager;
        return scene.camera.position.distanceTo(scene.controls.target);
      });
      const before = await distance();
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ x: x - 30, y }, { x: x + 30, y }],
      });
      for (const offset of [40, 50, 60]) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: x - offset, y }, { x: x + offset, y }],
        });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(distance).toBeLessThan(before - 0.5);

      const motor = page.locator('#motor-forward');
      await motor.scrollIntoViewIfNeeded();
      const button = await motor.boundingBox();
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2 }],
      });
      await expect(motor).toHaveAttribute('aria-pressed', 'true');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await expect(motor).toHaveAttribute('aria-pressed', 'false');
    } finally {
      await cdp.detach();
    }
  });
});

test('Relativity mobile: controles accessibles a 320/390 et apres rotation paysage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/relativity-lab/index.html');
  await expect(page.locator('#motor-forward')).toBeVisible();
  for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expectNoOverflow(page);
    const motor = page.locator('#motor-forward');
    // Un focus conserve au resize ne relance pas le scroll natif du navigateur.
    await page.locator('#play-button').focus();
    await motor.focus();
    await expect(motor).toBeFocused();
    await expectVisibleHitTarget(motor);
    await page.keyboard.down('Space');
    await expect(motor).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.up('Space');
    await expect(motor).toHaveAttribute('aria-pressed', 'false');
    await motor.hover();
    const controls = page.locator('.motor-thrust-controls');
    const beforePress = await controls.boundingBox();
    expect(beforePress).not.toBeNull();
    await page.mouse.down();
    await expect(motor).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => motor.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || element.contains(hit);
    })).toBe(true);
    await expect.poll(async () => {
      const held = await controls.boundingBox();
      return held ? Math.abs(held.y - beforePress.y) : Infinity;
    }, { message: 'Le statut moteur ne deplace pas la cible pendant la pression' }).toBeLessThanOrEqual(1);
    await page.mouse.up();
    await expect(motor).toHaveAttribute('aria-pressed', 'false');
  }
});
