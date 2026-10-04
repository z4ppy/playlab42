import { readFileSync } from 'node:fs';

const reference = JSON.parse(readFileSync(new URL('./fixtures/styles-before-reduction.json', import.meta.url), 'utf8'));

/**
 * Rejoue les CSS du main de départ dans le même navigateur : les dimensions
 * restent comparées exactement, sans figer les métriques des polices de l'OS.
 */
export async function withOriginalStyles(page, capture) {
  const saved = await page.evaluateHandle(baseline => {
    const route = location.pathname;
    const plan = [];
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    const required = ['/lib/theme.css'];
    if (route === '/' || route === '/index.html') { required.push('/style.css', '/lib/parcours-viewer.css'); }
    if (route.startsWith('/games/diese-et-mat/')) { required.push('/games/diese-et-mat/style.css'); }
    if (route.startsWith('/games/') && Object.hasOwn(baseline.inline, route)) { required.push('/games/game-page.css'); }
    for (const path of required) {
      if (!links.some(node => new URL(node.href).pathname === path)) { throw new Error(`Lien de style absent : ${path}`); }
    }
    for (const node of links) {
      const path = new URL(node.href).pathname;
      if (Object.hasOwn(baseline.stylesheets, path) || baseline.added.includes(path)) {
        if (!node.sheet) { throw new Error(`Feuille absente : ${path}`); }
        plan.push({ node, text: baseline.stylesheets[path] ?? null });
      }
    }
    const inline = baseline.inline[route] ?? [];
    const nodes = [...document.head.querySelectorAll('style')];
    if (nodes.length < inline.length) { throw new Error(`Styles de page absents : ${route}`); }
    for (const [index, text] of inline.entries()) {
      const node = nodes[index];
      if (!node.sheet) { throw new Error(`Style de page absent : ${route}/${index}`); }
      plan.push({ node, text });
    }
    if (plan.length === 0) { throw new Error(`Aucun style de référence : ${route}`); }
    const items = plan.map(({ node, text }) => {
      const sheet = node.sheet;
      const disabled = sheet.disabled;
      let original = null;
      if (text !== null) {
        original = document.createElement('style');
        original.dataset.dedupOriginal = '';
        original.media = node.media || '';
        original.textContent = text;
        node.before(original);
      }
      return { sheet, disabled, original };
    });
    if (items.some(({ original }) => original && !original.sheet)) {
      for (const { original } of items) { original?.remove(); }
      throw new Error('CSS original bloqué par le document');
    }
    for (const { sheet } of items) { sheet.disabled = true; }
    return items;
  }, reference);
  try {
    await page.evaluate(() => {
      getComputedStyle(document.documentElement).color;
      for (const animation of document.getAnimations()) {
        if (animation.effect.getComputedTiming().iterations !== Infinity) { animation.finish(); }
      }
    });
    return await capture();
  } finally {
    await saved.evaluate(items => {
      for (const { sheet, disabled, original } of items) {
        sheet.disabled = disabled;
        original?.remove();
      }
    });
    await saved.dispose();
  }
}
