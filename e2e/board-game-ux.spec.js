import { test, expect, activate } from './fixtures.js';

function luminance(color) {
  const channels = color.match(/\d+/g).slice(0, 3).map(value => {
    const channel = Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

for (const theme of ['light', 'dark', 'system-light', 'system-dark']) {
  for (const width of [1280, 375]) {
    test(`Morpion : séparations visibles ${theme}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme.endsWith('light') ? 'light' : 'dark' });
      await page.goto('/games/tictactoe/index.html');
      await page.evaluate(theme => {
        if (theme.startsWith('system-')) { document.documentElement.removeAttribute('data-theme'); }
        else { document.documentElement.setAttribute('data-theme', theme); }
      }, theme);
      await page.locator('#opponent').selectOption('human');
      await activate(page.locator('#btn-start'));
      const colors = await page.locator('#board').evaluate(board => ({
        separator: getComputedStyle(board).backgroundColor,
        cell: getComputedStyle(board.querySelector('.cell')).backgroundColor,
      }));
      const values = [luminance(colors.separator), luminance(colors.cell)].sort((a, b) => b - a);
      expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(3);
      await activate(page.locator('.cell[data-index="0"]'));
      await expect(page.locator('.cell[data-index="0"]')).toHaveText('X');
    });
  }
}

test('Go : deux passes ouvrent le marquage, pas le score ; groupes réversibles puis confirmation', async ({ page }) => {
  await page.goto('/games/go-9x9/index.html');
  await page.locator('#bot-select').selectOption('human');
  await activate(page.locator('#btn-start'));
  for (const [x, y] of [[0, 0], [4, 4], [1, 0], [5, 4]]) {
    await activate(page.locator(`.cell[data-x="${x}"][data-y="${y}"]`));
  }
  await activate(page.locator('#btn-pass'));
  await activate(page.locator('#btn-pass'), 'Space');
  await expect(page.locator('#status')).toContainText('Comptage');
  await expect(page.locator('#score-black')).toHaveText('-');
  await expect(page.locator('#score-white')).toHaveText('-');
  await expect(page.locator('#btn-pass')).toBeDisabled();
  const first = page.locator('.cell[data-x="4"][data-y="4"]');
  const second = page.locator('.cell[data-x="5"][data-y="4"]');
  await activate(first);
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(second).toHaveAttribute('aria-label', /groupe mort/);
  await expect(page.locator('.stone.dead')).toHaveCount(2);
  await activate(second, 'Space');
  await expect(page.locator('.stone.dead')).toHaveCount(0);
  await activate(first);
  await activate(page.locator('#btn-confirm-score'));
  await expect(page.locator('#status')).toContainText('Victoire Noir');
  await expect(page.locator('#score-black')).toHaveText('81.0');
  await expect(page.locator('#score-white')).toHaveText('6.5');
  await expect(page.locator('#captures-black')).toHaveText('0');
  await expect(page.locator('#btn-confirm-score')).toBeHidden();
});

test('Go : reprendre efface le marquage et permet de jouer sans perdre les pierres', async ({ page }) => {
  await page.goto('/games/go-9x9/index.html');
  await page.locator('#bot-select').selectOption('human');
  await activate(page.locator('#btn-start'));
  await activate(page.locator('.cell[data-x="4"][data-y="4"]'));
  await activate(page.locator('#btn-pass'));
  await activate(page.locator('#btn-pass'));
  await activate(page.locator('.cell[data-x="4"][data-y="4"]'));
  await expect(page.locator('.stone.dead')).toHaveCount(1);
  await activate(page.locator('#btn-resume-play'));
  await expect(page.locator('#status')).toHaveText('Au tour du joueur Blanc');
  await expect(page.locator('.stone.dead')).toHaveCount(0);
  await expect(page.locator('.stone.black')).toHaveCount(1);
  await activate(page.locator('.cell[data-x="3"][data-y="4"]'));
  await expect(page.locator('.stone.white')).toHaveCount(1);
});
