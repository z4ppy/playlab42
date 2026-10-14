import { nativeTest as test, expect } from './fixtures.js';

// ONNX utilise les horloges natives ; une trace embarquerait aussi 657 Mo de poids.
test.use({ trace: 'off' });

// Une seule session lourde ; ce scénario s'exécute aussi sur l'archive publiée.
test('GPT-2 autonome : accès protégé, informations repliables et plein écran sans rechargement', async ({ page, baseURL, context }) => {
  test.setTimeout(300_000);
  const origin = new URL(baseURL).origin;
  const external = [];
  const errors = [];
  const fragments = new Set();
  let fragmentRequests = 0;
  // Reproduit le contrôle d'accès d'une prévisualisation authentifiée.
  // Ce cookie de test ne doit pas être supprimé par le chargeur des poids.
  await context.addCookies([{ name: 'preview-session', value: 'test-only', url: origin, httpOnly: true, sameSite: 'Lax' }]);
  await context.route('**/model-v2/gpt2.onnx.part*', async route => {
    const cookie = await route.request().headerValue('cookie');
    if (!cookie?.includes('preview-session=test-only')) {
      await route.fulfill({ status: 401, body: 'Session de prévisualisation requise' });
      return;
    }
    await route.continue();
  });
  context.on('page', child => child.on('pageerror', error => errors.push(error.message)));
  await context.route(url => /^https?:$/.test(url.protocol) && url.origin !== origin,
    route => route.abort('internetdisconnected'));
  context.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== origin && /^https?:$/.test(url.protocol)) { external.push(url.href); }
    if (/\/model-v2\/gpt2\.onnx\.part\d+$/.test(url.pathname)) {
      fragments.add(url.pathname);
      fragmentRequests++;
    }
  });
  await page.goto('/parcours/epics/anatomie-llm/slides/16b-transformer-explainer/index.html');
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: /Ouvrir le laboratoire GPT-2/ }).click();
  const laboratory = await popup;
  await laboratory.setViewportSize({ width: 1800, height: 1000 });
  await expect(laboratory.getByText(/Copie statique locale, hébergée sur ce site/)).toBeVisible();
  const start = laboratory.getByRole('button', { name: 'Charger GPT-2 · 657 Mo', exact: true });
  await expect(start).toBeEnabled();
  expect(fragments.size).toBe(0);
  const firstRequest = laboratory.waitForRequest(/\/model-v2\/gpt2\.onnx\.part\d+$/);
  await start.click();
  expect(await (await firstRequest).headerValue('cookie')).toContain('preview-session=test-only');
  // Le statut prêt n'est affiché qu'après vérification des poids et première inférence.
  await expect(laboratory.getByRole('status')).toContainText('GPT-2 prêt', { timeout: 240_000 });
  await expect(laboratory.locator('.predicted')).toHaveText(/\S/);
  expect(fragments.size).toBe(63);
  const prediction = await laboratory.locator('.predicted').textContent();
  const prompt = laboratory.getByRole('textbox', { name: 'Votre prompt GPT-2' });
  const before = await prompt.innerText();
  await laboratory.getByRole('button', { name: 'Masquer les informations', exact: true }).click();
  await expect(laboratory.locator('#lab-information')).toBeHidden();
  await expect(laboratory.locator('.playlab-guide')).toBeHidden();
  await expect(laboratory.getByRole('button', { name: 'Afficher les informations', exact: true })).toBeFocused();
  await expect(laboratory.locator('.predicted')).toHaveText(prediction);
  const workspace = await laboratory.locator('.playlab-workspace').boundingBox();
  expect(workspace.y).toBeLessThan(70);
  expect(workspace.y + workspace.height).toBeLessThanOrEqual(1001);
  if (await laboratory.evaluate(() => document.fullscreenEnabled)) {
    await laboratory.getByRole('button', { name: 'Plein écran', exact: true }).click();
    await expect.poll(() => laboratory.evaluate(() => document.fullscreenElement?.classList.contains('playlab-lab'))).toBe(true);
    await laboratory.getByRole('button', { name: 'Quitter le plein écran', exact: true }).click();
    await expect.poll(() => laboratory.evaluate(() => document.fullscreenElement)).toBeNull();
  }
  await laboratory.getByRole('button', { name: 'Afficher les informations', exact: true }).click();
  await expect(laboratory.locator('#lab-information')).toBeVisible();
  await expect(laboratory.locator('.playlab-guide')).toBeVisible();
  await expect(laboratory.getByRole('button', { name: 'Masquer les informations', exact: true })).toBeFocused();
  await expect(prompt).toHaveText(before);
  await laboratory.getByRole('button', { name: 'Masquer les informations', exact: true }).click();
  await laboratory.getByRole('button', { name: 'Générer', exact: true }).click();
  await expect(prompt).not.toHaveText(before);
  // Le token tiré peut modifier plusieurs pièces BPE et rejouer toute l'animation.
  await expect(laboratory.locator('.predicted')).toHaveText(/\S/, { timeout: 60_000 });
  expect(fragmentRequests).toBe(63);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await laboratory.screenshot({ path: '/tmp/gpt2-focus-mode.png' });
  await laboratory.close();
  await expect(page.locator('#experiment-root iframe')).toHaveCount(0);
});
