import { test, expect, expectNoOverflow } from './fixtures.js';

/*
 * Solitaire : la donne n° 1 en pioche 1 est fixée par l'adresse. Au départ,
 * seul le 7 de carreau (colonne 5) peut aller sur le 8 de pique (colonne 6),
 * ce qui découvre le 2 de cœur ; l'as de cœur sort à la 6e pioche.
 */
const GAME = '/games/solitaire/index.html?donne=1&pioche=1';
const card = (page, code) => page.locator(`[data-card="${code}"]`);
const column = (page, index) => page.locator(`[data-pile-zone="tableau-${index}"]`);

/** Glisser souris en plusieurs étapes, de la carte vers le bas de la pile visée. */
async function mouseDrag(page, source, target) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  const start = { x: from.x + from.width / 2, y: from.y + 12 };
  const end = { x: to.x + to.width / 2, y: to.y + to.height - 20 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(start.x + (end.x - start.x) * step / 10, start.y + (end.y - start.y) * step / 10);
  }
  await page.mouse.up();
}

/** Glisser tactile réel (CDP) : Chromium produit des PointerEvent de type touch. */
async function touchDrag(page, source, target) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const point = step => ({
    x: from.x + from.width / 2 + (to.x + to.width / 2 - from.x - from.width / 2) * step / 8,
    y: from.y + 10 + (to.y + to.height - 16 - from.y - 10) * step / 8,
    id: 1,
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(0)] });
  for (let step = 1; step <= 8; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(step)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test.describe('Solitaire au bureau', () => {
  test.use({ reducedMotion: 'reduce' });

  test('indice expliqué, glisser-déposer, annuler et refaire', async ({ page }) => {
    await page.goto(GAME);
    await expect(page.locator('#deal-label')).toHaveText('Donne n° 1 · Pioche 1');
    await page.locator('#btn-hint').click();
    await expect(page.locator('#message')).toHaveText(
      'Déplace le 7 de carreau (colonne 5) sur le 8 de pique (colonne 6) : cela libère une carte cachée en colonne 5.');
    await expect(card(page, '7D')).toHaveClass(/is-hinted/);
    await expect(column(page, 5)).toHaveClass(/is-hint-target/);

    await mouseDrag(page, card(page, '7D'), column(page, 5));
    await expect(column(page, 5).locator('[data-card="7D"]')).toBeVisible();
    await expect(card(page, '2H')).toBeVisible();
    await expect(page.locator('#stat-moves')).toHaveText('1');
    await expect(page.locator('#stat-score')).toHaveText('5');
    await expect(page.locator('#announcer')).toHaveText(
      'Le 7 de carreau va sur le 8 de pique, colonne 6. Carte découverte en colonne 5 : le 2 de cœur.');
    await expect(page.locator('.drag-layer')).toHaveCount(0);

    await page.locator('#btn-undo').click();
    await expect(column(page, 4).locator('[data-card="7D"]')).toBeVisible();
    await expect(card(page, '2H')).toHaveCount(0);
    await expect(page.locator('#btn-redo')).toBeEnabled();
    await page.locator('#btn-redo').click();
    await expect(column(page, 5).locator('[data-card="7D"]')).toBeVisible();
    await expect(page.locator('#btn-redo')).toBeDisabled();
  });

  test('un dépôt refusé ramène la carte, le clic choisit la destination', async ({ page }) => {
    await page.goto(GAME);
    await mouseDrag(page, card(page, '3D'), column(page, 6));
    await expect(column(page, 1).locator('[data-card="3D"]')).toBeVisible();
    await expect(page.locator('#stat-moves')).toHaveText('0');
    await expect(page.locator('.drag-layer')).toHaveCount(0);

    await card(page, '7D').click();
    await expect(column(page, 5).locator('[data-card="7D"]')).toBeVisible();
    for (let draw = 0; draw < 6; draw++) {
      await page.locator('.pile-stock .slot').click();
    }
    await expect(page.locator('.pile-waste [data-card="AH"]')).toBeVisible();
    // Double-clic : un seul coup, l'as monte sur sa fondation.
    await card(page, 'AH').dblclick();
    await expect(page.locator('[data-pile-zone="foundation-1"] [data-card="AH"]')).toBeVisible();
    await card(page, '2H').click();
    await expect(page.locator('[data-pile-zone="foundation-1"] [data-card="2H"]')).toBeVisible();
    await expect(page.locator('#stat-moves')).toHaveText('9');
    // Le 2 de cœur a découvert le 4 de pique : le 3 de carreau y va d'un clic.
    await card(page, '3D').click();
    await expect(column(page, 4).locator('[data-card="3D"]')).toBeVisible();
    await card(page, 'QH').click();
    await expect(page.locator('#message')).toHaveText('Aucune destination pour la dame de cœur.');
  });

  test('tout au clavier : colonnes, prise à l\'Espace, raccourcis', async ({ page }) => {
    await page.goto(GAME);
    await page.locator('#btn-new').focus();
    await page.keyboard.press('Shift+Tab');
    await card(page, 'QH').focus();
    await page.keyboard.press('5');
    await expect(card(page, '7D')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(card(page, '7D')).toHaveClass(/is-selected/);
    await page.keyboard.press('Escape');
    await expect(card(page, '7D')).not.toHaveClass(/is-selected/);
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await expect(card(page, '8S')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(column(page, 5).locator('[data-card="7D"]')).toBeVisible();
    await expect(page.locator('#stat-moves')).toHaveText('1');
    // Un seul arrêt Tab dans la table : l'élément ciblé garde tabindex 0.
    await expect(page.locator('#table [tabindex="0"]')).toHaveCount(1);

    await page.keyboard.press('z');
    await expect(column(page, 4).locator('[data-card="7D"]')).toBeVisible();
    await page.keyboard.press('Control+y');
    await expect(column(page, 5).locator('[data-card="7D"]')).toBeVisible();
    await page.keyboard.press('p');
    await expect(page.locator('.stock-count')).toHaveText('23');
    await page.keyboard.press('i');
    await expect(page.locator('#message')).not.toHaveText(/^Cliquez/);
    // Colonne 2 puis Haut : la défausse ; Entrée tente le déplacement automatique.
    await page.keyboard.press('2');
    await page.keyboard.press('ArrowUp');
    await expect(card(page, '7C')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#message')).toHaveText('Aucune destination pour le 7 de trèfle.');

    await page.keyboard.press('?');
    await expect(page.locator('#dialog-help')).toHaveClass(/is-open/);
    await expect(page.locator('#help-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#dialog-help')).not.toHaveClass(/is-open/);
  });

  test('options : pioche 3 et numéro de donne saisi, puis rejouer la donne', async ({ page }) => {
    await page.goto(GAME);
    await page.locator('#btn-options').click();
    await page.locator('input[name="draw"][value="3"]').check();
    await page.locator('#opt-deal').fill('4242');
    await page.locator('#options-form button[type="submit"]').click();
    await expect(page.locator('#deal-label')).toHaveText('Donne n° 4242 · Pioche 3');
    const first = await page.locator('#table [data-card]').evaluateAll(cards => cards.map(element => element.dataset.card));
    await page.locator('.pile-stock .slot').click();
    await expect(page.locator('.pile-waste [data-card]')).toHaveCount(3);
    await page.locator('#btn-replay').click();
    await expect(page.locator('.pile-waste [data-card]')).toHaveCount(0);
    expect(await page.locator('#table [data-card]').evaluateAll(cards => cards.map(element => element.dataset.card))).toEqual(first);
  });

  test('regarder l\'IA jouer en expliquant ses coups, puis l\'arrêter', async ({ page }) => {
    await page.goto(GAME);
    await page.locator('#btn-watch').click();
    await expect(page.locator('#btn-watch')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#message')).toHaveText(/^IA : Déplace le 7 de carreau/);
    await expect.poll(async () => Number(await page.locator('#stat-moves').textContent()), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);
    await page.locator('#btn-watch').click();
    await expect(page.locator('#btn-watch')).toHaveAttribute('aria-pressed', 'false');
    const moves = await page.locator('#stat-moves').textContent();
    await page.waitForTimeout(1500);
    await expect(page.locator('#stat-moves')).toHaveText(moves);
  });
});

test.describe('Solitaire jusqu\'à la victoire', () => {
  test.use({ reducedMotion: 'reduce' });

  test('l\'IA découvre toutes les cartes, la fin automatique termine, la victoire s\'affiche', async ({ page }) => {
    await page.clock.install();
    await page.goto(GAME);
    await page.locator('#btn-watch').click();
    // Horloge simulée : chaque coup de l'IA est espacé de 900 ms.
    await expect(async () => {
      await page.clock.runFor(900);
      await expect(page.locator('#btn-finish')).toBeVisible({ timeout: 50 });
    }).toPass({ timeout: 60_000, intervals: [0] });
    await page.locator('#btn-watch').click();
    await expect(page.locator('#btn-watch')).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('t');
    await expect(page.locator('#message')).toHaveText('Fin automatique…');
    await page.clock.runFor(60_000);
    await expect(page.locator('#dialog-victory')).toHaveClass(/is-open/);
    await expect(page.locator('#victory-summary')).toContainText('L’IA a joué : victoire non comptée.');
    await expect(page.locator('#victory-new')).toBeFocused();
    await page.locator('#victory-replay').click();
    await expect(page.locator('#stat-moves')).toHaveText('0');
    await expect(page.locator('#deal-label')).toHaveText('Donne n° 1 · Pioche 1');
  });
});

for (const theme of ['light', 'dark']) {
  test(`Solitaire : cartes lisibles en thème ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(GAME);
    const colors = await page.evaluate(() => {
      const red = getComputedStyle(document.querySelector('.card-face.is-red'));
      const black = getComputedStyle(document.querySelector('.card-face.is-black'));
      return [red.color, red.backgroundColor, black.color, black.backgroundColor];
    });
    const luminance = color => {
      const [r, g, b] = color.match(/\d+(\.\d+)?/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => {
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (high + 0.05) / (low + 0.05);
    };
    expect(contrast(colors[0], colors[1])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors[2], colors[3])).toBeGreaterThanOrEqual(4.5);
  });
}

test.describe('Solitaire au doigt, 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });

  test('glisser au doigt, appui pour déplacer, cartes lisibles sans débordement', async ({ page }) => {
    await page.goto(GAME);
    await expectNoOverflow(page);
    const rank = await card(page, '7D').locator('.card-rank').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(rank).toBeGreaterThanOrEqual(12);
    await expect(page.locator('#table')).toBeInViewport();
    await touchDrag(page, card(page, '7D'), column(page, 5));
    await expect(column(page, 5).locator('[data-card="7D"]')).toBeVisible();
    // Juste après un glissé, Chromium ignore parfois le premier tap (voir orbital-golf) : on retape.
    await expect(async () => {
      await page.locator('.pile-stock .slot').tap();
      await expect(page.locator('.stock-count')).toHaveText('23', { timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    for (let draw = 1; draw < 6; draw++) {
      await page.locator('.pile-stock .slot').tap();
    }
    await expect(page.locator('.stock-count')).toHaveText('18');
    await expect(async () => {
      await card(page, 'AH').tap();
      await expect(page.locator('[data-pile-zone="foundation-1"] [data-card="AH"]')).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expectNoOverflow(page);
  });
});
