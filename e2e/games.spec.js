import { test, expect, activate } from './fixtures.js';

test('Dames: deplacement legal avec fleches, Enter et Espace', async ({ page }) => {
  await page.goto('/games/checkers/index.html');
  await page.locator('#black-player').selectOption('human');
  await activate(page.locator('#new-game'));
  await activate(page.locator('[data-row="3"][data-col="0"]'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(page.locator('[data-row="4"][data-col="1"]')).toHaveAttribute('aria-label', /pion blanc/);
  await expect(page.locator('[data-row="4"][data-col="1"]')).toBeFocused();
});

test('Go: les deux humains jouent puis passent dans le vrai moteur', async ({ page }) => {
  await page.goto('/games/go-9x9/index.html');
  await page.locator('#bot-select').selectOption('human');
  await activate(page.locator('#btn-start'));
  await activate(page.locator('.cell[data-x="0"][data-y="0"]'));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(page.locator('.cell[data-x="0"][data-y="0"]')).toHaveAttribute('aria-label', /pierre noire/);
  await expect(page.locator('.cell[data-x="1"][data-y="0"]')).toHaveAttribute('aria-label', /pierre blanche/);
  await expect(page.locator('.cell[data-x="1"][data-y="0"]')).toBeFocused();
  await activate(page.locator('#btn-pass'));
  await activate(page.locator('#btn-pass'), 'Space');
  await expect(page.locator('#status')).toContainText('Comptage');
  await expect(page.locator('#score-black')).toHaveText('-');
  await activate(page.locator('#btn-confirm-score'));
  await expect(page.locator('#status')).toContainText(/termin|gagn|victoire|score/i);
});

test('Triomino: selection, rotation, placement reel et dialogue avec retour du focus', async ({ page }) => {
  await page.goto('/games/triomino/index.html');
  await page.locator('#num-players').selectOption('1');
  await page.locator('#bot-count').selectOption('0');
  await page.locator('#seed-input').fill('42');
  await activate(page.locator('#start-btn'));
  const rack = page.locator('.rack-button');
  await expect(rack.first()).toBeVisible();
  const before = await rack.count();
  const tileId = await rack.evaluateAll(buttons => {
    const nonTriple = buttons.find(button => new Set(button.textContent.match(/\d/g)).size > 1);
    if (!nonTriple) { throw new Error('La seed 42 doit fournir une tuile non triple.'); }
    return nonTriple.dataset.tileId;
  });
  await activate(page.locator(`.rack-button[data-tile-id="${tileId}"]`));
  await expect(page.locator(`.rack-button[data-tile-id="${tileId}"]`)).toHaveAttribute('aria-pressed', 'true');
  const target = page.locator('#placement-target');
  const initial = await target.inputValue();
  await activate(page.locator('#rotate-tile'));
  await expect(target).not.toHaveValue(initial);
  const placedValues = (await target.locator('option:checked').textContent()).split('sommets ')[1];
  await activate(page.locator('#place-tile'), 'Space');
  await expect(page.locator('#board-svg g[role="img"]')).toHaveCount(1);
  await expect(page.locator('#board-svg g[role="img"]')).toHaveAttribute('aria-label', new RegExp(`Tuile ${placedValues},`));
  await expect(rack).toHaveCount(before - 1);
  await expect(page.locator(`.rack-button[data-tile-id="${tileId}"]`)).toHaveCount(0);
  await expect(page.locator('.rack-button:focus')).toHaveCount(1);
  await activate(page.locator('#btn-quit'));
  const dialog = page.locator('#confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.btn-confirm-yes')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('.btn-confirm-no')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('.btn-confirm-yes')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#btn-quit')).toBeFocused();
});

test('Mastermind: palette et pions natifs soumettent une tentative', async ({ page }) => {
  await page.goto('/games/mastermind/index.html');
  await activate(page.locator('.color-button[data-color="R"]'));
  await expect(page.locator('button.peg').first()).toHaveAttribute('aria-label', /rouge/i);
  await activate(page.locator('button.peg').first());
  await expect(page.locator('button.peg').first()).toHaveAttribute('aria-label', /bleu/i);
  for (const [color, key] of [['B', 'Enter'], ['G', 'Space'], ['Y', 'Enter']]) {
    await activate(page.locator(`.color-button[data-color="${color}"]`), key);
  }
  await activate(page.locator('#submit-btn'));
  await expect(page.locator('#attempt-count')).toHaveText('1 / 10');
  await expect(page.locator('#attempts-grid .attempt-row')).toHaveCount(1);
  await expect(page.locator('button.peg')).toHaveCount(4);
  for (const peg of await page.locator('button.peg').all()) {
    await expect(peg).toHaveAttribute('aria-label', /vide/);
  }
});

test('TicTacToe: deux joueurs au clavier produisent une vraie victoire', async ({ page }) => {
  await page.goto('/games/tictactoe/index.html');
  await page.locator('#opponent').selectOption('human');
  await activate(page.locator('#btn-start'));
  await activate(page.locator('.cell[data-index="0"]'));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(page.locator('.cell[data-index="0"]')).toHaveText('X');
  await expect(page.locator('.cell[data-index="1"]')).toHaveText('O');
  for (const index of [3, 4, 6]) {
    await activate(page.locator(`.cell[data-index="${index}"]`));
  }
  await expect(page.locator('#status')).toContainText(/gagn/i);
  await expect(page.locator('.cell[data-index="6"]')).toHaveAttribute('aria-label', /ligne gagnante/);
});

test('Diese: filtre natif et note maintenue dans un dialogue clavier', async ({ page }) => {
  await page.goto('/games/diese-et-mat/index.html');
  const filter = page.locator('.filter-btn[data-value="notes"]');
  await activate(filter);
  await expect(page.locator('.filter-btn[data-value="notes"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.filter-btn[data-value="notes"]')).toBeFocused();
  await activate(page.locator('#btn-piano'));
  const dialog = page.locator('#piano-overlay');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#piano-close')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  const note = page.locator('.piano-key[data-note="F#5"]');
  await note.focus();
  for (const key of ['Enter', 'Space']) {
    await page.keyboard.down(key);
    await expect(note).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.up(key);
    await expect(note).toHaveAttribute('aria-pressed', 'false');
  }
  await expect.poll(() => page.evaluate(async () => {
    const Tone = await import('tone');
    return Tone.getContext().state;
  })).toBe('running');
  await expect(page.locator('#piano-note-display')).not.toContainText('Audio indisponible');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#btn-piano')).toBeFocused();
});

test('Diese: echec du bundle audio annonce sans bloquer le clavier ni la fermeture', async ({ page }) => {
  await page.route('**/assets/vendor/tone/tone.js', route => route.abort('internetdisconnected'));
  await page.goto('/games/diese-et-mat/index.html');
  await activate(page.locator('#btn-piano'));
  const dialog = page.locator('#piano-overlay');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#piano-close')).toBeFocused();
  const note = page.locator('.piano-key[data-note="C4"]');
  await note.focus();
  await expect(note).toBeFocused();
  await page.keyboard.down('Enter');
  await expect(note).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#piano-note-display')).toContainText('Audio indisponible');
  await page.keyboard.up('Enter');
  await expect(note).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#btn-piano')).toBeFocused();
});
