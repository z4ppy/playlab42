import { test, expect, activate, expectNoOverflow } from './fixtures.js';

test('Galerie UI: formulaire reel, contenu echappe et dialogue natif au clavier', async ({ page }) => {
  await page.goto('/tools/ui-kit/index.html');
  await activate(page.locator('#primary'), 'Space');
  await expect(page.locator('#button-status')).toContainText('action principale');
  await page.locator('#card-title').fill('<b>Carte accessible</b>');
  await page.locator('#kind').selectOption({ label: 'Jeu' });
  await page.getByRole('radio', { name: 'Prête à relire' }).check();
  await activate(page.getByRole('button', { name: 'Appliquer à la carte' }));
  await expect(page.locator('#preview-name')).toHaveText('<b>Carte accessible</b>');
  await expect(page.locator('#preview-name b')).toHaveCount(0);
  await expect(page.locator('#preview-kind')).toHaveText('Jeu');
  await expect(page.locator('#preview-state')).toContainText('Prête à relire');
  await activate(page.locator('#open-dialog'));
  const dialog = page.getByRole('dialog', { name: 'Inspecter la carte' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Fermer le dialogue' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  // Le dialogue natif peut tabuler vers le chrome navigateur, pas vers la page inerte.
  await expect.poll(() => dialog.evaluate(element =>
    document.activeElement === document.body || element.contains(document.activeElement),
  )).toBe(true);
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Fermer le dialogue' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#open-dialog')).toBeFocused();
});

test('Galerie UI mobile: themes partages, tokens effectifs et aucun debordement', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/tools/ui-kit/index.html');
  for (const theme of ['light', 'dark']) {
    await page.locator('#theme').selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect.poll(() => page.locator('#token-value').textContent()).toBe(
      await page.locator('html').evaluate(element =>
        getComputedStyle(element).getPropertyValue('--color-bg').trim(),
      ),
    );
    await expectNoOverflow(page);
  }
});

// Contraste WCAG entre la couleur `property` de `selector` et le fond de `backdrop`.
function contrastIn(page, selector, property, backdrop) {
  return page.evaluate(([target, prop, behind]) => {
    // Le canvas normalise toute syntaxe CSS (rgb, color-mix résolu...) en canaux sRGB.
    const channels = color => {
      const context = document.createElement('canvas').getContext('2d');
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const luminance = rgb => {
      const [r, g, b] = rgb.map(value => {
        const v = value / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const front = luminance(channels(getComputedStyle(document.querySelector(target))[prop]));
    const back = luminance(channels(getComputedStyle(document.querySelector(behind)).backgroundColor));
    return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
  }, [selector, property, backdrop]);
}

// Le mode automatique (sans data-theme) doit être aussi soigné que les choix explicites.
const THEME_MODES = [
  { label: 'clair', option: 'light', scheme: 'dark' },
  { label: 'sombre', option: 'dark', scheme: 'light' },
  { label: 'automatique clair', option: 'system', scheme: 'light' },
  { label: 'automatique sombre', option: 'system', scheme: 'dark' },
];

for (const { label, option, scheme } of THEME_MODES) {
  test(`Galerie UI theme ${label}: contours, code, statuts vides et accent lisibles`, async ({ page }) => {
    // Mouvement réduit : la transition de bordure des boutons ne fausse pas la mesure.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/tools/ui-kit/index.html');
    await page.locator('#theme').selectOption(option);
    if (option === 'system') {
      await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    }
    // WCAG 1.4.11 : contour des champs et boutons secondaires >= 3:1 sur leur carte ou la page.
    for (const [control, backdrop] of [
      ['#card-title', '.ui-card:has(#preview-form)'],
      ['#secondary', '.ui-card:has(#primary)'],
      ['#theme', 'body'],
    ]) {
      expect(await contrastIn(page, control, 'borderTopColor', backdrop), `${control} (${label})`)
        .toBeGreaterThanOrEqual(3);
    }
    // Le bloc de code se distingue de sa carte (il était blanc sur blanc en clair).
    expect(await page.locator('#token-code').evaluate(code =>
      getComputedStyle(code.parentElement).backgroundColor !==
        getComputedStyle(code.closest('.ui-card')).backgroundColor,
    )).toBe(true);
    // L'aide reste collée à son champ : seule la grille du formulaire espace les éléments.
    await expect(page.locator('#title-help')).toHaveCSS('margin-top', '0px');
    // Une région de statut encore vide ne dessine pas de barre orpheline.
    await expect(page.locator('#form-status')).toHaveCSS('border-left-color', 'rgba(0, 0, 0, 0)');
    // Le curseur natif prend l'accent du thème courant plutôt que le bleu système.
    const [accentColor, expected] = await page.locator('#spacing').evaluate(range => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--color-accent)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(range).accentColor, color];
    });
    expect(accentColor).toBe(expected);
  });
}

test('Galerie UI: theme change a chaud depuis un autre document', async ({ page, context }) => {
  await page.goto('/tools/ui-kit/index.html');
  await expect(page.locator('#theme')).toHaveValue('system');
  const other = await context.newPage();
  await other.goto('/tools/ui-kit/index.html');
  await other.locator('#theme').selectOption('light');
  // L'événement storage resynchronise document, sélecteur et inspecteur de la première page.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#theme')).toHaveValue('light');
  await expect(page.locator('#token-value')).toHaveText('#f6f8fc');
  await other.close();
});

test('Galerie UI: statuts types, erreur annoncee et curseur avec unite', async ({ page }) => {
  await page.goto('/tools/ui-kit/index.html');
  const title = page.locator('#card-title');
  await title.fill('   ');
  await activate(page.getByRole('button', { name: 'Appliquer à la carte' }));
  await expect(page.locator('#form-status')).toHaveClass(/ui-status-error/);
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(title).toBeFocused();
  await title.fill('Carte valide');
  await expect(title).not.toHaveAttribute('aria-invalid');
  await activate(page.getByRole('button', { name: 'Appliquer à la carte' }));
  await expect(page.locator('#form-status')).toHaveClass(/ui-status-success/);
  await expect(page.getByRole('slider', { name: /Espacement/ })).toHaveAttribute('aria-valuetext', '16 px');
});

test('Galerie UI mobile: dialogue dans la fenetre, code desindente et defilant au clavier', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/tools/ui-kit/index.html');
  await activate(page.locator('#open-dialog'));
  const dialog = page.getByRole('dialog', { name: 'Inspecter la carte' });
  // Avant correction, l'autofocus faisait défiler le dialogue et masquait son titre.
  await expect(dialog.getByRole('heading', { name: 'Inspecter la carte' })).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole('button', { name: 'Fermer le dialogue' })).toBeInViewport({ ratio: 1 });
  const code = dialog.getByRole('region', { name: 'Code HTML de la carte' });
  // toContainText normalise les espaces : lire le texte brut pour vérifier l'indentation.
  const lines = (await code.textContent()).split('\n');
  expect(lines.at(-1)).toBe('</article>');
  expect(lines.slice(1, -1).every(line => /^ {2}<\w/.test(line))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  await expect(code).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect.poll(() => code.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
});
