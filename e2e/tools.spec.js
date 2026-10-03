import { test, expect, activate } from './fixtures.js';

test('JSON: action sur la saisie courante, valeurs falsy et erreur annoncee', async ({ page }) => {
  await page.goto('/tools/json-formatter.html');
  const input = page.locator('#input');
  for (const value of ['{"hello":[1,2]}', 'null', 'false', '0']) {
    await input.fill(value);
    await activate(page.locator('#btn-minify'));
    await expect(page.locator('#output')).toHaveText(value);
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  }
  await input.fill('{');
  await activate(page.locator('#btn-format'));
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#output')).toHaveClass(/error/);
  await expect(page.locator('#output')).not.toHaveText('0');
  await input.fill('{"recovered":true}');
  await input.press('Control+Enter');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#output')).toContainText('"recovered": true');
});

test('JSON: la minification explicite annule le formatage differe de la saisie', async ({ page }) => {
  await page.goto('/tools/json-formatter.html');
  await expect(page.locator('#input')).toBeVisible();
  await page.clock.pauseAt(new Date('2026-01-01T12:00:01Z'));
  await page.locator('#input').fill('{"minified":[1,2]}');
  await activate(page.locator('#btn-minify'));
  await page.clock.runFor(350);
  await expect(page.locator('#output')).toHaveText('{"minified":[1,2]}');
  await page.locator('#input').fill('{"edited":true}');
  await page.clock.runFor(350);
  await expect(page.locator('#output')).toHaveText('{\n  "edited": true\n}');
});

test('Particle Life: vrai rendu, pause accessible et matrice editable/randomisee', async ({ page }) => {
  await page.goto('/tools/particle-life/index.html');
  const matrix = page.locator('input[aria-label^="Attraction"]');
  await expect(matrix).toHaveCount(16);
  await expect.poll(() => page.locator('#canvas').evaluate(canvas =>
    [...canvas.getContext('2d').getImageData(0, 0, 1, 1).data].some(value => value !== 0),
  )).toBe(true);
  await activate(page.locator('#playBtn'));
  await expect(page.locator('#playBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#playBtn')).toHaveAccessibleName('Reprendre la simulation');
  const slider = matrix.first();
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveValue('-1');
  await slider.press('ArrowRight');
  await expect(slider).not.toHaveValue('-1');
  const before = await matrix.evaluateAll(inputs => inputs.map(input => input.value));
  await activate(page.locator('#randomBtn'), 'Space');
  await expect.poll(() => matrix.evaluateAll(inputs => inputs.map(input => input.value))).not.toEqual(before);
  await activate(page.locator('#playBtn'), 'Space');
  await expect(page.locator('#playBtn')).toHaveAttribute('aria-pressed', 'false');
});

test('Neural Style hors ligne: erreur annoncee et imports clavier, sans inference ML', async ({ page }) => {
  await page.goto('/tools/neural-style.html');
  // La bibliotheque et les poids CDN sont indisponibles, sans faux modele.
  await expect(page.locator('#status')).toContainText(/Erreur de chargement du mod/);
  await expect.poll(() => page.evaluate(() =>
    typeof window.mi,
  )).toBe('undefined');
  const image = {
    name: 'browser-fixture.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>'),
  };
  for (const [kind, key] of [['content', 'Enter'], ['style', 'Space']]) {
    const chooserPromise = page.waitForEvent('filechooser');
    await activate(page.locator(`#${kind}Zone`), key);
    const chooser = await chooserPromise;
    await chooser.setFiles(image);
    await expect(page.locator(`#${kind}Filename`)).toHaveText(image.name);
    await expect(page.locator(`#${kind}Zone img`)).toBeVisible();
    await expect(page.locator(`#${kind}Zone`)).not.toHaveAttribute('aria-busy', 'true');
  }
  await expect(page.locator('#stylizeBtn')).toBeDisabled();
});
