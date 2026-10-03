/** @jest-environment jsdom */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildGuides, escapeHtml, headingSlug, renderGuide, resolveGuideLink } from './build-guides.js';

describe('Lecteur statique des guides', () => {
  test('échapper les métadonnées et les URL, sans autoriser des schémas exécutables', () => {
    expect(escapeHtml('A < B & "C"')).toBe('A &lt; B &amp; &quot;C&quot;');
    const context = { source: '/repo/docs/a.md', output: '/repo/docs/site/a.html', pages: new Map() };
    // eslint-disable-next-line no-script-url -- Vérifie le rejet de cette entrée malveillante.
    for (const href of ['javascript:alert(1)', 'data:text/html,test', '//example.test/']) {
      expect(resolveGuideLink(href, context.source, context.output, context.pages).href).toBe('#');
    }
    expect(() => resolveGuideLink('bad%zz.md', context.source, context.output, context.pages)).toThrow(URIError);
    const result = renderGuide('# Un <titre>\n\n[Test](https://example.test/?a=1&b=2 "Citation")', context);
    document.body.innerHTML = result.html;
    expect(document.querySelector('a[href^="https"]').getAttribute('href')).toBe('https://example.test/?a=1&b=2');
  });

  test('produire des ancres uniques, y compris face aux suffixes déjà présents', () => {
    expect(headingSlug('Créer un `moteur` !')).toBe('créer-un-moteur');
    const result = renderGuide('# Test\n\n## Même section\n\n## Même section-1\n\n## Même section\n\n## **Code** et `API`\n\n[Aller](#même-section)', {
      source: '/repo/docs/a.md', output: '/repo/docs/site/a.html', pages: new Map(),
    });
    document.body.innerHTML = result.html;
    expect(result.headings.map(heading => heading.id)).toEqual(['même-section', 'même-section-1', 'même-section-2', 'code-et-api']);
    for (const anchor of document.querySelectorAll('.heading-anchor')) {
      expect(document.getElementById(decodeURIComponent(anchor.hash.slice(1)))).not.toBeNull();
    }
    expect(document.querySelector('h2').textContent).toBe('Même section#');
  });

  test('réécrire seulement les Markdown connus, préserver images, requêtes et exemples', () => {
    const source = '/repo/docs/guides/a.md';
    const output = '/repo/docs/site/guides/a.html';
    const pages = new Map([['/repo/docs/À lire.md', '/repo/docs/site/À lire.html']]);
    const markdown = '# Test\n\n[Document](../%C3%80%20lire.md?mode=1#objectif)\n\n[Contrat](../../openspec/spec.md#contrat)\n\n![Schéma](../images/schema.png)\n\n```js\nconst url = "../other.md";\n```\n\n| API | Usage |\n| --- | --- |\n| a | b |';
    document.body.innerHTML = renderGuide(markdown, { source, output, pages }).html;
    expect(document.querySelector('a[href*="lire"]').getAttribute('href')).toBe('../%C3%80%20lire.html?mode=1#objectif');
    expect(document.querySelector('.source-link').getAttribute('href')).toBe('../../../openspec/spec.md#contrat');
    expect(document.querySelector('.source-label').textContent).toContain('source Markdown');
    expect(document.querySelector('img').getAttribute('src')).toBe('../../images/schema.png');
    expect(document.querySelector('pre code').textContent).toBe('const url = "../other.md";\n');
    expect(document.querySelector('.table-scroll').getAttribute('tabindex')).toBe('0');
    expect(document.querySelectorAll('table th')).toHaveLength(2);
    document.body.innerHTML = renderGuide('[Script](../../scripts/build-guides.js)\n\n[Outil](../../tools/example.html)', {
      source, output, pages,
    }).html;
    expect(document.querySelector('.source-label').textContent).toBe('(fichier source)');
    expect(document.querySelector('.source-link').getAttribute('href')).toBe('https://github.com/z4ppy/playlab42/blob/main/scripts/build-guides.js');
    expect(document.querySelector('a[href$="example.html"]').classList.contains('source-link')).toBe(false);
  });

  test('lier les fichiers réservés au dépôt sans publier la configuration des agents', () => {
    const source = '/repo/docs/guides/a.md';
    const output = '/repo/docs/site/guides/a.html';
    for (const path of [
      '.github/skills/playlab-ui/SKILL.md', '.github/workflows/ci.yml',
      '.claude/commands/openspec/apply.md', 'templates/game/engine.js.tpl', 'Makefile',
    ]) {
      expect(resolveGuideLink(`../../${path}#source`, source, output, new Map())).toEqual({
        href: `https://github.com/z4ppy/playlab42/blob/main/${path}#source`, source: true,
      });
    }
  });

  test('générer un accueil éditorial et les références sans altérer les sources', () => {
    const root = resolve('scripts', `.guides-fixture-${randomUUID()}`);
    const docs = join(root, 'docs');
    mkdirSync(join(docs, 'guides'), { recursive: true });
    mkdirSync(join(docs, 'site'), { recursive: true });
    const source = '# Créer "un client" & apprendre\n\n## Objectif\n\n[Tests](../TESTING_STRATEGY.md#tester)\n\n[Portail](../../index.html)\n';
    writeFileSync(join(docs, 'guides/create-game-client.md'), source);
    writeFileSync(join(docs, 'guides/architecture.md'), '# Architecture\n\n## Vue générale\n\nLes composants.');
    writeFileSync(join(docs, 'TESTING_STRATEGY.md'), '# Tester\n\n## Tester\n\nDes preuves.');
    writeFileSync(join(docs, 'site/stale.md'), '# Ancienne sortie');
    try {
      expect(buildGuides({ root }).pages).toBe(4);
      const output = join(docs, 'site/guides/create-game-client.html');
      const first = readFileSync(output, 'utf8');
      document.documentElement.innerHTML = first.replace(/<!doctype html>/i, '');
      expect(document.title).toBe('Créer "un client" & apprendre · Playlab42');
      expect(document.querySelector('meta[name="description"]').content).toContain('Créer "un client" & apprendre');
      expect(document.querySelector('link[href*="theme.css"]').getAttribute('href')).toBe('../../../lib/theme.css');
      expect(document.querySelector('script').getAttribute('src')).toBe('../../assets/guides.js');
      expect(document.querySelector('.reader-plan').hasAttribute('open')).toBe(false);
      expect(document.querySelector('a[href*="TESTING"]').getAttribute('href')).toBe('../TESTING_STRATEGY.html#tester');
      expect(document.querySelector('.guide-brand').getAttribute('href')).toBe('../../../index.html');
      const homepage = readFileSync(join(docs, 'site/index.html'), 'utf8');
      expect(homepage).toContain('Prendre ses repères');
      expect(homepage).toContain('Créer une première contribution');
      expect(homepage).toContain('Vérifier et travailler avec l’IA');
      expect(homepage).toContain('guides/create-game-client.html');
      expect(homepage).toContain('../../index.html#/parcours');
      expect(homepage).not.toContain('stale.html');
      expect(() => readFileSync(join(docs, 'site/stale.md'))).toThrow();
      buildGuides({ root });
      expect(readFileSync(output, 'utf8')).toBe(first);
      expect(readFileSync(join(docs, 'guides/create-game-client.md'), 'utf8')).toBe(source);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('adapter le lecteur à 320 px sans faire défiler toute la page', () => {
    const css = readFileSync(new URL('../docs/assets/guides.css', import.meta.url), 'utf8');
    expect(css).toContain('@media (max-width: 540px)');
    expect(css).toContain('@media (max-width: 959px)');
    expect(css).toMatch(/\.guide-prose pre \{[^}]*overflow-x: auto/);
    expect(css).toMatch(/\.table-scroll \{[^}]*overflow-x: auto/);
    expect(css).toContain('minmax(0, 1fr)');
  });
});
