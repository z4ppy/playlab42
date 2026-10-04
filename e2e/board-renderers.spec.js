import { test, expect, activate } from './fixtures.js';

test('Dames: le damier rendu signale sélection et destinations puis joue à la souris', async ({ page }) => {
  await page.goto('/games/checkers/index.html');
  await page.locator('#black-player').selectOption('human');
  await activate(page.locator('#new-game'));
  await expect(page.locator('#board > button.square')).toHaveCount(100);
  await expect(page.locator('.piece.white')).toHaveCount(20);
  await expect(page.locator('.piece.black')).toHaveCount(20);

  const pawn = page.locator('[data-row="3"][data-col="2"]');
  await pawn.click();
  await expect(pawn).toHaveClass(/selected/);
  await expect(pawn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.possible-move')).toHaveCount(2);
  await expect(page.locator('[data-row="4"][data-col="3"]')).toHaveAttribute('aria-label', /vide, destination autorisée/);
  await expect(page.locator('#move-message')).toContainText('2 destination(s) autorisée(s)');

  await page.locator('[data-row="4"][data-col="3"]').click();
  await expect(page.locator('[data-row="4"][data-col="3"] .piece')).toHaveClass(/white/);
  await expect(page.locator('[data-row="3"][data-col="2"] .piece')).toHaveCount(0);
  await expect(page.locator('.possible-move, .selected')).toHaveCount(0);
  await expect(page.locator('#status')).toHaveText('Tour du joueur Noir');
});

test('Triomino: les zones de dépôt réelles posent la tuile et marquent la dernière tuile', async ({ page }) => {
  await page.goto('/games/triomino/index.html');
  await page.locator('#num-players').selectOption('1');
  await page.locator('#bot-count').selectOption('0');
  await page.locator('#seed-input').fill('42');
  await activate(page.locator('#start-btn'));
  await expect(page.locator('#board-svg polygon')).toHaveCount(0);
  const rack = page.locator('.rack-button');
  const before = await rack.count();

  await activate(rack.first());
  const zones = page.locator('#board-svg > polygon[aria-hidden="true"]');
  await expect(zones.first()).toBeVisible();
  const zoneCount = await zones.count();
  expect(zoneCount).toBeGreaterThan(0);
  await expect(page.locator('#hint')).toContainText(`${await page.locator('#placement-target option').count()} placement(s) disponible(s)`);

  await zones.first().click();
  const tile = page.locator('#board-svg g[role="img"]');
  await expect(tile).toHaveCount(1);
  await expect(tile).toHaveAttribute('aria-label', /, dernière tuile posée$/);
  await expect(tile).toHaveAttribute('filter', 'url(#last-tile-glow)');
  await expect(tile.locator('text')).toHaveCount(3);
  await expect(zones).toHaveCount(0);
  await expect(rack).toHaveCount(before - 1);
});
