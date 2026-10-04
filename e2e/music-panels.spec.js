import { test, expect, activate } from './fixtures.js';

const URL = '/games/diese-et-mat/index.html';

// Compte les écouteurs posés sur le panneau synthé pour détecter les doublons à la réouverture.
async function trackSynthListeners(page) {
  await page.addInitScript(() => {
    window.__synthListeners = {};
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, ...rest) {
      const id = this.id || (this.closest && this.closest('#synth-oscillators') ? `osc:${this.dataset.osc}` : '');
      if (id && (id.startsWith('synth-') || id.startsWith('osc:'))) {
        const key = `${id}:${type}`;
        window.__synthListeners[key] = (window.__synthListeners[key] || 0) + 1;
      }
      return original.call(this, type, ...rest);
    };
  });
}

const listeners = (page) => page.evaluate(() => ({ ...window.__synthListeners }));
const value = (page, id) => page.locator(`#synth-${id}-value`);

async function openSynth(page) {
  await activate(page.locator('#btn-synth'));
  await expect(page.locator('#synth-overlay')).toBeVisible();
}

test.describe('Diese : menu et panneau synthétiseur réels', () => {
  test('le menu filtre les exercices et garde catégorie, difficulté et verrouillage cohérents', async ({ page }) => {
    await page.goto(URL);
    const cards = page.locator('.exercise-card');
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    const results = page.locator('.filter-results');
    await expect(results).toContainText(`${total} exercice`);

    await activate(page.locator('[data-filter="category"] [data-value="notes"]'));
    const notes = page.locator('[data-filter="category"] [data-value="notes"]');
    await expect(notes).toHaveAttribute('aria-pressed', 'true');
    await expect(notes).toBeFocused();
    await expect(page.locator('[data-filter="category"] [data-value="all"]')).toHaveAttribute('aria-pressed', 'false');
    const filtered = await cards.count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(total);
    await expect(results).toContainText(`${filtered} exercice`);

    const star = page.locator('[data-filter="difficulty"] [data-value="1"]');
    await activate(star);
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(star).toHaveAttribute('aria-label', 'Difficulté 1');
    expect(await cards.count()).toBeLessThanOrEqual(filtered);

    await page.locator('[data-filter="category"] [data-value="all"]').click();
    await page.locator('[data-filter="difficulty"] [data-value="all"]').click();
    await expect(cards).toHaveCount(total);

    const locked = page.locator('input[data-filter="showLocked"]');
    await locked.uncheck();
    await expect(locked).not.toBeChecked();
    const unlockedOnly = await cards.count();
    expect(unlockedOnly).toBeLessThanOrEqual(total);
    expect(await page.locator('.exercise-card.locked').count()).toBe(0);
    await locked.check();
    await expect(cards).toHaveCount(total);
  });

  test('le menu ouvre le synthé puis le clavier à tour de rôle avec leurs fermetures', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('.exercise-card').first()).toBeVisible();
    await openSynth(page);
    await expect(page.locator('#synth-overlay')).toHaveClass(/visible/);
    await page.locator('#synth-close').click();
    await expect(page.locator('#synth-overlay')).not.toHaveClass(/visible/);

    await activate(page.locator('#btn-piano'));
    await expect(page.locator('#piano-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#piano-overlay')).toBeHidden();

    await openSynth(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#synth-overlay')).not.toHaveClass(/visible/);
    await openSynth(page);
    await page.locator('#synth-overlay').click({ position: { x: 2, y: 2 } });
    await expect(page.locator('#synth-overlay')).not.toHaveClass(/visible/);
  });

  test('preset, type, oscillateur, curseurs et effets agissent dans le vrai panneau', async ({ page }) => {
    await page.goto(URL);
    await openSynth(page);

    const preset = page.locator('#synth-preset-select');
    await expect(preset.locator('optgroup')).toHaveCount(4);
    await expect(preset.locator('option')).not.toHaveCount(0);

    const type = page.locator('#synth-type-select');
    const initialType = await type.inputValue();
    expect(['poly', 'fm', 'pluck', 'membrane', 'metal', 'noise']).toContain(initialType);
    await expect(page.locator('.synth-typed-control.visible').first()).toBeVisible();

    // Un preset de percussion change le type et les contrôles typés visibles.
    await preset.selectOption('percKick');
    await expect(type).toHaveValue('membrane');
    await expect(page.locator('#synth-membrane-octaves')).toBeVisible();
    await expect(page.locator('#synth-fm-harmonicity')).toBeHidden();
    await page.locator('#synth-membrane-octaves').fill('5');
    await expect(value(page, 'membrane-octaves')).toHaveText('5');
    await page.locator('#synth-membrane-pitch-decay').fill('100');
    await expect(value(page, 'membrane-pitch-decay')).toHaveText('0.100s');

    // Retour à un preset polyphonique : oscillateur actif et ADSR.
    await preset.selectOption('piano');
    await expect(type).toHaveValue('poly');
    const oscillators = page.locator('.synth-osc-btn');
    await oscillators.filter({ hasText: 'Square' }).click();
    await expect(oscillators.filter({ hasText: 'Square' })).toHaveAttribute('aria-pressed', 'true');
    await expect(oscillators.filter({ hasText: 'Sine' })).toHaveAttribute('aria-pressed', 'false');

    await page.locator('#synth-attack').fill('500');
    await expect(value(page, 'attack')).toHaveText('500ms');
    await page.locator('#synth-sustain').fill('40');
    await expect(value(page, 'sustain')).toHaveText('40%');
    await page.locator('#synth-release').fill('2000');
    await expect(value(page, 'release')).toHaveText('2.00s');

    // Les types FM, Pluck et Metal exposent leurs propres curseurs.
    await preset.selectOption('electricPiano');
    await expect(type).toHaveValue('fm');
    await expect(page.locator('#synth-fm-harmonicity')).toBeVisible();
    await page.locator('#synth-fm-harmonicity').fill('4.5');
    await expect(value(page, 'fm-harmonicity')).toHaveText('4.5');
    await preset.selectOption('guitarClassic');
    await expect(type).toHaveValue('pluck');
    await page.locator('#synth-pluck-dampening').fill('2000');
    await expect(value(page, 'pluck-dampening')).toHaveText('2000 Hz');
    await preset.selectOption('percHihat');
    await expect(type).toHaveValue('metal');
    await page.locator('#synth-metal-frequency').fill('500');
    await expect(value(page, 'metal-frequency')).toHaveText('500 Hz');

    // Effets : case et curseur.
    const reverb = page.locator('#synth-reverb-enabled');
    await reverb.check();
    await expect(reverb).toBeChecked();
    await page.locator('#synth-reverb-amount').fill('55');
    await expect(value(page, 'reverb-amount')).toHaveText('55%');
    await page.locator('#synth-delay-time').fill('400');
    await expect(value(page, 'delay-time')).toHaveText('400ms');
    await page.locator('#synth-filter-frequency').fill('1500');
    await expect(value(page, 'filter-frequency')).toHaveText('1500 Hz');
    await page.locator('#synth-volume').fill('-20');
    await expect(value(page, 'volume')).toHaveText('-20 dB');
    await reverb.uncheck();
    await expect(reverb).not.toBeChecked();
  });

  test('réouvrir le synthé conserve les réglages sans dupliquer les écouteurs', async ({ page }) => {
    await trackSynthListeners(page);
    await page.goto(URL);
    await openSynth(page);
    await page.locator('#synth-preset-select').selectOption('percKick');
    await page.locator('#synth-membrane-octaves').fill('6');
    await page.locator('#synth-reverb-enabled').check();
    const afterFirstOpen = await listeners(page);
    expect(Object.keys(afterFirstOpen).some((key) => key.startsWith('synth-attack'))).toBe(true);
    expect(afterFirstOpen['synth-attack:input']).toBe(1);
    expect(afterFirstOpen['synth-preset-select:change']).toBe(1);
    expect(afterFirstOpen['osc:sine:click']).toBe(1);

    for (let i = 0; i < 3; i++) {
      await page.locator('#synth-close').click();
      await expect(page.locator('#synth-overlay')).not.toHaveClass(/visible/);
      await openSynth(page);
    }
    expect(await listeners(page)).toEqual(afterFirstOpen);

    await expect(page.locator('#synth-preset-select')).toHaveValue('percKick');
    await expect(page.locator('#synth-type-select')).toHaveValue('membrane');
    await expect(value(page, 'membrane-octaves')).toHaveText('6');
    await expect(page.locator('#synth-reverb-enabled')).toBeChecked();

    // Une seule interaction produit un seul effet visible après plusieurs réouvertures.
    await page.locator('#synth-membrane-octaves').fill('3');
    await expect(value(page, 'membrane-octaves')).toHaveText('3');
    await page.locator('#synth-reverb-enabled').uncheck();
    await expect(page.locator('#synth-reverb-enabled')).not.toBeChecked();
  });
});
