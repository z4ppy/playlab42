import { test, expect, expectNoOverflow, expectVisibleHitTarget } from './fixtures.js';

const harness = '/parcours/epics/anatomie-llm/selector-harness.html';

async function openExperience(page, experiment) {
  await page.route(`**${harness}*`, route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/lib/theme.css">
      <link rel="stylesheet" href="/parcours/epics/anatomie-llm/_shared/course.css">
      <link rel="stylesheet" href="/parcours/epics/anatomie-llm/_shared/experience-selection.css">
      </head><body><main class="course-page"><section class="experiment" id="experiment-root"></section></main>
      <script type="module">
        import { initTheme } from '/lib/theme.js';
        import { mountSelectedExperience } from './_shared/experience-selection.js';
        import { modelExperiments, getModel } from './_shared/model-experiments.js';
        import { conceptExperiments } from './_shared/concept-experiments.js';
        import { realTokenizerExperience } from './_shared/real-tokenizers.js';
        initTheme();
        const experiment = new URL(location.href).searchParams.get('experiment');
        window.session = mountSelectedExperience(document.querySelector('#experiment-root'), {
          experiment,
          mountLocal: root => (experiment === 'transformerExplainer' ? modelExperiments.laboratory : modelExperiments[experiment] || conceptExperiments[experiment])(root),
          mountTokenizers: (root, { preferences, signal }) => realTokenizerExperience(root, {
            getModel, preferences, signal, cases: experiment === 'tokenizerCases',
          }),
        });
      </script></body></html>`,
  }));
  await page.goto(`${harness}?experiment=${experiment}`);
  await expect(page.locator('#experiment-root')).toHaveAttribute('data-ready', 'true');
}

test('quatre vrais tokenizers, clavier et comparaison locale sans prompt sauvegardé', async ({ page }) => {
  await openExperience(page, 'tokenizer');
  const selection = page.getByLabel('Tokenizer à observer ou comparer');
  await expect(page.locator('#experiment-root select')).toHaveCount(1);
  await expect(page.locator('[data-tokenizer="luciole"] [data-ready]')).toBeVisible();
  await selection.focus();
  await selection.press('ArrowDown');
  await selection.press('Enter');
  await expect(selection).toHaveValue('gpt2');
  await expect(page.locator('[data-tokenizer="gpt2"] [data-ready]')).toBeVisible();
  await page.getByLabel('Texte à découper').fill('ÉTÉ naïve 👩‍💻');
  await selection.selectOption('compare');
  await expect(page.locator('[data-tokenizer]')).toHaveCount(4);
  await expect(page.locator('[data-tokenizer] [data-ready]')).toHaveCount(4);
  await expect(page.locator('[data-tokenizer="luciole"]')).toContainText('hors vocabulaire');
  await expect(page.locator('[data-tokenizer="bert"]')).toContainText('suppression des accents');
  await expect(page.getByRole('heading', { name: 'Exemple pédagogique · caractères, octets et fusions BPE' })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('preferences')));
  expect(saved.llmChoice).toEqual({ tokenizer: 'compare' });
  expect(JSON.stringify(saved)).not.toContain('naïve');
  await expectNoOverflow(page);
});

test('attention : Luciole utilisable sans mention GPT-2 malgré une ancienne préférence', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('preferences', JSON.stringify({ llmChoice: { models: { attention: 'gpt2' } } }));
  });
  await openExperience(page, 'attention');
  await expect(page.locator('.attention-matrix')).toBeVisible();
  await expect(page.getByLabel('Modèle de cette expérience')).toHaveCount(0);
  await expect(page.locator('#experiment-root')).not.toContainText('GPT-2');
  await page.getByRole('button', { name: 'Réinitialiser l’expérience', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.attention-matrix')).toBeVisible();
});

test('génération réelle Luciole et accès GPT-2 uniquement par lien vers un nouvel onglet', async ({ page }) => {
  await openExperience(page, 'generation');
  await expect(page.locator('.generated-text')).toHaveText('la capitale de la france est');
  await page.getByRole('button', { name: '+ Un token', exact: true }).click();
  await expect(page.locator('.generated-text')).toHaveText('la capitale de la france est paris');
  await expect(page.getByLabel('Modèle de cette expérience')).toHaveCount(0);
  await expect(page.locator('#experiment-root')).not.toContainText('GPT-2');
  await openExperience(page, 'transformerExplainer');
  await expect(page.locator('.generated-text')).toHaveCount(0);
  await expect(page.locator('#experiment-root iframe, #experiment-root select, #experiment-root button')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Ouvrir le laboratoire GPT-2/ })).toHaveAttribute('target', '_blank');
});

test('stockage bloqué et exemples pédagogiques demeurent utilisables', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Stockage bloqué pour ce scénario'); } });
  });
  await openExperience(page, 'tokenizer');
  await expect(page.locator('.choice-storage-notice')).toContainText('stockage local indisponible');
  await page.getByLabel('Tokenizer à observer ou comparer').selectOption('gpt2');
  await expect(page.locator('[data-tokenizer="gpt2"] [data-ready]')).toBeVisible();
  await openExperience(page, 'transformerExplainer');
  await expect(page.getByRole('link', { name: /Ouvrir le laboratoire GPT-2/ })).toBeVisible();
  await openExperience(page, 'rope');
  await expect(page.getByLabel('Modèle de cette expérience')).toHaveCount(0);
  await expect(page.getByLabel('Tokenizer à observer ou comparer')).toHaveCount(0);
  await expect(page.locator('#experiment-root')).toContainText('Exemple pédagogique');
  await expect(page.getByText('Ce qui est réellement calculé', { exact: true })).toBeVisible();
});

test('mobile : comparaison et vue Luciole dans les deux thèmes sans débordement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await openExperience(page, 'tokenizerCases');
    await page.getByLabel('Tokenizer à observer ou comparer').selectOption('compare');
    await expect(page.locator('[data-tokenizer] [data-ready]')).toHaveCount(4);
    await expectNoOverflow(page);
    await openExperience(page, 'embeddings');
    await expect(page.getByLabel('Modèle de cette expérience')).toHaveCount(0);
    await expect(page.locator('#experiment-root')).not.toContainText('GPT-2');
    await expectNoOverflow(page);
    await expect(page.getByRole('button', { name: 'Réinitialiser l’expérience', exact: true })).toBeVisible();
  }
});

test('course.js conserve EOS et la relance, avec un choix de modèle propre à chaque expérience', async ({ page }) => {
  const slides = '/parcours/epics/anatomie-llm/slides';
  await page.goto(`${slides}/15-laboratoire/index.html`);
  await expect(page.getByLabel('Modèle de cette expérience')).toHaveCount(0);
  await page.getByLabel('Température', { exact: true }).fill('0');
  for (let token = 0; token < 3; token++) {
    await page.getByRole('button', { name: '+ Un token', exact: true }).click();
  }
  await expect(page.locator('.generated-text')).toHaveAttribute('data-stopped', 'true');
  await expect(page.locator('.selected-instrument .status')).toContainText('le modèle a terminé');
  await page.getByRole('button', { name: 'Nouvelle génération', exact: true }).click();
  await expect(page.locator('.generated-text')).toHaveText('la capitale de la france est paris');
  await expect(page.locator('.generated-text')).toHaveAttribute('data-stopped', 'false');
  await page.evaluate(() => localStorage.setItem('preferences', JSON.stringify({ llmChoice: { models: { laboratory: 'gpt2' } } })));
  await page.goto(`${slides}/07-attention/index.html`);
  await expect(page.getByLabel('Modèle de cette expérience')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('GPT-2');
  await expect(page.locator('.attention-matrix')).toBeVisible();
  await page.goto(`${slides}/15-laboratoire/index.html`);
  await expect(page.getByLabel('Modèle de cette expérience')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('GPT-2');
  await expect(page.locator('#experiment-root iframe')).toHaveCount(0);
  await page.goto(`${slides}/16b-transformer-explainer/index.html`);
  await expect(page.getByLabel('Modèle de cette expérience')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Ouvrir le laboratoire GPT-2/ })).toBeVisible();
  await page.goto(`${slides}/02-tokenisation/index.html`);
  await expect(page.getByLabel('Tokenizer à observer ou comparer')).toHaveValue('luciole');
});

test('reset tokenizer : texte et BPE initiaux, comparaison conservée', async ({ page }) => {
  await openExperience(page, 'tokenizer');
  await page.getByLabel('Tokenizer à observer ou comparer').selectOption('compare');
  await page.getByLabel('Texte à découper').fill('Le paiement a échoué 👩‍💻');
  await page.getByLabel('Fusions BPE pédagogiques appliquées').fill('0');
  await page.getByRole('button', { name: 'Réinitialiser l’expérience', exact: true }).click();
  await expect(page.getByLabel('Texte à découper')).toHaveValue('la capitale de la france');
  await expect(page.getByLabel('Tokenizer à observer ou comparer')).toHaveValue('compare');
  await expect(page.getByLabel('Tokenizer à observer ou comparer')).toBeFocused();
  const bpe = page.getByLabel('Fusions BPE pédagogiques appliquées');
  await expect.poll(() => bpe.inputValue()).toBe(await bpe.getAttribute('max'));
  await expect(page.locator('[data-tokenizer] [data-ready]')).toHaveCount(4);
});

test('viewer 1280×900 : lecture puis accès au bouton de génération', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/parcours/anatomie-llm/01-un-token');
  const frame = page.frameLocator('.pv-slide-frame');
  await expect(frame.locator('#comprendre')).toBeInViewport();
  await frame.getByRole('link', { name: '2 · Expérimenter', exact: true }).click();
  const advance = frame.getByRole('button', { name: '+ Un token', exact: true });
  await expect(advance).toBeVisible();
  await expect(frame.locator('.experience-choice')).toHaveCSS('align-items', 'center');
  await expect(frame.locator('.calculation-note')).not.toHaveAttribute('open', '');
  expect(await advance.evaluate(node => node.parentElement.nextElementSibling.classList.contains('generated-text'))).toBe(true);
  await advance.scrollIntoViewIfNeeded();
  await expectVisibleHitTarget(advance);
});

test('première expérience : lire, revenir, distinguer le texte généré et annuler', async ({ page }) => {
  await page.goto('/parcours/epics/anatomie-llm/slides/01-un-token/index.html');
  await page.getByRole('link', { name: '1 · Comprendre', exact: true }).click();
  await expect(page.locator('#comprendre')).toBeInViewport();
  await page.getByRole('link', { name: 'Passer à l’expérience ↓' }).click();
  await expect(page.locator('#experience-title')).toBeInViewport();
  await expect(page.locator('.generated-continuation')).toHaveCount(0);
  await page.getByRole('button', { name: '+ Un token', exact: true }).click();
  await expect(page.locator('.generated-text')).toHaveText('la capitale de la france est paris');
  await expect(page.locator('.generated-continuation')).toHaveText('paris');
  await expect(page.locator('#experiment-root')).toContainText('les 100 % indiquent ce choix forcé');
  await page.getByRole('button', { name: '← Revenir', exact: true }).click();
  await expect(page.locator('.generated-text')).toHaveText('la capitale de la france est');
  await expect(page.locator('.generated-continuation')).toHaveCount(0);
});
