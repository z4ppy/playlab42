import { test, expect, activate, expectNoOverflow } from './fixtures.js';

test('portail: onglets natifs, fleches, Home/End et saisie de /', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.epic-card').first()).toBeVisible();
  const first = page.locator('#tab-parcours');
  await first.focus();
  for (const [key, id] of [
    ['ArrowRight', 'tools'], ['End', 'bookmarks'], ['ArrowRight', 'parcours'],
    ['ArrowLeft', 'bookmarks'], ['Home', 'parcours'],
  ]) {
    await page.keyboard.press(key);
    await expect(page.locator(`#tab-${id}`)).toBeFocused();
    await expect(page.locator(`#tab-${id}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await expect(page.locator(`#panel-${id}`)).toBeVisible();
  }
  await page.keyboard.press('/');
  await expect(page.locator('#search')).toBeFocused();
  await page.keyboard.type('/2');
  await expect(page.locator('#search')).toHaveValue('/2');
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await page.locator('#search').fill('');
  await activate(page.locator('#btn-settings'));
  await expect(page.locator('#input-pseudo')).toBeFocused();
  await page.keyboard.type('/3');
  await expect(page.locator('#input-pseudo')).toHaveValue(/\/3$/);
  await activate(page.locator('#btn-close-settings'));
  await expect(page.locator('#btn-settings')).toBeFocused();
  await activate(page.locator('#tab-bookmarks'));
  await expect(page.locator('.bookmark-item a[href="https://cursor.com"]')).toBeVisible();
});

test('portail: filtres secondaires a la demande, resume visible et remise a zero', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.epic-card').first()).toBeVisible();
  const options = page.locator('#discovery-options');
  await expect(options).not.toHaveAttribute('open', '');
  await expect(page.locator('#parcours-category-filters')).toBeHidden();
  await activate(page.locator('#tab-games'));
  await expect(page.locator('#cards-games .card').first()).toBeVisible();
  const initialCount = await page.locator('#cards-games .card').count();
  await expect(page.locator('#filters')).toBeHidden();
  await activate(options.locator('summary'));
  await expect(page.locator('#filters')).toBeVisible();
  await expect(page.locator('#parcours-category-filters')).toBeHidden();
  await expect(page.locator('#bookmark-filters')).toBeHidden();
  const filter = page.locator('#filters .filter').nth(1);
  await activate(filter);
  await expect(filter).toBeFocused();
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  const label = await filter.textContent();
  await activate(options.locator('summary'));
  await expect(filter).toBeHidden();
  await expect(options.locator('summary')).toContainText(label);
  await page.locator('#search').fill('aucun-resultat-impossible');
  await expect(page.locator('#catalogue-status')).toHaveText('0 jeux');
  await expect(page.locator('#empty-games')).toBeVisible();
  await activate(page.locator('#btn-reset-discovery'));
  await expect(page.locator('#search')).toBeFocused();
  await expect(page.locator('#cards-games .card')).toHaveCount(initialCount);
  await expect(page.locator('#btn-reset-discovery')).toBeHidden();
  await expect(options).not.toHaveAttribute('open', '');
  await activate(options.locator('summary'));
  await activate(filter);
  await page.locator('#search').fill('JSON');
  await activate(page.locator('#tab-tools'));
  await expect(page.locator('#search')).toHaveValue('JSON');
  await expect(page.locator('#search')).toHaveAttribute('placeholder', 'Rechercher un outil…');
  await expect(page.locator('#filters .filter.active')).toHaveAttribute('data-tag', '');
  await expect(page.locator('#cards-tools .card').filter({ hasText: 'JSON' })).toHaveCount(1);
  await expect(page.locator('#discovery-filter-label')).toHaveText('Affiner la sélection');
  await expectNoOverflow(page);
});

test('parcours: Enter charge une vraie slide, Escape ferme le plan avant le viewer', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('parcours-menu-width', '350'));
  await page.goto('/');
  await page.locator('#search').fill('Algorithmique');
  const card = page.locator('.epic-card[data-epic-id="algorithm-complexity"]').filter({ visible: true }).first();
  await expect(card).toHaveAttribute('href', '#/parcours/algorithm-complexity');
  await activate(card);
  const viewer = page.locator('.parcours-viewer');
  const menu = page.locator('.pv-btn-menu');
  await expect(page.locator('.pv-slide-frame')).toBeVisible();
  await expect(page.frameLocator('.pv-slide-frame').locator('body')).toContainText(/complexit/i);
  await expect(page.locator('.pv-btn-close')).toBeFocused();
  const frame = page.locator('.pv-slide-frame');
  const firstSlide = await frame.getAttribute('src');
  await expect(page.locator('.pv-btn-prev')).toBeDisabled();
  await activate(page.locator('.pv-btn-next'));
  await expect(frame).not.toHaveAttribute('src', firstSlide);
  await expect(page.locator('.pv-btn-prev')).toBeEnabled();
  await activate(page.locator('.pv-btn-prev'));
  await expect(frame).toHaveAttribute('src', firstSlide);
  await expect(page.locator('.pv-btn-prev')).toBeDisabled();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.pv-sidebar')).toHaveCSS('width', '350px');
  await page.locator('.pv-btn-close').focus();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(viewer).toBeVisible();
  await activate(menu);
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.pv-sidebar')).toHaveCSS('width', '350px');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('#view-catalogue')).toBeVisible();
  await expect(card).toBeFocused();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('parcours-menu-width'))).toBe('350');
  await activate(card);
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.pv-sidebar')).toHaveCSS('width', '350px');
});

test('portail: un outil catalogue demarre dans son iframe', async ({ page }) => {
  await page.goto('/');
  await activate(page.locator('#btn-settings'));
  await activate(page.locator('#theme-light'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await activate(page.locator('#tab-tools'));
  await page.locator('#search').fill('JSON');
  await page.locator('#cards-tools .card').filter({ hasText: 'JSON' }).first().click();
  await expect(page.locator('#game-iframe')).toHaveAttribute('title', /outil.*json/i);
  const frame = page.frameLocator('#game-iframe');
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'light');
  await frame.locator('#input').fill('{"browser":true}');
  await activate(frame.locator('#btn-minify'));
  await expect(frame.locator('#output')).toHaveText('{"browser":true}');
});

test('portail: une nouvelle session GameKit recoit le son sauvegarde puis ses changements', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('preferences', '{"sound":false}'));
  await page.goto('/#/games/tictactoe');
  await expect(page.locator('#game-iframe')).toHaveAttribute('src', /tictactoe/);
  const frame = page.frameLocator('#game-iframe');
  const soundState = () => frame.locator('body').evaluate(async () => {
    const { default: GameKit } = await import('../../lib/gamekit.js');
    return { game: GameKit.gameName, sound: GameKit.isSoundEnabled() };
  });
  await expect.poll(soundState).toEqual({ game: 'tictactoe', sound: false });
  await expect(page.locator('#btn-sound')).toHaveAttribute('aria-pressed', 'false');
  await activate(page.locator('#btn-sound'));
  await expect.poll(soundState).toEqual({ game: 'tictactoe', sound: true });
});

test('portail: seul le GameKit de la session courante peut quitter le jeu', async ({ page }) => {
  await page.goto('/#/games/tictactoe');
  const current = page.frameLocator('#game-iframe');
  const gameName = frame => frame.locator('body').evaluate(async () => {
    const { default: GameKit } = await import('../../lib/gamekit.js');
    return GameKit.gameName;
  });
  await expect.poll(() => gameName(current)).toBe('tictactoe');
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.id = 'foreign-game-iframe';
    iframe.hidden = true;
    iframe.src = '/games/tictactoe/index.html';
    document.body.appendChild(iframe);
  });
  const foreign = page.frameLocator('#foreign-game-iframe');
  await expect.poll(() => gameName(foreign)).toBe('tictactoe');
  await page.evaluate(() => {
    const source = document.getElementById('foreign-game-iframe').contentWindow;
    window.foreignQuitReceived = new Promise(resolve => {
      const listener = event => {
        if (event.source !== source || event.origin !== window.location.origin ||
          event.data?.type !== 'quit' || event.data.game !== 'tictactoe') {return;}
        window.removeEventListener('message', listener);
        resolve();
      };
      window.addEventListener('message', listener);
    });
  });
  await foreign.locator('body').evaluate(async () => {
    const { default: GameKit } = await import('../../lib/gamekit.js');
    GameKit.quit();
  });
  await page.evaluate(() => window.foreignQuitReceived);
  await expect(page).toHaveURL(/\/#\/games\/tictactoe$/);
  await expect(page.locator('#game-iframe')).toBeVisible();
  await expect.poll(() => gameName(current)).toBe('tictactoe');

  await current.locator('body').evaluate(async () => {
    const { default: GameKit } = await import('../../lib/gamekit.js');
    GameKit.quit();
  });
  await expect(page.locator('#view-catalogue')).toBeVisible();
  await expect(page.locator('#game-iframe')).toBeHidden();
});

for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`portail mobile ${viewport.width}x${viewport.height}: catalogue et viewer sans debordement`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.epic-card').first()).toBeVisible();
    await expectNoOverflow(page);
    await activate(page.locator('#tab-games'));
    await expect(page.locator('#cards-games .card').first()).toBeVisible();
    await expectNoOverflow(page);
    await activate(page.locator('#tab-parcours'));
    await page.locator('#search').fill('Algorithmique');
    await activate(page.locator('.epic-card[data-epic-id="algorithm-complexity"]').filter({ visible: true }).first());
    await expect(page.frameLocator('.pv-slide-frame').locator('body')).toContainText(/complexit/i);
    await expectNoOverflow(page);
    await activate(page.locator('.pv-btn-menu'));
    await expect(page.locator('.pv-btn-menu')).toHaveAttribute('aria-expanded', 'true');
    await expectNoOverflow(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('.pv-slide-frame')).toBeVisible();
  });
}

test('themes: choix clavier, persistance et contrat des tokens WCAG AA rendus', async ({ page }) => {
  await page.goto('/');
  await activate(page.locator('#btn-settings'));
  for (const theme of ['light', 'dark']) {
    await activate(page.locator(`#theme-${theme}`));
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator(`#theme-${theme}`)).toHaveAttribute('aria-pressed', 'true');
    const ratios = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const luminance = token => {
        const hex = style.getPropertyValue(token).trim();
        if (!/^#[\da-f]{6}$/i.test(hex)) { throw new Error(`Couleur inattendue: ${token}=${hex}`); }
        const channels = hex.slice(1).match(/.{2}/g).map(channel => {
          const value = parseInt(channel, 16) / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return channels.reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
      };
      const contrast = (a, b) => {
        const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      return [
        ...['--color-bg', '--color-bg-secondary', '--color-bg-card', '--color-bg-hover']
          .map(bg => contrast('--color-text-muted', bg)),
        contrast('--color-accent', '--color-bg-card'),
        contrast('--color-text-inverse', '--color-accent'),
      ];
    });
    for (const ratio of ratios) { expect(ratio).toBeGreaterThanOrEqual(4.5); }
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await activate(page.locator('#btn-settings'));
  await activate(page.locator('#theme-system'));
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('#theme-system')).toHaveAttribute('aria-pressed', 'true');
});
