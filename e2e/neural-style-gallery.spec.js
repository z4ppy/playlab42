import { test, expect, activate } from './fixtures.js';

const image = '<svg xmlns="http://www.w3.org/2000/svg" width="330" height="250"><rect width="330" height="250" fill="gold"/></svg>';

async function serveGalleryImages(page) {
  await page.route('https://upload.wikimedia.org/**', async route => {
    const supported = new URL(route.request().url()).pathname.includes('/330px-');
    await route.fulfill({
      status: supported ? 200 : 400,
      contentType: supported ? 'image/svg+xml' : 'text/plain',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: supported ? image : 'Use thumbnail sizes listed on https://w.wiki/GHai',
    });
  });
}

test('Neural Style : les 24 miniatures utilisent une taille Wikimedia standard et se décodent', async ({ page }) => {
  await serveGalleryImages(page);
  await page.goto('/tools/neural-style.html');
  const images = page.locator('.style-card img');
  await expect(images).toHaveCount(24);
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate(element =>
      element.complete && element.naturalWidth === 330 && element.naturalHeight === 250,
    )).toBe(true);
  }
  const urls = await images.evaluateAll(elements => elements.map(element => element.src));
  expect(new Set(urls).size).toBe(24);
  for (const url of urls) {
    expect(new URL(url).hostname).toBe('upload.wikimedia.org');
    expect(new URL(url).pathname).toMatch(/\/330px-/);
  }
});

test('Neural Style : Sunflowers se sélectionne au clavier et reste utilisable dans un canvas', async ({ page }) => {
  await serveGalleryImages(page);
  await page.goto('/tools/neural-style.html');
  await expect(page.locator('#status')).toContainText('Erreur de chargement du modèle');
  const card = page.getByRole('button', { name: 'Choisir Sunflowers, Van Gogh', exact: true });
  await activate(card);
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(card).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#styleFilename')).toHaveText('Sunflowers — Van Gogh');
  await expect(page.locator('#status')).toHaveText('Style "Sunflowers" sélectionné');
  const preview = page.locator('#styleZone img');
  await expect(preview).toBeVisible();
  const pixels = await preview.evaluate(img => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    const pixel = [...context.getImageData(0, 0, 1, 1).data];
    return { pixel, exported: canvas.toDataURL().startsWith('data:image/png;') };
  });
  expect(pixels).toEqual({ pixel: [255, 215, 0, 255], exported: true });
  // Ce contrat image ne remplace pas une preuve d'inférence du modèle distant.
  await expect(page.locator('#stylizeBtn')).toBeDisabled();
});

test('Neural Style : une image indisponible annonce une erreur sans remplacer le style choisi', async ({ page }) => {
  await serveGalleryImages(page);
  await page.goto('/tools/neural-style.html');
  await expect(page.locator('#status')).toContainText('Erreur de chargement du modèle');
  const selected = page.getByRole('button', { name: 'Choisir Sunflowers, Van Gogh', exact: true });
  await activate(selected);
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await page.route('**/330px-The_Scream.jpg', route => route.fulfill({
    status: 429, contentType: 'text/plain', body: 'Too Many Requests',
    headers: { 'Access-Control-Allow-Origin': '*' },
  }));
  const unavailable = page.getByRole('button', { name: 'Choisir The Scream, Munch', exact: true });
  await activate(unavailable, 'Space');
  await expect(page.locator('#status')).toHaveText('Erreur: impossible de charger "The Scream"');
  await expect(page.locator('#status')).toHaveClass('status error');
  await expect(unavailable).not.toHaveAttribute('aria-busy', 'true');
  await expect(unavailable).not.toHaveClass(/loading/);
  await expect(unavailable).toHaveAttribute('aria-pressed', 'false');
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#styleFilename')).toHaveText('Sunflowers — Van Gogh');
});
