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
    for (const node of document.querySelectorAll('link[rel="stylesheet"]')) {
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
    return plan.map(({ node, text }) => {
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
      sheet.disabled = true;
      return { sheet, disabled, original };
    });
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
