import { test, expect, activate, expectNoOverflow } from './fixtures.js';

const route = '/#/parcours/as-code-paradigm';

test('parcours as-code : dix étapes, code lisible, plan intra-slide et aucune ressource externe', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const external = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) { external.push(url.href); }
  });

  await page.goto(route);
  const frame = page.locator('.pv-slide-frame');
  const slide = page.frameLocator('.pv-slide-frame');
  await expect(page.locator('.pv-progress-text')).toHaveText('Étape 1 sur 10');
  await expect(slide.locator('.slide h1')).toHaveText('Pourquoi tout devient du code');

  await page.goto(`${route}/04-gitops`);
  await expect(frame).toHaveAttribute('src', /04-gitops\/index\.html$/);
  const code = slide.locator('.asc-code pre').first();
  await expect(code).toBeVisible();
  expect(['pre', 'pre-wrap']).toContain(await code.evaluate(pre => getComputedStyle(pre).whiteSpace));
  expect(await code.evaluate(pre => Math.round(pre.querySelector('code').offsetHeight / parseFloat(getComputedStyle(pre).lineHeight))))
    .toBeGreaterThanOrEqual(await code.evaluate(pre => pre.textContent.split('\n').length));

  const entry = page.locator('.pv-toc-anchor', { hasText: 'Argo CD et Flux' });
  await activate(entry);
  await expect(slide.locator('#outils')).toBeInViewport();

  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoOverflow(page);
  // Le titre long du fil d'Ariane ne doit pas élargir la colonne du lecteur.
  await expect.poll(() => frame.evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(360);
  await expect.poll(() => frame.evaluate(element =>
    element.contentDocument.documentElement.scrollWidth <= element.contentWindow.innerWidth,
  )).toBe(true);
  expect(external).toEqual([]);
});

test('parcours as-code : l’ancienne étape unique retombe sur la première étape', async ({ page }) => {
  await page.goto(`${route}/01-article`);
  await expect(page.locator('.pv-slide-frame')).toHaveAttribute('src', /01-introduction\/index\.html$/);
  await expect(page.locator('.pv-progress-text')).toHaveText('Étape 1 sur 10');
});

test('parcours as-code : les légendes de tableau restent lisibles à 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const slide = page.frameLocator('.pv-slide-frame');
  // La table partagée passe en display:block : chaque légende doit tenir dans son conteneur défilant.
  for (const step of ['03-infrastructure', '06-catalog']) {
    await page.goto(`${route}/${step}`);
    await expect(page.locator('.pv-slide-frame')).toHaveAttribute('src', new RegExp(`${step}/index\\.html$`));
    const captions = slide.locator('.slide-table-scroll caption');
    await expect(captions.first()).toBeVisible();
    const widths = await captions.evaluateAll(nodes => nodes.map(caption => ({
      caption: Math.round(caption.getBoundingClientRect().width),
      wrapper: caption.closest('.slide-table-scroll').clientWidth,
    })));
    for (const { caption, wrapper } of widths) { expect(caption).toBeLessThanOrEqual(wrapper); }
  }
});
