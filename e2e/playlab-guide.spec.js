import { readFileSync } from 'node:fs';
import { test, expect, activate, expectNoOverflow } from './fixtures.js';
import { extractSlideIds } from '../scripts/parcours-utils.js';

const epic = JSON.parse(readFileSync(
  new URL('../parcours/epics/hello-playlab42/epic.json', import.meta.url), 'utf8',
));
const ids = extractSlideIds(epic.content);
const slideUrl = id => `/parcours/epics/${epic.id}/slides/${id}/index.html`;

// Couleurs réellement composées : fonds hérités et alpha compris.
function auditTextContrast() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = color => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  const over = (top, bottom) => {
    const alpha = top[3] / 255;
    return [...top.slice(0, 3).map((value, i) =>
      value * alpha + bottom[i] * (1 - alpha),
    ), 255];
  };
  const luminance = color => color.slice(0, 3).reduce((sum, value, index) => {
    const channel = value / 255;
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const walker = document.createTreeWalker(document.querySelector('.slide'), NodeFilter.SHOW_TEXT);
  const failures = [];
  let checked = 0;
  let node;
  while ((node = walker.nextNode())) {
    if (!node.textContent.trim() || !/[a-zA-ZÀ-ÿ0-9]/.test(node.textContent)) {continue;}
    const element = node.parentElement;
    if (element.closest('script, style')) {continue;}
    const range = document.createRange();
    range.selectNodeContents(node);
    if (![...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0)) {continue;}
    const style = getComputedStyle(element);
    if (style.visibility !== 'visible') {continue;}
    const ancestors = [];
    for (let current = element; current; current = current.parentElement) {
      ancestors.unshift(current);
    }
    const background = ancestors.reduce((color, ancestor) =>
      over(rgba(getComputedStyle(ancestor).backgroundColor), color),
    [255, 255, 255, 255]);
    const foreground = over(rgba(style.color), background);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    const ratio = (values[0] + 0.05) / (values[1] + 0.05);
    const fontSize = Number.parseFloat(style.fontSize);
    const large = fontSize >= 24 || (fontSize >= 18.66 && Number.parseInt(style.fontWeight, 10) >= 700);
    const threshold = large ? 3 : 4.5;
    checked++;
    if (ratio < threshold) {
      failures.push({ text: node.textContent.trim().slice(0, 90), ratio, threshold });
    }
  }
  return { checked, failures };
}

for (const mode of [
  { theme: 'light', colorScheme: 'dark', width: 1280 },
  { theme: 'dark', colorScheme: 'light', width: 1280 },
  { theme: 'system', colorScheme: 'light', width: 390 },
  { theme: 'system', colorScheme: 'dark', width: 390 },
]) {
  test(`guide Playlab42 : onze étapes lisibles, ${mode.theme}/${mode.colorScheme}, ${mode.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: mode.width, height: 900 });
    await page.emulateMedia({ colorScheme: mode.colorScheme, reducedMotion: 'reduce' });
    await page.addInitScript(theme => {
      if (theme === 'system') {
        localStorage.removeItem('playlab42.theme');
      } else {
        localStorage.setItem('playlab42.theme', theme);
      }
    }, mode.theme);
    for (const [index, id] of ids.entries()) {
      await page.goto(slideUrl(id));
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('[data-slide-footer]')).toContainText(`(${index + 1}/${ids.length})`);
      if (mode.theme !== 'system') {
        await expect(page.locator('html')).toHaveAttribute('data-theme', mode.theme);
      }
      await page.locator('details').evaluateAll(elements => {
        for (const element of elements) {element.open = true;}
      });
      await expectNoOverflow(page);
      await expect.poll(async () => (await page.evaluate(auditTextContrast)).failures,
        { message: `Contraste WCAG des textes et blocs de code : ${id}` },
      ).toEqual([]);
      expect((await page.evaluate(auditTextContrast)).checked).toBeGreaterThan(5);
    }
  });
}

test('guide Playlab42 : exercice natif au clavier et nouvelles étapes en lien profond', async ({ page }) => {
  await page.goto(slideUrl('02-methodologies'));
  const answer = page.locator('details').first();
  const summary = answer.locator('summary');
  await expect(answer).not.toHaveAttribute('open', '');
  await activate(summary);
  await expect(answer).toHaveAttribute('open', '');
  await summary.press('Space');
  await expect(answer).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();

  await page.goto(`/#/parcours/${epic.id}/08-specs-skills`);
  await expect(page.locator('.pv-slide-frame')).toHaveAttribute('src', /08-specs-skills\/index\.html$/);
  await expect(page.locator('.pv-progress-text')).toHaveText(`Étape 7 sur ${ids.length}`);
  await activate(page.locator('.pv-btn-next'));
  await expect(page.locator('.pv-slide-frame')).toHaveAttribute('src', /09-kit-contribution\/index\.html$/);
});

test('guide Playlab42 : une référence locale ouvre un onglet sans quitter le parcours', async ({ page }) => {
  await page.goto(`/#/parcours/${epic.id}/01-bienvenue`);
  const slide = page.frameLocator('.pv-slide-frame');
  const opened = page.waitForEvent('popup');
  await activate(slide.getByRole('link', { name: 'Mes données locales' }));
  const reference = await opened;
  try {
    await expect(reference).toHaveURL(/\/tools\/local-data\/index\.html$/);
    await expect(reference.getByRole('heading', { name: 'Mes données locales', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/01-bienvenue$/);
  } finally {
    await reference.close();
  }
});

test('guide Playlab42 : la politique qualité est accessible depuis la CI', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/parcours/${epic.id}/10-qualite-ci`);
  const slide = page.frameLocator('.pv-slide-frame');
  await activate(slide.getByRole('link', { name: 'Lire la politique qualité et le plan de progression' }));
  await expect(page).toHaveURL(/\/docs\/site\/guides\/software-quality\.html$/);
  await expect(page.locator('.guide-prose h1')).toContainText('Qualité logicielle');
  await expect(page.locator('.guide-prose')).toContainText('pas de seuil global');
  await expect(page.getByRole('heading', { name: /^Plan de progression\b/, level: 2 })).toBeVisible();
  await expectNoOverflow(page);
});

test('guide Playlab42 : la feuille de route complète est accessible depuis la conclusion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/parcours/${epic.id}/07-aller-plus-loin`);
  const slide = page.frameLocator('.pv-slide-frame');
  await expect(slide.getByRole('heading', { name: 'Aller plus loin : les points manquants' })).toBeVisible();
  await activate(slide.getByRole('link', { name: "Lire le guide de l'usine et sa feuille de route" }));
  await expect(page).toHaveURL(/\/docs\/site\/guides\/software-factory\.html$/);
  await expect(page.locator('.guide-prose h1')).toContainText("L'usine logicielle Playlab42");
  await expect(page.locator('.guide-prose')).toContainText('cinq métriques');
  await expect(page.locator('.guide-prose')).toContainText('SBOM');
  await expectNoOverflow(page);
});
