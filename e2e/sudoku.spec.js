import { test, expect, activate, expectNoOverflow } from './fixtures.js';

/*
 * Parcours navigateur du Sudoku sur le vrai moteur. Le lien « #easy-1234 » fixe la
 * grille : la solution est recalculée dans la page avec le moteur, jamais lue dans le DOM.
 */
const URL = '/games/sudoku/index.html#easy-1234';
const cell = (page, index) => page.locator(`.cell[data-cell="${index}"]`);

/** Index d'une case vide, sa solution et un chiffre faux mais sans conflit visible. */
function pickEmptyCell(page) {
  return page.evaluate(async () => {
    const { SudokuEngine } = await import('./engine.js');
    const { computeCandidates, digitsOf } = await import('./engine/grid.js');
    const state = new SudokuEngine().init({ seed: 1234, playerIds: ['joueur'], difficulty: 'easy' });
    const candidates = computeCandidates(state.givens);
    const index = state.givens.findIndex((value, i) => value === 0 && digitsOf(candidates[i]).length > 1);
    const wrong = digitsOf(candidates[index]).find((digit) => digit !== state.solution[index]);
    return { index, solution: state.solution[index], wrong };
  });
}

async function openGame(page) {
  await page.goto(URL);
  await expect(page.locator('#puzzle-label')).toHaveText('Grille n° 1234 · Facile');
  await expect(page.locator('.cell')).toHaveCount(81);
}

test('Sudoku : saisie clavier, flèches, effacement, annuler et vérification', async ({ page }) => {
  await openGame(page);
  const { index, solution, wrong } = await pickEmptyCell(page);
  await cell(page, index).click();
  await expect(cell(page, index)).toBeFocused();
  await page.keyboard.press(`Digit${wrong}`);
  await expect(cell(page, index)).toHaveAttribute('aria-label', new RegExp(`, ${wrong}$`));
  await activate(page.locator('#check'));
  await expect(cell(page, index)).toHaveClass(/is-error/);
  await expect(cell(page, index)).toHaveAttribute('aria-label', /erreur signalée/);
  await expect(page.locator('#coach-text')).toContainText('1 erreur signalée');
  await cell(page, index).focus();
  await page.keyboard.press('Delete');
  await expect(cell(page, index)).toHaveAttribute('aria-label', /vide$/);
  await page.keyboard.press('Control+z');
  await expect(cell(page, index)).toHaveAttribute('aria-label', new RegExp(`, ${wrong}$`));
  await page.keyboard.press(`Numpad${solution}`);
  await expect(cell(page, index)).toHaveAttribute('aria-label', new RegExp(`, ${solution}$`));
  // Les flèches déplacent le focus d'une case : un seul arrêt Tab pour toute la grille.
  const next = index % 9 === 8 ? index - 1 : index + 1;
  await page.keyboard.press(next > index ? 'ArrowRight' : 'ArrowLeft');
  await expect(cell(page, next)).toBeFocused();
  await expect(page.locator('.cell[tabindex="0"]')).toHaveCount(1);
});

test('Sudoku : indice en deux temps, puis application et annulation', async ({ page }) => {
  await openGame(page);
  await activate(page.locator('#hint'));
  await expect(page.locator('#coach-text')).toContainText(/^Indice \(.+\) : Regardez/);
  await expect(page.locator('.cell.is-hint-focus').first()).toBeVisible();
  await expect(page.locator('.cell.is-hint-target')).toHaveCount(0);
  await expect(page.locator('#hint')).toHaveText('Voir l’explication');
  await activate(page.locator('#hint'), 'Space');
  await expect(page.locator('#coach-text')).toContainText(/\((Singleton caché|Singleton nu)\)/);
  const target = page.locator('.cell.is-hint-target');
  await expect(target).toHaveCount(1);
  const index = Number(await target.getAttribute('data-cell'));
  await activate(page.locator('#apply-hint'));
  await expect(cell(page, index)).toHaveAttribute('aria-label', /, \d$/);
  await expect(page.locator('#apply-hint')).toBeHidden();
  await activate(page.locator('#undo'));
  await expect(cell(page, index)).toHaveAttribute('aria-label', /vide$/);
});

test('Sudoku : pause qui masque la grille et fige le chrono', async ({ page }) => {
  await openGame(page);
  await activate(page.locator('#pause'));
  await expect(page.locator('#pause-cover')).toBeVisible();
  await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pad-digit').first()).toBeDisabled();
  await activate(page.locator('#resume'));
  await expect(page.locator('#pause-cover')).toBeHidden();
  await expect(page.locator('.cell[tabindex="0"]')).toBeFocused();
});

test('Sudoku : la partie en cours est reprise après rechargement', async ({ page }) => {
  await openGame(page);
  const { index, solution } = await pickEmptyCell(page);
  await cell(page, index).click();
  await page.keyboard.press(`Digit${solution}`);
  await page.reload();
  await expect(page.locator('#message')).toHaveText('Partie précédente reprise.');
  await expect(cell(page, index)).toHaveAttribute('aria-label', new RegExp(`, ${solution}$`));
  await activate(page.locator('#undo'));
  await expect(cell(page, index)).toHaveAttribute('aria-label', /vide$/);
});

test('Sudoku : l’IA logique résout la grille et ouvre l’écran de victoire', async ({ page }) => {
  await openGame(page);
  await page.locator('#speed').selectOption('40');
  await activate(page.locator('#ai-run'));
  await expect(page.locator('#ai-log')).toContainText('Singleton');
  const victory = page.locator('#victory');
  await expect(victory).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#victory-summary')).toContainText('avec l’aide de l’IA');
  await expect(page.locator('.cell[aria-label$="vide"]')).toHaveCount(0);
  await activate(victory.locator('button[value="close"]'));
  await expect(victory).toBeHidden();
});

test.describe('Sudoku sur mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('pavé tactile, notes et effacement automatique des notes', async ({ page }) => {
    await openGame(page);
    await expectNoOverflow(page);
    const { index, solution } = await pickEmptyCell(page);
    // Une case voisine sur la même ligne reçoit une note du chiffre que l'on va poser.
    const row = Math.floor(index / 9);
    const peer = await page.evaluate((cells) => cells.find((i) => !document.querySelector(`.cell[data-cell="${i}"]`)
      .classList.contains('is-given')), Array.from({ length: 9 }, (_, column) => row * 9 + column).filter((i) => i !== index));
    await cell(page, peer).tap();
    await page.locator('#notes-mode').tap();
    await expect(page.locator('#notes-mode')).toHaveAttribute('aria-pressed', 'true');
    await page.locator(`.pad-digit[data-digit="${solution}"]`).tap();
    const other = solution === 9 ? 8 : 9;
    await page.locator(`.pad-digit[data-digit="${other}"]`).tap();
    await expect(cell(page, peer)).toHaveAttribute('aria-label', new RegExp(`vide, notes ${Math.min(solution, other)} et ${Math.max(solution, other)}$`));
    await page.locator('#notes-mode').tap();
    await cell(page, index).tap();
    await page.locator(`.pad-digit[data-digit="${solution}"]`).tap();
    await expect(cell(page, index)).toHaveAttribute('aria-label', new RegExp(`, ${solution}$`));
    await expect(cell(page, peer)).toHaveAttribute('aria-label', new RegExp(`vide, note ${other}$`));
    // Retoucher le même chiffre l'efface.
    await page.locator(`.pad-digit[data-digit="${solution}"]`).tap();
    await expect(cell(page, index)).toHaveAttribute('aria-label', /vide$/);
    const board = await page.locator('#board').boundingBox();
    expect(board.width).toBeGreaterThan(300);
    expect(board.x + board.width).toBeLessThanOrEqual(390);
  });
});
