import { test, expect, activate } from './fixtures.js';

test('Triomino : les listeners lintés ouvrent les règles puis reviennent au portail', async ({ page }) => {
  const opened = [];
  await page.exposeFunction('recordRulesOpen', args => opened.push(args));
  await page.goto('/games/triomino/index.html');
  await page.evaluate(() => {
    window.open = (...args) => {
      window.recordRulesOpen(args);
      return null;
    };
  });
  await activate(page.locator('#btn-rules-setup'));
  await page.locator('#num-players').selectOption('1');
  await page.locator('#bot-count').selectOption('0');
  await page.locator('#seed-input').fill('42');
  await activate(page.locator('#start-btn'));
  await activate(page.locator('.btn-rules'));
  const expected = ['https://www.regledujeu.fr/triominos/', '_blank', 'noopener'];
  await expect.poll(() => opened).toEqual([expected, expected]);

  await page.goto('/games/triomino/index.html');
  await activate(page.locator('#back-btn'));
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.locator('#view-catalogue')).toBeVisible();
});

test('laboratoire : entraînement réel et fermeture de notification sans attribut inline', async ({ page }) => {
  // Seule la frontière Chart externe est simulée, pas le modèle neuronal ni les canvas.
  await page.route('https://cdn.jsdelivr.net/npm/chart.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.Chart = class { constructor(context, config) { this.data = config.data; } update() {} };',
  }));
  await page.goto('/parcours/epics/deep-learning-intro/slides/12-laboratoire/index.html');
  await activate(page.locator('#btn-step'));
  await expect.poll(async () => Number(await page.locator('#metric-epoch').textContent()))
    .toBeGreaterThan(0);
  await expect.poll(async () => Number.isFinite(Number(await page.locator('#metric-loss').textContent())))
    .toBe(true);
  const toast = page.locator('#toast');
  await toast.evaluate(element => element.classList.add('show'));
  await activate(page.locator('#toast-close'));
  await expect(toast).not.toHaveClass(/\bshow\b/);
});
