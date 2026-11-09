import { test, expect, activate, expectNoOverflow, expectVisibleHitTarget } from './fixtures.js';

// Seed imposée par l'URL : la grille ne dépend plus que du premier clic.
const GAME = '/games/demineur/index.html?seed=42';
const cell = (page, index) => page.locator(`#board [data-index="${index}"]`);

test('Démineur : premier clic, drapeau et indice entièrement au clavier', async ({ page }) => {
  await page.goto(GAME);
  await expect(page.locator('#board button')).toHaveCount(81);
  await activate(cell(page, 40));
  await expect(cell(page, 40)).toHaveAttribute('aria-label', '(5, 5) : vide');
  await expect(page.locator('#status')).toHaveText(/cases ouvertes$/);
  await expect(cell(page, 40)).toBeFocused();
  // Flèches : on cherche une case fermée, puis F y pose un drapeau.
  const flagged = await page.evaluate(() => [...document.querySelectorAll('#board .hidden')].map(b => Number(b.dataset.index)).find(i => i < 9));
  await page.keyboard.press('Control+Home');
  for (let step = 0; step < flagged; step++) { await page.keyboard.press('ArrowRight'); }
  await expect(cell(page, flagged)).toBeFocused();
  await page.keyboard.press('f');
  await expect(cell(page, flagged)).toHaveAttribute('aria-label', /drapeau$/);
  await expect(page.locator('#mines-left')).toHaveText('9');
  await page.keyboard.press('f');
  await page.keyboard.press('h');
  await expect(page.locator('#reasoning-title')).toHaveText(/^Indice : (ouvrir|drapeau en) \(\d, \d\)$/);
  await expect(page.locator('#reasoning-text')).not.toBeEmpty();
  await expect(page.locator('#board .hint')).toHaveCount(1);
});

test('Démineur : souris, probabilités et victoire en regardant l\'IA', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(GAME);
  await cell(page, 0).click();
  await expect(cell(page, 0)).toHaveClass(/open/);
  const hidden = page.locator('#board .hidden').first();
  await hidden.click({ button: 'right' });
  await expect(page.locator('#board .flag')).toHaveCount(1);
  await page.locator('#board .flag').first().click({ button: 'right' });
  await activate(page.locator('#risks'));
  await expect(page.locator('#risks')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#board .risk').first()).toHaveAttribute('aria-label', /risque/);
  await activate(page.locator('#watch-ai'));
  await expect(page.locator('#reasoning-title')).toHaveText(/^L'IA joue : /);
  await expect(page.locator('#end-dialog')).toHaveClass(/open/, { timeout: 45_000 });
  await expect(page.locator('#end-title')).toHaveText('Grille déminée !');
  await expect(page.locator('#end-record')).toHaveText(/^Partie assistée/);
  await expect(page.locator('#replay')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#end-dialog')).not.toHaveClass(/open/);
  await expect(page.locator('#mines-left')).toHaveText('0');
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test.describe(`Démineur au doigt ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

    test('appui pour ouvrir, appui long et mode drapeau pour marquer', async ({ page }) => {
      await page.goto(GAME);
      await expectNoOverflow(page);
      await cell(page, 40).tap();
      await expect(cell(page, 40)).toHaveClass(/open/);
      const target = page.locator('#board .hidden').first();
      const index = await target.getAttribute('data-index');
      const box = await target.boundingBox();
      const cdp = await page.context().newCDPSession(page);
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await page.waitForTimeout(600);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      await expect(cell(page, index)).toHaveClass(/flag/);
      await expectVisibleHitTarget(page.locator('#flag-mode'));
      await page.locator('#flag-mode').tap();
      await expect(page.locator('#flag-mode')).toHaveAttribute('aria-pressed', 'true');
      await cell(page, index).tap();
      await expect(cell(page, index)).toHaveClass(/hidden/);
      await expect(page.locator('#mines-left')).toHaveText('10');
    });

    test('Expert pivoté pour tenir en largeur, outils toujours à portée', async ({ page }) => {
      await page.goto('/games/demineur/index.html?seed=42&level=expert');
      await expect(page.locator('#board')).toHaveAttribute('aria-label', 'Grille de 16 colonnes et 30 lignes, 99 mines');
      await expectNoOverflow(page);
      await expectVisibleHitTarget(page.locator('#hint'));
      await page.locator('#board button').first().tap();
      await expect(page.locator('#status')).toHaveText(/cases ouvertes$/, { timeout: 15_000 });
      await expectVisibleHitTarget(page.locator('#watch-ai'));
    });
  });
}
