import { test, expect, activate } from './fixtures.js';

// Smoke multi-moteurs : quelques interactions critiques, sans prétendre couvrir audio, 3D, accessibilité ou performance.

test('portail: navigation clavier des onglets et ouverture d’un jeu', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.epic-card').first()).toBeVisible();
  await page.locator('#tab-parcours').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-tools')).toBeFocused();
  await expect(page.locator('#tab-tools')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-tools')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('#tab-bookmarks')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.locator('#tab-parcours')).toHaveAttribute('aria-selected', 'true');
  await activate(page.locator('#tab-games'));
  await page.locator('#search').fill('Tic-Tac-Toe');
  // Le filtre est différé par le portail : attendre le rendu final évite de cliquer une carte remplacée.
  const cards = page.locator('#cards-games .card');
  await expect(cards).toHaveCount(1);
  await cards.click();
  await expect(page).toHaveURL(/#\/games\/tictactoe$/);
  const frame = page.frameLocator('#game-iframe');
  await frame.locator('#opponent').selectOption('human');
  await activate(frame.locator('#btn-start'));
  await activate(frame.locator('.cell[data-index="0"]'));
  await expect(frame.locator('.cell[data-index="0"]')).toHaveText('X');
});

test('portail: thème et pseudo persistent après rechargement', async ({ page }) => {
  await page.goto('/');
  await activate(page.locator('#btn-settings'));
  await activate(page.locator('#theme-light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#input-pseudo').fill('Ada');
  await activate(page.locator('#btn-close-settings'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await activate(page.locator('#btn-settings'));
  await expect(page.locator('#theme-light')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#input-pseudo')).toHaveValue('Ada');
});

test('outil JSON: saisie invalide annoncée puis récupération au clavier', async ({ page }) => {
  await page.goto('/tools/json-formatter.html');
  const input = page.locator('#input');
  await input.fill('{');
  await activate(page.locator('#btn-format'));
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#output')).toHaveClass(/error/);
  await input.fill('{"recovered":true}');
  await input.press('Control+Enter');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#output')).toContainText('"recovered": true');
});
