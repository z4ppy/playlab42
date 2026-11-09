import { test, expect, activate, expectNoOverflow, expectVisibleHitTarget } from './fixtures.js';

// L'horloge des fixtures est figée : la graine de la partie (Date.now) l'est
// aussi, donc les coups de l'IA sont reproductibles d'une exécution à l'autre.
const PAGE = '/games/puissance-4/index.html';
const column = (page, index) => page.locator(`.p4-column[data-col="${index}"]`);
const status = (page) => page.locator('#status');
const history = (page) => page.locator('#history li');

/** Attend que l'humain ait de nouveau la main (fin du tour de l'IA). */
async function waitHumanTurn(page, moves) {
  await expect(history(page)).toHaveCount(moves, { timeout: 15_000 });
  await expect(status(page)).toContainText(/À .*(vous|Rouge|Jaune).* de jouer|gagne|nul/);
}

test('Puissance 4 : contre l’IA au clavier, réponse calculée dans un Web Worker, indice et annulation', async ({ page }) => {
  const workers = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  await page.goto(PAGE);
  await expect(status(page)).toContainText('À Rouge (vous) de jouer.');

  await activate(column(page, 3));
  await expect(status(page)).toContainText('Rouge (vous) joue en colonne 4.');
  await waitHumanTurn(page, 2);
  await expect(history(page).nth(1)).toHaveText(/Jaune \(l’IA\) joue en colonne \d\./);
  expect(workers.some((url) => url.endsWith('/games/puissance-4/ai/worker.js'))).toBe(true);
  await expect(column(page, 3)).toBeFocused();

  // Flèche gauche puis Espace : colonne 3.
  await page.keyboard.press('ArrowLeft');
  await expect(column(page, 2)).toBeFocused();
  await page.keyboard.press('Space');
  await waitHumanTurn(page, 4);
  await expect(page.locator('#eval-label')).not.toHaveText('Analyse en cours…', { timeout: 15_000 });
  await expect(page.locator('#eval-meter')).toHaveAttribute('aria-valuenow', /^\d+$/);

  await activate(page.locator('#btn-hint'));
  await expect(page.locator('#hint')).toHaveText(/^Indice : colonne [1-7]\. .+/, { timeout: 15_000 });
  await expect(page.locator('.p4-column.is-hint')).toHaveCount(1);

  await activate(page.locator('#btn-undo'));
  await expect(history(page)).toHaveCount(2);
  await expect(status(page)).toContainText('Coup annulé. À Rouge (vous) de jouer.');
  await expect(page.locator('.p4-column.is-hint')).toHaveCount(0);
});

test('Puissance 4 : à deux avec les touches 1 à 7, victoire et alignement gagnant', async ({ page }) => {
  await page.goto(PAGE);
  await page.locator('input[name="mode"][value="duo"]').check();
  await expect(page.locator('#ai-settings')).toBeHidden();
  await activate(page.locator('#btn-new'));
  for (const key of ['1', '2', '1', '2', '1', '2', '1']) {
    await page.keyboard.press(key);
  }
  await expect(status(page)).toContainText('Rouge gagne avec quatre jetons alignés !');
  await expect(page.locator('.p4-disc.is-winning')).toHaveCount(4);
  await expect(column(page, 0)).toHaveAttribute('aria-label', /rouge, rouge, rouge, rouge, 2 cases libres, alignement gagnant/);
  await expect(page.locator('#eval-label')).toHaveText('Partie gagnée par Rouge.');
  await expect(page.locator('#btn-hint')).toBeDisabled();

  // Une colonne pleine se refuse avec un message, sans changer de joueur.
  await activate(page.locator('#btn-undo'));
  await expect(status(page)).toContainText('À Rouge de jouer.');
  for (const key of ['3', '3', '3', '3', '3', '3', '3']) {
    await page.keyboard.press(key);
  }
  await expect(page.locator('#hint')).toHaveText('La colonne 3 est pleine : choisissez-en une autre.');
});

test('Puissance 4 : le niveau Expert punit un jeu naïf et la victoire de l’IA est annoncée', async ({ page }) => {
  await page.goto(PAGE);
  await expect(status(page)).toContainText('À Rouge (vous) de jouer.');
  // L'humain empile sans réfléchir dans les colonnes 1 puis 7.
  const naive = ['1', '1', '1', '7', '7', '7', '2', '2', '2', '6', '6', '6'];
  for (const [index, key] of naive.entries()) {
    if (/gagne|nul/.test(await status(page).textContent())) {
      break;
    }
    await page.keyboard.press(key);
    await waitHumanTurn(page, 2 * (index + 1));
  }
  await expect(status(page)).toContainText('Jaune (l’IA) gagne avec quatre jetons alignés !');
  await expect(page.locator('.p4-disc.is-winning')).toHaveCount(4);
});

test('Puissance 4 : mobile 390 px, tactile, sans débordement et sans animation si réduite', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto(PAGE);
  await expectNoOverflow(page);
  await expectVisibleHitTarget(column(page, 3));
  await expectVisibleHitTarget(page.locator('#btn-undo'));
  await expectVisibleHitTarget(page.locator('#btn-hint'));
  await column(page, 4).click();
  await waitHumanTurn(page, 2);
  await expect(page.locator('.p4-disc.is-dropping')).toHaveCount(0);
  await expectNoOverflow(page);
  await expect(page.locator('#board')).toHaveAttribute('aria-busy', 'false');
});
