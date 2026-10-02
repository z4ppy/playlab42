import { test as base, expect } from '@playwright/test';
const unavailableScripts = new Set([
  'https://cdn.jsdelivr.net/npm/@magenta/image@0.2.1',
]);
const cdpEndpoint = process.env.PLAYLAB_CDP_ENDPOINT;

// Le navigateur execute les distributions reelles, jamais les mocks Jest.
export const test = base.extend({
  ...(cdpEndpoint ? {
    browser: [async ({ playwright }, use) => {
      const browser = await playwright.chromium.connectOverCDP(cdpEndpoint);
      try {
        await use(browser);
      } finally {
        // Deconnecter cette session et ses contextes, sans fermer les onglets existants.
        await browser.close();
      }
    }, { scope: 'worker' }],
  } : {}),
  page: async ({ page, baseURL }, use) => {
    const failures = [];
    const origin = new URL(baseURL).origin;
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => {
      if (new URL(response.url()).origin === origin && response.status() >= 400 &&
        ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(response.request().resourceType())) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.clock.setFixedTime(new Date('2026-01-01T12:00:00Z'));
    await page.addInitScript(() => {
      // Seule la source d'aleatoire est fixee; moteurs et simulations restent reels.
      let seed = 42;
      Math.random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    });
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin || !['http:', 'https:'].includes(url.protocol)) {
        await route.continue();
        return;
      }
      if (request.resourceType() === 'script' && !unavailableScripts.has(url.href)) {
        failures.push(`Script externe sans fixture: ${url.href}`);
      }
      // Images/fonts externes et poids ML sont hors contrat de cette suite.
      await route.abort('internetdisconnected');
    });
    await use(page);
    expect(failures, 'Erreurs navigateur ou ressources locales manquantes').toEqual([]);
  },
});

export { expect };

export async function activate(locator, key = 'Enter') {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.focus();
  await expect(locator).toBeFocused();
  await locator.press(key);
}

export async function expectNoOverflow(page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true);
}

export async function expectVisibleHitTarget(locator) {
  await expect(locator).toBeInViewport({ ratio: 1 });
  await expect.poll(() => locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return rect.width >= 24 && rect.height >= 24 &&
      rect.left >= 0 && rect.right <= innerWidth &&
      rect.top >= 0 && rect.bottom <= innerHeight &&
      (hit === element || element.contains(hit));
  }), { message: 'Cible visible, non recouverte et de taille utilisable' }).toBe(true);
}
