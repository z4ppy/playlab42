import { test, expect, activate, expectNoOverflow } from './fixtures.js';

const root = '/parcours/epics/openspec-usage-guide';

/**
 * Mesure les contrastes des textes réellement rendus, avec leurs fonds composés.
 * Les textes larges demandent 3:1, les autres 4,5:1 (WCAG AA).
 *
 * @param {import('@playwright/test').Locator} slide - Slide à examiner
 * @returns {Promise<object[]>} Textes dont le contraste est insuffisant
 */
function contrastFailures(slide) {
  return slide.evaluate(rootElement => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    function rgba(color) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    }
    function blend(foreground, background) {
      const alpha = foreground[3] / 255;
      return foreground.slice(0, 3).map((value, i) =>
        alpha * value + (1 - alpha) * background[i]);
    }
    function luminance(rgb) {
      const values = rgb.slice(0, 3).map(value => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    }
    const failures = [];
    for (const element of rootElement.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE'].includes(element.tagName) || !element.getClientRects().length) {continue;}
      if (![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) {continue;}
      const style = getComputedStyle(element);
      if (style.visibility !== 'visible') {continue;}
      const ancestors = [];
      for (let parent = element; parent; parent = parent.parentElement) {ancestors.push(parent);}
      let background = [255, 255, 255];
      for (const ancestor of ancestors.reverse()) {
        background = blend(rgba(getComputedStyle(ancestor).backgroundColor), background);
      }
      const foreground = blend(rgba(style.color), background);
      const lum = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
      const ratio = (lum[1] + 0.05) / (lum[0] + 0.05);
      const large = parseFloat(style.fontSize) >= 24
        || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      const required = large ? 3 : 4.5;
      if (ratio < required) {
        failures.push({
          text: element.textContent.trim().slice(0, 80),
          color: style.color,
          background,
          ratio: Number(ratio.toFixed(2)),
          required,
        });
      }
    }
    return failures;
  });
}

for (const { theme, scheme } of [
  { theme: 'light', scheme: 'dark' },
  { theme: 'dark', scheme: 'light' },
  { theme: 'system', scheme: 'light' },
  { theme: 'system', scheme: 'dark' },
]) {
  test(`OpenSpec : contrastes et interactions, thème ${theme}, système ${scheme}`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.addInitScript(theme => {
      localStorage.setItem('playlab42.theme', theme);
    }, theme);
    const epic = await (await page.request.get(`${root}/epic.json`)).json();
    for (const { id } of epic.content) {
      await page.goto(`${root}/slides/${id}/index.html`);
      await expect(page.locator('[data-slide-footer]')).toContainText('/7)');
      if (theme === 'system') {
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
      } else {
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      }
      const quiz = page.locator('[data-guide-quiz]');
      if (await quiz.count()) {
        await activate(quiz.locator('[data-guide-answer="correct"]'));
        await expect(quiz.locator('[data-guide-quiz-result]')).toHaveAttribute('data-state', 'success');
      }
      const terminal = page.locator('.guide-terminal').filter({
        has: page.locator('.guide-copy-button'),
      }).first();
      if (await terminal.count()) {
        const copy = terminal.locator('.guide-copy-button').first();
        const status = terminal.locator('.guide-copy-status').first();
        await activate(copy);
        await expect(status).toHaveAttribute('data-state', 'success');
        expect(await page.evaluate(() => navigator.clipboard.readText())).not.toBe('');
        await expect.poll(() => contrastFailures(page.locator('.slide')), {
          message: `Contrastes des textes, boutons et retours : ${id}`,
        }).toEqual([]);
        await page.evaluate(() => {
          Object.defineProperty(navigator.clipboard, 'writeText', {
            value: () => Promise.reject(new DOMException('Permission refusée', 'NotAllowedError')),
          });
        });
        await activate(copy);
        await expect(status).toHaveAttribute('data-state', 'error');
      }
      await expect.poll(() => contrastFailures(page.locator('.slide')), {
        message: `Contrastes de ${id}, y compris les erreurs de copie`,
      }).toEqual([]);
      await page.setViewportSize({ width: 360, height: 900 });
      await expectNoOverflow(page);
      await page.setViewportSize({ width: 1280, height: 900 });
    }
  });
}
