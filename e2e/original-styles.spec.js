import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { withOriginalStyles } from './original-styles.js';

test('la référence CSS conserve les octets du main avant dédoublonnage', () => {
  const bytes = readFileSync(new URL('./fixtures/styles-before-reduction.json', import.meta.url));
  expect(createHash('sha256').update(bytes).digest('hex'))
    .toBe('92d4c91ac938c4663e14b088a9d828ce5f50fe40db623db4a66d44d468ac732d');
  const reference = JSON.parse(bytes);
  expect(reference.baseSha).toBe('5956cd92f69c2a2d36c9f27fcc838dd6e4dd1290');
  expect(Object.keys(reference.stylesheets)).toHaveLength(4);
  expect(Object.keys(reference.inline)).toHaveLength(6);
  expect(reference.added).toEqual(['/games/game-page.css']);
});

test('la référence détecte une régression et restaure les CSS même après un rejet', async ({ page }) => {
  await page.goto('/games/checkers/index.html');
  await expect(page.locator('#new-game')).toBeVisible();
  await page.evaluate(() => {
    const library = document.createElement('style');
    library.textContent = 'body { --library-marker: unchanged; }';
    document.head.prepend(library);
    const sheet = [...document.styleSheets].find(candidate => candidate.href?.endsWith('/games/game-page.css'));
    const rule = [...sheet.cssRules].find(candidate => candidate.selectorText === '.btn');
    rule.style.setProperty('border-radius', '19px');
  });
  const radius = () => page.locator('#new-game').evaluate(element => getComputedStyle(element).borderRadius);
  const original = await withOriginalStyles(page, () => page.locator('#new-game').evaluate(element => ({
    radius: getComputedStyle(element).borderRadius,
    library: getComputedStyle(document.body).getPropertyValue('--library-marker').trim(),
  })));
  expect(original).toEqual({ radius: '8px', library: 'unchanged' });
  expect(await radius()).toBe('19px');
  const enabled = await page.evaluate(() => [...document.styleSheets].map(sheet => sheet.disabled));
  await expect(withOriginalStyles(page, () => Promise.reject(new Error('Capture refusée'))))
    .rejects.toThrow('Capture refusée');
  expect(await page.evaluate(() => [...document.styleSheets].map(sheet => sheet.disabled))).toEqual(enabled);
  await expect(page.locator('style[data-dedup-original]')).toHaveCount(0);
  expect(await radius()).toBe('19px');
  await page.locator('link[href$="/lib/theme.css"]').evaluate(node => node.remove());
  await expect(withOriginalStyles(page, radius)).rejects.toThrow('Lien de style absent : /lib/theme.css');
});
