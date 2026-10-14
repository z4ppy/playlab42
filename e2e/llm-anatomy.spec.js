import { test, expect, expectNoOverflow } from './fixtures.js';
import { chapters } from '../parcours/epics/anatomie-llm/_shared/chapters.js';

const epic = '/parcours/epics/anatomie-llm';
const slide = id => `${epic}/slides/${id}/index.html`;

test('tirage pédagogique : aucun modèle, filtres lisibles, comptes remis à zéro et égalité', async ({ page }) => {
  const modelRequests = [];
  await page.route('**/assets/model.json', route => { modelRequests.push(route.request().url()); return route.abort(); });
  await page.goto(slide('10-tirage'));
  await expect(page.locator('#experiment-root')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.example-badge')).toHaveText('Exemple pédagogique');
  const initial = page.locator('[data-distribution="initial"] .bar-value');
  const final = page.locator('[data-distribution="final"] .bar-value');
  await expect(initial).toHaveText(['40.0 %', '30.0 %', '20.0 %', '8.0 %', '2.0 %']);
  await expect(page.getByLabel('Top-p', { exact: true })).toHaveValue('1');
  await expect(final).toHaveText(['40.0 %', '30.0 %', '20.0 %', '8.0 %', '2.0 %']);
  await page.getByLabel('Top-p', { exact: true }).fill('0.8');
  await expect(final).toHaveText(['44.4 %', '33.3 %', '22.2 %', '0.0 %', '0.0 %']);
  await page.getByRole('button', { name: 'Tirer une fois', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter 100 tirages', exact: true }).click();
  await expect(page.locator('.sampling-lesson .status')).toContainText('101 tirages cumulés');
  await page.getByLabel('Température', { exact: true }).fill('0');
  await expect(final.first()).toHaveText('100.0 %');
  await expect(initial.first()).toHaveText('40.0 %');
  await expect(page.getByLabel('Top-p', { exact: true })).toHaveValue('0.8');
  await expect(page.locator('.sampling-lesson .status')).toContainText('Aucun tirage');
  await page.getByLabel('Situation de départ').selectOption('equal');
  await page.getByLabel('Top-p', { exact: true }).fill('1');
  await page.getByLabel('Température', { exact: true }).fill('2');
  await expect(final).toHaveText(Array(5).fill('20.0 %'));
  await page.getByLabel('Top-k').fill('2');
  await expect(final).toHaveText(['50.0 %', '50.0 %', '0.0 %', '0.0 %', '0.0 %']);
  await page.getByText('Voir le détail des filtres', { exact: true }).click();
  await expect(page.locator('.sampling-filtering')).toContainText('Écarté par top-k');
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoOverflow(page);
  }
  await page.getByRole('button', { name: 'Réinitialiser l’expérience', exact: true }).click();
  await expect(initial.first()).toHaveText('40.0 %');
  await expect(page.getByLabel('Top-p', { exact: true })).toHaveValue('1');
  await expect(final.first()).toHaveText('40.0 %');
  expect(modelRequests).toEqual([]);
});

test('génération : un choix forcé à 100 % reste distinct des probabilités du modèle', async ({ page }) => {
  await page.goto(slide('01-un-token'));
  await page.getByLabel('Prompt d’exemple').selectOption('le chat');
  await page.getByLabel('Température', { exact: true }).fill('0');
  await expect(page.locator('.initial-confidence')).toContainText('62.7 %');
  await page.getByText('Comparer avec les probabilités avant réglage', { exact: true }).click();
  await expect(page.locator('.initial-probabilities .bar-value').first()).toHaveText('62.7 %');
  const panel = page.locator('.initial-confidence').locator('..');
  await expect(panel.locator(':scope > .bar-chart .bar-value').first()).toHaveText('100.0 %');
  await page.getByLabel('Température', { exact: true }).fill('1');
  await expect(page.locator('.initial-probabilities')).toHaveAttribute('open', '');
  await expect(panel.locator(':scope > .bar-chart .bar-value').first()).toHaveText('62.7 %');
});

test('Q/K/V, cache et code restent lisibles sans JavaScript, sur mobile', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    for (const id of ['06b-tetes', '12-memoire', '14-apprentissage']) {
      await page.goto(new URL(slide(id), baseURL).href);
      await expect(page.locator('.reading-diagram').first()).toBeVisible();
      const detail = page.locator('.code-reading');
      await detail.locator('summary').click();
      await expect(detail.locator('pre')).toBeVisible();
      await expectNoOverflow(page);
      const sourceLink = detail.getByRole('link', { name: 'Lire le fichier complet dans Playlab42 ↗' });
      const popupPromise = page.waitForEvent('popup');
      await sourceLink.click();
      const source = await popupPromise;
      await source.waitForLoadState();
      const fragment = new URL(source.url()).hash;
      await expect(source.locator(fragment)).toBeVisible();
      await expect(source.locator('.source-file pre').first()).toContainText('export function forward');
      await expectNoOverflow(source);
      await source.close();
    }
  } finally {
    await context.close();
  }
});

test('les instruments locaux fonctionnent sans réseau externe et leurs défis répondent', async ({ page, baseURL }) => {
  test.setTimeout(60000);
  const external = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== new URL(baseURL).origin) { external.push(request.url()); }
  });
  for (const chapter of chapters) {
    await page.goto(slide(chapter.id));
    await expect(page.locator('#experiment-root')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('h1')).toBeVisible();
    const reading = await page.locator('.explanation').boundingBox();
    const experiment = await page.locator('.experiment').boundingBox();
    expect(reading.y + reading.height).toBeLessThan(experiment.y);
    if (!['transformerExplainer', 'tokenizer', 'tokenizerCases'].includes(chapter.experiment)) {
      await expect(page.locator('main')).not.toContainText('GPT-2');
      await expect(page.getByLabel('Modèle de cette expérience')).toHaveCount(0);
    }
    for (const axis of await page.locator('.plot path.axis').all()) {
      await expect(axis).toHaveCSS('fill', 'none');
    }
    await page.locator('#challenge-choices button').nth(chapter.answer).click();
    await expect(page.locator('#challenge-feedback')).toContainText('Exact.');
    await expectNoOverflow(page);
  }
  expect(external).toEqual([]);
});

test('laboratoire : calcul, retour, reset, vocabulaire et contexte cohérents', async ({ page }) => {
  await page.goto(slide('15-laboratoire'));
  const temperature = page.getByLabel('Température', { exact: true });
  await expect(temperature).toBeVisible();
  await temperature.fill('0');
  await page.getByRole('button', { name: '+ Un token', exact: true }).click();
  await expect(page.locator('.generated-text')).toHaveText('la capitale de la france est paris');
  await page.getByRole('button', { name: '← Revenir', exact: true }).click();
  await expect(page.locator('.generated-text')).toHaveText('la capitale de la france est');
  await page.getByRole('button', { name: '+ Un token', exact: true }).click();
  await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();
  await expect(page.locator('.generated-text')).toHaveText('la capitale de la france est');
  await page.getByLabel('Votre prompt').fill('la capitale de la belgique est');
  await temperature.fill('0.1');
  await expect(page.getByRole('button', { name: '+ Un token', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Appliquer le prompt' }).click();
  await temperature.fill('0');
  await page.getByRole('button', { name: '+ Un token', exact: true }).click();
  await expect(page.locator('.generated-text')).toHaveText('la capitale de la belgique est bruxelles');
  await page.getByLabel('Votre prompt').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Appliquer le prompt' }).click();
  await expect(page.getByRole('alert')).toContainText('Hors vocabulaire');
  await expect(page.getByRole('button', { name: '+ Un token', exact: true })).toBeDisabled();
  await expect(page.locator('#experiment-root img')).toHaveCount(0);
});

test('clavier, filtres de tirage, RoPE et cache restent manipulables', async ({ page }) => {
  await page.goto(slide('10-tirage'));
  await page.getByLabel('Température', { exact: true }).fill('0');
  await expect(page.locator('#experiment-root')).toContainText('1 candidat retenu');
  await page.getByRole('button', { name: 'Ajouter 100 tirages', exact: true }).click();
  await expect(page.locator('.bar-value').filter({ hasText: '100 / 100' })).toHaveCount(1);
  await page.goto(slide('06-position'));
  const metric = page.locator('.metric strong').first();
  await expect(metric).toBeVisible();
  const before = await metric.textContent();
  await page.getByLabel('Position m').focus();
  await page.getByLabel('Position m').press('ArrowRight');
  await expect(metric).toHaveText(before);
  await page.getByLabel('Écart n − m').fill('6');
  await expect(metric).not.toHaveText(before);
  await page.goto(slide('12-memoire'));
  await page.getByText('Facultatif · estimer la mémoire d’un grand modèle hypothétique', { exact: true }).click();
  await expect(page.locator('.metric strong').nth(1)).toHaveText('2.00');
  await page.getByLabel('Séquences simultanées').fill('8');
  await expect(page.locator('.metric strong').nth(1)).toHaveText('4.00');
});

test('les instruments et annexes restent lisibles sur mobile, dans les deux thèmes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const id of ['01-un-token', '01b-luciole', '02-tokenisation', '04-embeddings', '07-attention', '12-memoire', '14-apprentissage', '15-laboratoire', '18-glossaire']) {
      await page.goto(slide(id));
      if (id !== '18-glossaire') { await expect(page.locator('#experiment-root')).toHaveAttribute('data-ready', 'true'); }
      await expectNoOverflow(page);
      await expect(page.locator('h1')).toBeVisible();
    }
  }
});

test('le texte et la correction existent sans JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto(slide('07-attention'));
  await expect(page.locator('h1')).toContainText('Chaque token');
  await expect(page.locator('.explanation')).toContainText('masque causal');
  await page.getByText('Lire la correction', { exact: true }).click();
  await expect(page.locator('.challenge details p')).toBeVisible();
  await context.close();
});

test('un échec des poids est explicite et une nouvelle tentative fonctionne', async ({ page }) => {
  await page.route('**/anatomie-llm/assets/model.json', route => route.abort('failed'));
  await page.goto(slide('15-laboratoire'));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.generated-text')).toHaveCount(0);
  await page.unroute('**/anatomie-llm/assets/model.json');
  await page.getByRole('button', { name: 'Réessayer le chargement' }).click();
  await expect(page.locator('#experiment-root')).toHaveAttribute('data-ready', 'true');
});

test('liens internes intégrés au viewer et progression sans navigation clandestine de l’iframe', async ({ page }) => {
  await page.goto('/#/parcours/anatomie-llm/01-un-token');
  const frame = page.frameLocator('.pv-slide-frame');
  await expect(frame.locator('#experiment-root')).toHaveAttribute('data-ready', 'true');
  await frame.locator('.page-navigation a').last().click();
  await expect(page).toHaveURL(/#\/parcours\/anatomie-llm\/01b-luciole$/);
  await expect(frame.locator('h1')).toContainText('Luciole');
});

test('les manipulations conceptuelles modifient les résultats annoncés', async ({ page }) => {
  await page.goto(slide('02-tokenisation'));
  await page.getByLabel('Texte à découper').fill('é');
  await expect(page.locator('.metric strong')).toHaveText(['1', '2', '1']);
  await page.getByRole('button', { name: 'Réinitialiser l’expérience' }).click();
  await expect(page.getByLabel('Texte à découper')).toHaveValue('la capitale de la france');

  await page.goto(slide('03-prompt'));
  await page.getByRole('button', { name: 'Activer les rayons X' }).click();
  await page.getByRole('button', { name: 'Ajouter un résultat d’outil' }).click();
  await expect(page.locator('.serialized')).toContainText('<début:tool>');
  await expect(page.locator('.serialized')).toContainText('<début:system>');

  await page.goto(slide('04-embeddings'));
  await page.getByLabel('Comparer avec').selectOption('paris');
  await expect(page.locator('.metric strong')).toHaveText('1.000');

  await page.goto(slide('05-transformer'));
  await page.getByRole('button', { name: '04 · MLP' }).click();
  await expect(page.locator('#experiment-root .instrument')).toContainText('ReLU');

  await page.goto(slide('08-experts'));
  await page.getByLabel('Experts actifs par token').fill('3');
  await expect(page.locator('.expert.active')).toHaveCount(3);
  await page.getByLabel('Experts actifs par token').fill('1');
  await expect(page.locator('.expert.active')).toHaveCount(1);

  await page.goto(slide('09-logit-lens'));
  await expect(page.getByLabel('Contexte', { exact: true })).toHaveValue('le chat');
  await page.getByLabel('Profondeur').fill('2');
  await expect(page.locator('.bar-label').first()).toHaveText('près');
  await expect(page.locator('#experiment-root')).toContainText('le reste se répartit sur les autres tokens');
  await page.getByLabel('Contexte', { exact: true }).selectOption('la capitale de la france est');
  await expect(page.locator('.bar-label').first()).toHaveText('paris');

  await page.goto(slide('11-effort'));
  await page.getByLabel('Budget de candidats').fill('14');
  await expect(page.locator('#experiment-root .status')).toContainText('Solution vérifiée : x = 13');

  await page.goto(slide('14-apprentissage'));
  await page.getByRole('button', { name: 'Préférences / récompenses' }).click();
  await expect(page.locator('.selected-instrument .status').filter({ hasText: 'non réalisé pour Luciole' })).toBeVisible();

  await page.goto(slide('16-synthese'));
  await page.locator('.synthesis-card').first().getByRole('button', { name: 'Établi ici' }).click();
  await expect(page.locator('.synthesis-card').first().getByRole('status')).toContainText('Exact.');
});

for (const id of ['01-un-token', '15-laboratoire']) {
  test(`${id} : les vecteurs et les blocs expliquent le token et le calcul inspectés`, async ({ page }) => {
    await page.goto(slide(id));
    await page.getByLabel('Température', { exact: true }).fill('0');
    await page.getByRole('button', { name: '+ Un token', exact: true }).click();
    await page.getByRole('button', { name: '+ Un token', exact: true }).click();
    const state = await page.locator('.selected-instrument .status').textContent();
    const candidates = await page.locator('.instrument').nth(1).textContent();
    const view = page.locator('.instrument').first();
    await page.getByRole('button', { name: /^Vecteurs/ }).click();
    await expect(view.getByRole('heading')).toHaveText('Vecteur initial du token « . »');
    await expect(view).toContainText('9 tokens × 32 nombres');
    await expect(view).toContainText('avant prise en compte des autres tokens');
    await expect(page.locator('.inspection-help')).toContainText('ne génèrent pas de token');
    await expect(view.locator('.vector-bar')).toHaveCount(32);
    await expect(view.locator('figcaption')).toContainText('pas une probabilité');
    await view.getByText('Lire les 32 valeurs', { exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(view.locator('.vector-values dd')).toHaveCount(32);
    await expect(view.locator('.vector-values dd').first()).toBeVisible();
    const initial = await view.locator('.vector-values dd').allTextContents();
    for (const block of [1, 2]) {
      await page.getByRole('button', { name: new RegExp(`^Bloc ${block}`) }).click();
      await expect(view.getByRole('heading')).toHaveText(`Token « . » après le bloc ${block}`);
      await expect(view.locator('.block-operations li')).toHaveCount(2);
      await expect(view).toContainText('connexions résiduelles');
      await expect(view).toContainText('Contexte utilisé : « la capitale de la france est paris. »');
      expect(await view.locator('.vector-values dd').allTextContents()).not.toEqual(initial);
    }
    await expect(page.locator('.selected-instrument .status')).toHaveText(state);
    await expect(page.locator('.instrument').nth(1)).toHaveText(candidates);
    await page.getByRole('button', { name: '+ Un token', exact: true }).click();
    await expect(view.getByRole('heading')).toHaveText('Token « . » après le bloc 2');
    await expect(view).toContainText('pas le marqueur <eos> lui-même');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of [/^Vecteurs/, /^Bloc 1/, /^Bloc 2/]) {
      await page.getByRole('button', { name }).click();
      await expectNoOverflow(page);
      const signs = await view.locator('.vector-bar').evaluateAll(bars => bars.map(bar => {
        const middle = bar.parentElement.getBoundingClientRect().top + bar.parentElement.clientHeight / 2;
        const rect = bar.getBoundingClientRect();
        return bar.classList.contains('negative') ? rect.top >= middle - 1 : rect.bottom <= middle + 1;
      }));
      expect(signs.every(Boolean)).toBe(true);
    }
  });

  test(`${id} : EOS termine la séquence mais permet de relancer et de revenir`, async ({ page }) => {
    await page.goto(slide(id));
    await page.getByLabel('Température', { exact: true }).fill('0');
    for (let token = 0; token < 3; token++) {
      await page.getByRole('button', { name: '+ Un token', exact: true }).click();
    }
    await expect(page.locator('.token').filter({ hasText: '<eos>' })).toHaveCount(1);
    await expect(page.locator('.selected-instrument .status')).toContainText('le modèle a terminé');
    await expect(page.locator('.generated-text')).toHaveAttribute('data-stopped', 'true');
    await expect(page.getByRole('button', { name: 'Nouvelle génération', exact: true })).toBeEnabled();
    await expect(page.locator('.instrument-title')).toContainText(['Tokens', 'Décision de fin']);
    await page.getByRole('button', { name: '← Revenir', exact: true }).click();
    await expect(page.locator('.token').filter({ hasText: '<eos>' })).toHaveCount(0);
    await page.getByRole('button', { name: '+ Un token', exact: true }).click();
    await page.getByRole('button', { name: 'Nouvelle génération', exact: true }).click();
    await expect(page.locator('.generated-text')).toHaveText('la capitale de la france est paris');
    await expect(page.locator('.selected-instrument .status')).toContainText('Ajouts : 1');
    await expect(page.locator('.generated-text')).toHaveAttribute('data-stopped', 'false');
    await expect(page.getByRole('button', { name: '+ Un token', exact: true })).toBeEnabled();
  });
}

test('la limite de contexte propose une relance sans dépasser 32 tokens', async ({ page }) => {
  await page.goto(slide('15-laboratoire'));
  await page.getByLabel('Votre prompt').fill(Array(30).fill('la').join(' '));
  await page.getByRole('button', { name: 'Appliquer le prompt' }).click();
  await page.getByRole('button', { name: '+ Un token', exact: true }).click();
  await expect(page.locator('.token')).toHaveCount(32);
  await expect(page.getByRole('button', { name: 'Nouvelle génération', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Nouvelle génération', exact: true }).click();
  await expect(page.locator('.token')).toHaveCount(32);
  await page.getByLabel('Votre prompt').fill(Array(31).fill('la').join(' '));
  await page.getByRole('button', { name: 'Appliquer le prompt' }).click();
  await expect(page.getByRole('button', { name: 'Nouvelle génération', exact: true })).toBeDisabled();
  await expect(page.locator('.selected-instrument .status')).toContainText('prompt plus court');
});

test('le viewer reste compact, sans navigation en double et avec les couleurs natives', async ({ page }) => {
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/#/parcours/anatomie-llm/01-un-token');
    const frame = page.frameLocator('.pv-slide-frame');
    await expect(frame.locator('#experiment-root')).toHaveAttribute('data-ready', 'true');
    for (const selector of ['.masthead', '.chapter-rail', '.hero > .eyebrow']) {
      await expect(frame.locator(selector)).toBeHidden();
    }
    await expect(frame.locator('.hero-seal')).toBeVisible();
    expect(await frame.locator('h1').evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeLessThanOrEqual(42);
    expect((await frame.locator('.hero').boundingBox()).height).toBeLessThan(240);
    const colors = await frame.locator('body').evaluate(body => {
      const probe = document.createElement('span');
      body.append(probe);
      const resolve = name => {
        probe.style.color = `var(${name})`;
        return getComputedStyle(probe).color;
      };
      const actual = [getComputedStyle(body).backgroundColor, getComputedStyle(document.querySelector('h1')).color, getComputedStyle(document.querySelector('.hero-seal')).color];
      const expected = ['--color-bg', '--color-text', '--color-accent'].map(resolve);
      probe.remove();
      return { actual, expected };
    });

    expect(colors.actual).toEqual(colors.expected);
    await expect(frame.locator('#comprendre')).toBeInViewport();
    await frame.getByRole('link', { name: '2 · Expérimenter', exact: true }).click();
    await expect(frame.locator('#experience-title')).toBeInViewport();
    await frame.getByRole('link', { name: 'Relire l’explication ↑' }).click();
    await expect(frame.locator('#comprendre')).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Fermer le menu', exact: true }).click();
  await expect(page.frameLocator('.pv-slide-frame').locator('.hero-seal')).toBeVisible();
  await expect.poll(() => page.frameLocator('.pv-slide-frame').locator('html').evaluate(e =>
    e.scrollWidth <= e.clientWidth)).toBe(true);
  await page.goto(slide('01-un-token'));
  await expect(page.locator('.masthead')).toBeVisible();
  await expect(page.locator('.chapter-rail')).toBeVisible();
});

test('quatre vrais tokeniseurs comparent les mêmes textes sans réseau externe', async ({ page, baseURL }) => {
  const external = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== new URL(baseURL).origin) { external.push(request.url()); }
  });
  await page.goto(slide('02b-cas-reels'));
  await page.getByLabel('Texte à découper').fill('Hello world');
  await page.getByLabel('Tokenizer à observer ou comparer', { exact: true }).selectOption('compare');
  for (const id of ['gpt2', 'bert', 't5']) {
    await expect(page.locator(`[data-tokenizer="${id}"] .token-count`)).toHaveText('2 tokens');
  }
  await expect(page.locator('[data-tokenizer="gpt2"] .token small')).toHaveText(['id 15496', 'id 995']);
  await expect(page.locator('[data-tokenizer="bert"] .token small')).toHaveText(['id 7592', 'id 2088']);
  await expect(page.locator('[data-tokenizer="t5"] .token small')).toHaveText(['id 8774', 'id 296']);
  await page.getByRole('button', { name: 'Accents et emojis', exact: true }).click();
  await expect(page.locator('[data-tokenizer="bert"]')).toContainText('[UNK]');
  await expect(page.locator('[data-tokenizer="t5"]')).toContainText('<unk>');
  await expect(page.locator('[data-tokenizer="gpt2"]')).toContainText('Reconstruction identique');
  await page.getByLabel('Texte à découper').fill('');
  for (const id of ['gpt2', 'bert', 't5']) {
    await expect(page.locator(`[data-tokenizer="${id}"] .token-count`)).toHaveText('0 tokens');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Code JavaScript', exact: true }).click();
  await expectNoOverflow(page);
  expect(external).toEqual([]);
});

test('un tokenizer indisponible affiche une erreur locale et peut être rechargé', async ({ page }) => {
  await page.route('**/tokenizers/bert/tokenizer.json', route => route.abort('failed'));
  await page.goto(slide('02-tokenisation'));
  await page.getByLabel('Tokenizer à observer ou comparer', { exact: true }).selectOption('compare');
  await expect(page.locator('[data-tokenizer="bert"]').getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-tokenizer="gpt2"] [data-ready="true"]')).toHaveCount(1);
  await page.unroute('**/tokenizers/bert/tokenizer.json');
  await page.getByRole('button', { name: 'Réessayer bert', exact: true }).click();
  await expect(page.locator('[data-tokenizer="bert"] [data-ready="true"]')).toHaveCount(1);
});

test('la vue 3D change les axes et l’orientation sans changer la similarité', async ({ page }) => {
  await page.goto(slide('04-embeddings'));
  const similarity = page.locator('.metric strong').first();
  await expect(similarity).toBeVisible();
  const value = await similarity.textContent();
  const point = page.locator('.embedding-plot [data-token="paris"]');
  const before = await point.getAttribute('cx');
  await page.getByLabel('Axe X', { exact: true }).selectOption('5');
  await expect(point).not.toHaveAttribute('cx', before);
  const rotated = await point.getAttribute('cx');
  await page.getByLabel('Rotation horizontale (°)', { exact: true }).fill('90');
  await expect(point).not.toHaveAttribute('cx', rotated);
  await page.getByLabel('Zoom', { exact: true }).fill('1.5');
  await expect(similarity).toHaveText(value);
  await expect(page.locator('.atlas-coordinates')).toContainText('paris');
  await expect(page.getByLabel('Axe Y', { exact: true }).locator('option[value="5"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Réinitialiser la vue 3D' }).click();
  await expect(page.getByLabel('Axe X', { exact: true })).toHaveValue('0');
  await page.locator('.embedding-plot').scrollIntoViewIfNeeded();
  const box = await page.locator('.embedding-plot').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByLabel('Rotation horizontale (°)', { exact: true })).not.toHaveValue('35');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOverflow(page);
});

test('les repères et nouvelles étapes expliquent les termes avant leur utilisation', async ({ page }) => {
  await page.goto(slide('05-transformer'));
  await page.locator('.vocabulary-hints [data-term="tête"]').focus();
  await expect(page.locator('#glossary-tooltip')).toHaveCSS('opacity', '1');
  await expect(page.locator('#glossary-tooltip')).toContainText('en parallèle');
  await page.getByRole('button', { name: '03 · Attention' }).click();
  await expect(page.locator('#experiment-root .instrument')).toContainText('pas un token ni un neurone unique');
  await page.getByText('Comprendre le détail du calcul', { exact: true }).click();
  await expect(page.locator('.architecture-detail')).toContainText('Chaque tête produit 8 nombres');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('Le vocabulaire de cette étape', { exact: true }).click();
  await expect(page.locator('.plain-definitions dd').first()).toBeVisible();
  await expectNoOverflow(page);
  await page.goto(slide('03b-nombres'));
  await page.getByLabel('Coordonnée 0', { exact: true }).fill('0.9');
  await expect(page.locator('.number-matrix .selected td').first()).toHaveText('0.9');
  await page.goto(slide('06b-tetes'));
  await page.getByLabel('Tête observée', { exact: true }).selectOption('1');
  await expect(page.getByLabel('Tête observée', { exact: true })).toHaveValue('1');
  await page.getByLabel('Étape du calcul', { exact: true }).selectOption('5');
  await expect(page.locator('#experiment-root')).toContainText('V');
  await page.getByRole('button', { name: 'Recommencer les étapes', exact: true }).click();
  await expect(page.getByLabel('Étape du calcul', { exact: true })).toHaveValue('0');
  await page.goto(slide('09b-scores'));
  for (const candidate of ['A', 'B', 'C']) {
    await page.getByLabel(`Score du candidat ${candidate}`).fill('0');
  }
  await expect(page.locator('.bar-value')).toHaveText(['33.3 %', '33.3 %', '33.3 %']);
  await page.goto(slide('01b-luciole'));
  await expect(page.locator('#experiment-root')).toContainText('12 000');
  await page.getByText('Lire les 40 phrases Tatoeba et leurs sources', { exact: true }).click();
  await expect(page.locator('#experiment-root ol a')).toHaveCount(40);
});

test('Luciole relit son apprentissage et expose aussi les échecs, sans réentraîner', async ({ page }) => {
  await page.goto(slide('01b-luciole'));
  const replay = page.locator('.training-replay');
  await expect(replay).toBeVisible();
  await expect(replay.locator('svg path.axis')).toHaveCSS('fill', 'none');
  await page.getByLabel('Instant du préentraînement', { exact: true }).fill('0');
  await expect(replay.locator('.metric-row strong').first()).toHaveText('0');
  const predictions = replay.locator('.instrument-grid .metric strong');
  expect(await predictions.nth(0).textContent()).toBe(await predictions.nth(1).textContent());
  await page.getByLabel('Instant du préentraînement', { exact: true }).fill('12');
  await expect(replay.locator('.metric-row strong').first()).toHaveText('12 000');
  await page.getByLabel('Résultats du test à explorer').selectOption('wrong');
  await expect(page.locator('.evaluation-case .status')).toContainText('Échec');
  await page.getByLabel('Résultats du test à explorer').selectOption('right');
  await expect(page.locator('.evaluation-case .status')).toContainText('Réussi');
  await page.goto(slide('15-laboratoire'));
  await page.getByLabel('Température', { exact: true }).fill('0');
  await page.getByRole('button', { name: '+ Un token', exact: true }).click();
  await expect(page.locator('.generated-text')).toContainText('paris');
  await page.getByLabel('Tête inspectée').selectOption('3');
  await expect(page.locator('.attention-matrix')).toBeVisible();
});

test('tokenizer Luciole : vrais identifiants, trois langues et erreurs explicites', async ({ page }) => {
  await page.goto(slide('01b-luciole'));
  const tokenizer = page.locator('.luciole-tokenizer');
  for (const name of ['Français CC0', 'Anglais CC0', 'Espagnol CC0']) {
    await tokenizer.getByRole('button', { name, exact: true }).click();
    await expect(tokenizer.getByRole('status')).toContainText('identifiants acceptés');
  }
  await tokenizer.getByRole('button', { name: 'Tester un mot inconnu' }).click();
  await expect(tokenizer.getByRole('status')).toContainText('Inférence refusée');
  await page.getByLabel('Texte pour le tokenizer de Luciole').fill('LA capitale');
  await expect(tokenizer.locator('.token').first()).toContainText('<bos>');
  await expect(tokenizer.getByRole('status')).toContainText('3 tokens');
});

test('un historique indisponible est signalé puis rechargeable', async ({ page }) => {
  await page.route('**/anatomie-llm/assets/evaluation.json', route => route.abort('failed'));
  await page.goto(slide('01b-luciole'));
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/anatomie-llm/assets/evaluation.json');
  await page.getByRole('button', { name: 'Réessayer le chargement' }).click();
  await expect(page.locator('.training-replay')).toBeVisible();
});

test('les étapes guidées relient QKV et le cache aux vrais calculs de Luciole', async ({ page }) => {
  await page.goto(slide('06b-tetes'));
  await page.getByLabel('Étape du calcul', { exact: true }).selectOption('4');
  await page.getByLabel('Coordonnée 0 de « chat »', { exact: true }).fill('0.5');
  await page.getByLabel('Calcul observé', { exact: true }).selectOption('luciole');
  await expect(page.getByLabel('Tête observée', { exact: true }).locator('option')).toHaveCount(4);
  await page.getByLabel('Tête observée', { exact: true }).selectOption('3');
  await page.getByLabel('Étape du calcul', { exact: true }).selectOption('6');
  await expectNoOverflow(page);
  await page.goto(slide('12-memoire'));
  await page.getByRole('button', { name: 'Passer à t', exact: true }).click();
  await page.getByRole('button', { name: 'Passer à t + 1', exact: true }).click();
  await page.getByRole('button', { name: 'Vérifier K/V dans Luciole (sans cache)', exact: true }).click();
  await expect(page.getByText('Vraies projections K/V, recalculées sans cache', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Revenir au prefill', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOverflow(page);
});

test('le final ouvre uniquement un nouvel onglet et ne télécharge rien avant consentement', async ({ page, baseURL, context }) => {
  const requests = [];
  context.on('request', request => requests.push(request.url()));
  await page.goto('/#/parcours/anatomie-llm/16b-transformer-explainer');
  const frame = page.frameLocator('.pv-slide-frame');
  await expect(frame.locator('#experiment-root')).toHaveAttribute('data-ready', 'true');
  await expect(frame.locator('#experiment-root iframe')).toHaveCount(0);
  const popup = page.waitForEvent('popup');
  await frame.getByRole('link', { name: /Ouvrir le laboratoire GPT-2/ }).click();
  const laboratory = await popup;
  await expect(laboratory.getByRole('button', { name: 'Charger GPT-2 · 657 Mo', exact: true })).toBeVisible();
  expect(await laboratory.evaluate(() => window.opener)).toBeNull();
  await expect(page).toHaveURL(/#\/parcours\/anatomie-llm\/16b-transformer-explainer$/);
  await expect(frame.locator('#experiment-root iframe, #experiment-root button')).toHaveCount(0);
  expect(requests.filter(url => new URL(url).origin !== new URL(baseURL).origin)).toEqual([]);
  expect(requests.filter(url => /\/model-v2\/|\.wasm(?:$|\?)|\/tokenizer\.json(?:$|\?)/.test(url))).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOverflow(page);
  await page.goto(slide('07-attention'));
  await expect(laboratory.getByRole('button', { name: 'Charger GPT-2 · 657 Mo', exact: true })).toBeVisible();
  await laboratory.close();
});
