import { test, expect, activate, expectNoOverflow, expectVisibleHitTarget } from './fixtures.js';

const GAME = '/games/orbital-golf/index.html';

/** Lance l'animation du tir et attend le retour en visée, le bilan ou la carte finale. */
async function waitLanding(scope) {
  await expect(scope.locator('#app')).not.toHaveAttribute('data-phase', 'flying', { timeout: 20_000 });
}

/** Règle la puissance au clavier depuis la visée initiale (40 %). */
async function setPower(page, power) {
  for (let count = 40; count < power; count++) { await page.keyboard.press('ArrowUp'); }
  await expect(page.locator('#readout')).toContainText(`· ${power} %`);
}

/**
 * Glissé de lance-pierre qui vise (angle en dixièmes de degré, puissance) :
 * le doigt part du centre du terrain et tire à l'opposé du tir.
 */
function dragPath(box, angle, power) {
  const pull = Math.min(220, Math.max(110, 0.35 * box.width));
  const length = 14 + (power - 1) / 99 * (pull - 14) + 0.4;
  const radians = angle * Math.PI / 1800;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const end = { x: start.x - Math.cos(radians) * length, y: start.y - Math.sin(radians) * length };
  return Array.from({ length: 9 }, (_, step) => ({
    x: start.x + (end.x - start.x) * step / 8, y: start.y + (end.y - start.y) * step / 8,
  }));
}

/** Glissé tactile réel (CDP) : Chromium produit des PointerEvent de type touch. */
async function touchDrag(page, points) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, point) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 1 }] : [] });
  await send('touchStart', points[0]);
  for (const point of points.slice(1)) { await send('touchMove', point); }
  await send('touchEnd');
  await cdp.detach();
}

async function mouseDrag(page, points) {
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points.slice(1)) { await page.mouse.move(point.x, point.y); }
  await page.mouse.up();
}

/** Distance et direction du trou, lues dans la description accessible du terrain. */
async function holeBearing(scope) {
  const label = await scope.locator('#field').getAttribute('aria-label');
  const match = /trou à (\d+) unités, direction ([\d,]+)°/.exec(label);
  return { distance: Number(match[1]), angle: Math.round(Number(match[2].replace(',', '.')) * 10) };
}

test('Golf orbital: trou 1 entierement au clavier puis trou suivant', async ({ page }) => {
  await page.goto(GAME);
  await activate(page.locator('#btn-start'));
  await expect(page.locator('#field')).toBeFocused();
  await expect(page.locator('#hud-hole')).toHaveText('Trou 1/9');
  await setPower(page, 66);
  await page.keyboard.press('Enter');
  await waitLanding(page);
  await expect(page.locator('#panel-result')).toBeVisible();
  await expect(page.locator('#result-title')).toHaveText('Trou en un');
  await expect(page.locator('#btn-next')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#hud-hole')).toHaveText('Trou 2/9');
  await expect(page.locator('#hud-total')).toHaveText('Total −1');
});

for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test.describe(`Golf orbital au doigt ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

    test('terrain et commandes visibles ensemble, glisser puis confirmer le tir', async ({ page }) => {
      await page.goto(GAME);
      await expectNoOverflow(page);
      await page.locator('#btn-start').tap();
      await expect(page.locator('#app')).toHaveAttribute('data-phase', 'aiming');
      await expect(page.locator('#stage')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('.actions')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('#confirm-shot')).toBeChecked();
      for (const selector of ['#btn-shoot', '#btn-restart', '[data-nudge="angle"][data-step="5"]', '#btn-pause', '#btn-help', '#btn-menu', '#quit']) {
        await expectVisibleHitTarget(page.locator(selector));
        const box = await page.locator(selector).boundingBox();
        expect(Math.min(box.width, box.height), selector).toBeGreaterThanOrEqual(44);
      }
      await expect.poll(() => page.evaluate(() => ({
        canvas: getComputedStyle(document.getElementById('field')).touchAction,
        body: getComputedStyle(document.body).touchAction,
      }))).toEqual({ canvas: 'none', body: 'auto' });
      const box = await page.locator('#field').boundingBox();
      // Revenir au point d'appui annule le geste.
      const back = dragPath(box, 0, 60);
      await touchDrag(page, [...back, back[0]]);
      await expect(page.locator('#status')).toHaveText('Tir annulé.');
      await touchDrag(page, dragPath(box, 0, 66));
      await expect(page.locator('#readout')).toHaveText('Angle 0,0° · 66 %');
      await expect(page.locator('#app')).toHaveAttribute('data-phase', 'aiming');
      // Même source tactile (CDP) que le glissé : mélanger avec locator.tap() perd le clic sous Chromium complet.
      const shoot = await page.locator('#btn-shoot').boundingBox();
      await touchDrag(page, [{ x: shoot.x + shoot.width / 2, y: shoot.y + shoot.height / 2 }]);
      await expect(page.locator('#app')).toHaveAttribute('data-phase', 'holed', { timeout: 20_000 });
      await expect(page.locator('#result-title')).toHaveText('Trou en un');
      await expectVisibleHitTarget(page.locator('#btn-next'));
      await expectNoOverflow(page);
    });
  });
}

test('Golf orbital: la pause fige le vol, la reprise est volontaire', async ({ page }) => {
  await page.goto(GAME);
  await activate(page.locator('#btn-start'));
  // Puissance 1 : la balle dérive 10 s simulées avant d'être perdue en orbite.
  for (let count = 0; count < 4; count++) { await page.keyboard.press('Shift+ArrowDown'); }
  await expect(page.locator('#readout')).toHaveText('Angle 0,0° · 1 %');
  await page.keyboard.press('Space');
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'flying');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#panel-pause')).toBeVisible();
  await expect(page.locator('#btn-resume')).toBeFocused();
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.onGameResume());
  await expect(page.locator('#panel-pause')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'paused');
  await expect(page.locator('#readout')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel-pause')).toBeHidden();
  // La phase affichée suit la reprise : waitLanding attend donc la vraie fin du vol.
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'flying');
  await page.locator('#field').press('Space');
  await waitLanding(page);
  await expect(page.locator('#toast')).toContainText('Perdue en orbite');
  await expect(page.locator('#hud-strokes')).toHaveText('Coups 1');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#panel-pause')).toBeVisible();
});

test('Golf orbital: mouvement reduit et aide au clavier', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(GAME);
  await expect(page.locator('#app')).toHaveAttribute('data-motion', 'reduced');
  await activate(page.locator('#btn-start'));
  await page.keyboard.press('?');
  const dialog = page.locator('#help-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#btn-help-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await setPower(page, 66);
  await page.keyboard.press('Enter');
  await waitLanding(page);
  await expect(page.locator('#result-title')).toHaveText('Trou en un');
});

test('Golf orbital: trou du jour date par le client, stockage refuse signale', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Refus simulé', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Refus simulé', 'SecurityError'); };
  });
  await page.goto(GAME);
  await page.locator('label.mode', { hasText: 'Trou du jour' }).click();
  await activate(page.locator('#btn-start'));
  await expect(page.locator('#hud-hole')).toHaveText('Trou 1/1');
  await expect(page.locator('#status')).toContainText('Trou du jour 2026-01-01');
  // Référence du trou du jour, calculée par le vrai moteur dans ce navigateur.
  const reference = await page.evaluate(async () => {
    const { OrbitalGolfEngine, dailySeed } = await import('/games/orbital-golf/engine.js');
    const state = new OrbitalGolfEngine().init({ mode: 'daily', date: '2026-01-01', seed: dailySeed('2026-01-01'), playerIds: ['e2e'] });
    return state.course[0].reference;
  });
  const box = await page.locator('#field').boundingBox();
  await mouseDrag(page, dragPath(box, reference.angle, reference.power));
  for (let shot = 0; shot < 8 && await page.locator('#panel-final').isHidden(); shot++) {
    await waitLanding(page);
    if (await page.locator('#panel-final').isVisible()) { break; }
    const { distance, angle } = await holeBearing(page);
    await mouseDrag(page, dragPath(box, angle, Math.min(70, Math.round(15 + distance * 0.4))));
  }
  await expect(page.locator('#panel-final')).toBeVisible();
  await expect(page.locator('#final-detail')).toContainText('Trou du jour');
  await expect(page.locator('#storage-notice')).toBeVisible();
  await expect(page.locator('#storage-notice')).toContainText('stockage est indisponible');
});

test('Golf orbital: portail, tir reel, unload puis retour au catalogue', async ({ page }) => {
  await page.goto('/index.html#/games/orbital-golf');
  const frame = page.frameLocator('#game-iframe');
  await activate(frame.locator('#btn-start'));
  await expect(frame.locator('#hud-hole')).toHaveText('Trou 1/9');
  await frame.locator('#field').press('ArrowUp');
  await frame.locator('#field').press('Enter');
  await expect(frame.locator('#hud-strokes')).toHaveText('Coups 1');
  await activate(frame.locator('#btn-pause'));
  await expect(frame.locator('#panel-pause')).toBeVisible();
  await frame.locator('#field').evaluate(() => window.postMessage({ type: 'unload' }, '*'));
  await expect.poll(() => frame.locator('#field').evaluate(() => typeof window.onGamePause)).toBe('undefined');
  await page.reload();
  await activate(frame.locator('#quit'));
  await expect(page.locator('#game-iframe')).not.toHaveAttribute('src', /orbital-golf/);
});
