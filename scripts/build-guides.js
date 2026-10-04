#!/usr/bin/env node
/**
 * Lecteur statique des guides. Les sources Markdown du dépôt restent canoniques.
 * Seul docs/site est généré ; aucune dépendance navigateur ni requête distante.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Marked } from 'marked';
import { isPublicSitePath } from './build-site.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} value Texte à protéger dans une métadonnée ou un attribut HTML. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

/** @param {string} text Texte d'un titre, avec les mêmes ancres que les liens Markdown. */
export function headingSlug(text) {
  return text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim().replace(/\s/g, '-') || 'section';
}

/** @param {string} directory Dossier documentaire, sans ses sorties générées. */
function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'site' || entry.name === 'assets' || entry.isSymbolicLink()) { return []; }
    const path = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : (/\.md$/i.test(entry.name) ? [path] : []);
  }).sort();
}

/** @param {string} from Dossier de sortie. @param {string} to Fichier cible. */
function hrefBetween(from, to) {
  return relative(from, to).split(sep).map(segment => encodeURIComponent(segment)).join('/') || './';
}

function specialGuideLink(value) {
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    return { href: /^(https?:|mailto:|tel:)/i.test(value) ? value : '#', source: false };
  }
  if (value.startsWith('//')) { return { href: '#', source: false }; }
  if (!value || value.startsWith('#') || value.startsWith('?')) { return { href: value, source: false }; }
  return null;
}

/**
 * Préserve fragments et requêtes ; une cible Markdown non rendue reste explicitement source.
 * @param {string} href URL Markdown.
 * @param {string} source Fichier Markdown courant.
 * @param {string} output Fichier HTML courant.
 * @param {Map<string, string>} pages Correspondance sources/sorties.
 */
export function resolveGuideLink(href, source, output, pages) {
  const value = href.trim();
  const special = specialGuideLink(value);
  if (special) { return special; }
  const [, pathname, suffix = ''] = value.match(/^([^?#]*)(.*)$/);
  const decoded = decodeURIComponent(pathname);
  const target = resolve(dirname(source), decoded);
  const docsIndex = source.lastIndexOf(`${sep}docs${sep}`);
  if (docsIndex > 0) {
    const repoPath = relative(source.slice(0, docsIndex), target).split(sep).join('/');
    if (repoPath && !repoPath.startsWith('../') && !isPublicSitePath(repoPath)) {
      return {
        href: `https://github.com/z4ppy/playlab42/blob/main/${repoPath.split('/').map(encodeURIComponent).join('/')}${suffix}`,
        source: true,
      };
    }
  }
  return {
    href: hrefBetween(dirname(output), pages.get(target) || target) + suffix,
    source: /\.(?:md|[cm]?js|ts|json|ya?ml|css)$/i.test(decoded) && !pages.has(target),
  };
}

/** @param {Array} tokens Tokens inline de marked. */
function plainText(tokens = []) {
  return tokens.map(token => token.tokens ? plainText(token.tokens) : (token.text || '')).join('');
}

/**
 * Convertit une source de confiance du dépôt, sans exposer un rendu d'entrées utilisateur.
 * @param {string} markdown Source canonique.
 * @param {{source: string, output: string, pages: Map}} context Résolution des liens.
 */
export function renderGuide(markdown, context) {
  const headings = [];
  const identifiers = new Set();
  let title = '';
  const parser = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = plainText(tokens);
        const slug = headingSlug(text);
        let id = slug;
        let count = 0;
        while (identifiers.has(id)) { id = `${slug}-${++count}`; }
        identifiers.add(id);
        if (depth === 1 && !title) { title = text; }
        if (depth > 1 && depth < 4) { headings.push({ id, text, depth }); }
        return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}<a class="heading-anchor" href="#${escapeHtml(id)}" aria-label="Lien vers ${escapeHtml(text)}">#</a></h${depth}>\n`;
      },
      link({ href, title: linkTitle, tokens }) {
        const target = resolveGuideLink(href, context.source, context.output, context.pages);
        const sourceLabel = /\.md(?:[?#]|$)/i.test(target.href) ? 'source Markdown' : 'fichier source';
        return `<a href="${escapeHtml(target.href)}"${linkTitle ? ` title="${escapeHtml(linkTitle)}"` : ''}${target.source ? ' class="source-link"' : ''}>${this.parser.parseInline(tokens)}${target.source ? ` <span class="source-label">(${sourceLabel})</span>` : ''}</a>`;
      },
      image({ href, title: imageTitle, text }) {
        const target = resolveGuideLink(href, context.source, context.output, new Map());
        return `<img src="${escapeHtml(target.href)}" alt="${escapeHtml(text)}"${imageTitle ? ` title="${escapeHtml(imageTitle)}"` : ''} loading="lazy">`;
      },
      table(token) {
        const header = token.header.map(cell => `<th${cell.align ? ` style="text-align:${cell.align}"` : ''}>${this.parser.parseInline(cell.tokens)}</th>`).join('');
        const rows = token.rows.map(row => `<tr>${row.map(cell => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`).join('');
        return `<div class="table-scroll" role="region" aria-label="Tableau défilant" tabindex="0"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
      },
    },
  });
  const html = parser.parse(markdown);
  return { html, title: title || 'Documentation Playlab42', headings };
}

/** @param {string} output Page générée. @param {string} root Racine du dépôt. */
function pageShell(output, root, { title, content, toc = '', source = null }) {
  const link = path => hrefBetween(dirname(output), join(root, path));
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(`${title} — Guides de développement Playlab42. Documentation statique du laboratoire.`)}">
  <title>${escapeHtml(title)} · Playlab42</title>
  <link rel="stylesheet" href="${link('lib/theme.css')}">
  <link rel="stylesheet" href="${link('lib/ui.css')}">
  <link rel="stylesheet" href="${link('docs/assets/guides.css')}">
  <script type="module" src="${link('docs/assets/guides.js')}"></script>
</head>
<body>
  <a class="skip-link" href="#lecture">Aller au contenu</a>
  <header class="guide-header">
    <a class="guide-brand" href="${link('index.html')}">Playlab42 <span>le laboratoire</span></a>
    <nav aria-label="Navigation principale"><a href="${link('docs/site/index.html')}">Les guides</a><a href="${link('index.html')}">Retour au portail</a><button type="button" id="guide-theme" hidden aria-label="Changer le thème">Thème</button></nav>
  </header>
  <div class="reader-layout${toc ? '' : ' reader-home'}">
    ${toc}
    <main id="lecture" tabindex="-1">${content}</main>
  </div>
  <footer class="guide-footer"><a href="${link('docs/site/index.html')}">Tous les guides</a>${source ? `<a href="${hrefBetween(dirname(output), source)}">Lire la source Markdown</a>` : ''}<span>Un laboratoire pour apprendre et contribuer.</span></footer>
</body>
</html>
`;
}

const GROUPS = [
  {
    title: 'Prendre ses repères', description: 'Comprendre le laboratoire avant de toucher au code.',
    guides: [
      ['guides/architecture.md', 'Lire l’architecture', 'Portail, outils, jeux et bibliothèques : une carte du projet.'],
      ['GETTING_STARTED.md', 'Installer son environnement', 'Démarrer en local avec Docker, pas à pas.'],
      ['guides/contributing.md', 'Contribuer au projet', 'Du premier changement à une contribution vérifiée.'],
    ],
  },
  {
    title: 'Créer une première contribution', description: 'Choisir un format, puis avancer à son rythme.',
    guides: [
      ['guides/contribution-kit.md', 'Le kit de contribution', 'Des gabarits et une galerie UI pour partir sur de bonnes bases.'],
      ['guides/create-tool.md', 'Créer un outil', 'Un outil HTML autonome : le chemin le plus court.'],
      ['guides/create-epic.md', 'Composer un parcours', 'Transformer une idée pédagogique en slides et en étapes.'],
      ['guides/create-game-engine.md', 'Écrire un moteur de jeu', 'Des règles déterministes, indépendantes de l’interface.'],
      ['guides/create-game-client.md', 'Construire le client de jeu', 'Relier les règles à une interface utilisable.'],
      ['guides/create-bot.md', 'Ajouter un bot', 'Concevoir et tester un adversaire programmable.'],
    ],
  },
  {
    title: 'Vérifier et travailler avec l’IA', description: 'Garder les conventions, les besoins et les preuves ensemble.',
    guides: [
      ['TESTING_STRATEGY.md', 'Tester sa contribution', 'Tests unitaires, navigateur et commandes de validation.'],
      ['guides/project-skills.md', 'Utiliser les skills du projet', 'Les bons points d’entrée pour les assistants de développement.'],
      ['guides/openspec-workflow.md', 'Suivre le workflow OpenSpec', 'Clarifier un changement, l’implémenter, puis le vérifier.'],
      ['guides/software-factory.md', 'Comprendre l’usine logicielle', 'De la demande à une publication vérifiée, avec les limites et la feuille de route.'],
      ['guides/software-quality.md', 'Construire du logiciel de qualité', 'Conception, contrôles bloquants, sécurité, tests et revue.'],
      ['guides/local-data.md', 'Comprendre les données locales', 'Persistance navigateur, portabilité et sécurité.'],
      ['guides/runtime-libraries.md', 'Utiliser les bibliothèques runtime', 'Dépendances locales et distributions reproductibles.'],
    ],
  },
];

/**
 * Génère exclusivement docs/site, à partir de tous les Markdown sous docs.
 * @param {{root?: string}} options Racine configurable pour les fixtures de tests.
 * @returns {{pages: number, output: string}} Nombre de pages, accueil compris.
 */
export function buildGuides({ root = ROOT } = {}) {
  const docs = join(root, 'docs');
  const site = join(docs, 'site');
  const sources = markdownFiles(docs);
  const pages = new Map(sources.map(source => [source, join(site, relative(docs, source).replace(/\.md$/i, '.html'))]));
  const rendered = new Map(sources.map(source => [source, renderGuide(readFileSync(source, 'utf8'), {
    source, output: pages.get(source), pages,
  })]));
  rmSync(site, { recursive: true, force: true });
  mkdirSync(site, { recursive: true });
  for (const [source, output] of pages) {
    const { html, title, headings } = rendered.get(source);
    const toc = headings.length ? `<aside class="reader-sidebar"><details class="reader-plan"><summary>Plan du guide</summary><nav aria-label="Plan du guide"><ol>${headings.map(heading => `<li class="toc-depth-${heading.depth}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`).join('')}</ol></nav></details></aside>` : '';
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, pageShell(output, root, {
      title, source, toc,
      content: `<div class="reader-breadcrumb"><a href="${hrefBetween(dirname(output), join(site, 'index.html'))}">Guides</a><span aria-hidden="true"> / </span><span>${escapeHtml(title)}</span></div><article class="guide-prose">${html}</article>`,
    }));
  }
  const home = join(site, 'index.html');
  const featured = new Set(GROUPS.flatMap(group => group.guides.map(([path]) => join(docs, path))));
  const groups = GROUPS.map(group => {
    const cards = group.guides.filter(([path]) => pages.has(join(docs, path))).map(([path, title, description]) =>
      `<li><a class="guide-card" href="${hrefBetween(site, pages.get(join(docs, path)))}"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><span>Ouvrir le guide <span aria-hidden="true">→</span></span></a></li>`).join('');
    return cards ? `<section class="guide-group"><h2>${escapeHtml(group.title)}</h2><p>${escapeHtml(group.description)}</p><ul class="guide-grid">${cards}</ul></section>` : '';
  }).join('');
  const other = sources.filter(source => !featured.has(source));
  writeFileSync(home, pageShell(home, root, {
    title: 'Les guides du laboratoire',
    content: `<section class="guide-intro"><p class="guide-eyebrow">COMPRENDRE · CRÉER · CONTRIBUER</p><h1>Les guides du laboratoire</h1><p>Une idée, un premier outil, un jeu à construire. Retrouvez les repères et les méthodes pour apprendre en faisant, puis contribuer à Playlab42.</p><a class="guide-start" href="${pages.has(join(docs, 'guides/contribution-kit.md')) ? 'guides/contribution-kit.html' : hrefBetween(site, pages.values().next().value || home)}">Commencer avec le kit de contribution <span aria-hidden="true">→</span></a><p class="guide-learning">Vous préférez apprendre par la pratique ? <a href="${hrefBetween(site, join(root, 'index.html'))}#/parcours">Explorer les parcours pédagogiques</a>.</p></section>${groups}<details class="guide-reference"><summary>Toute la documentation · ${sources.length} documents</summary><ul>${other.map(source => `<li><a href="${hrefBetween(site, pages.get(source))}">${escapeHtml(rendered.get(source).title)}</a></li>`).join('')}</ul><p>Les guides ci-dessus sont organisés par intention ; ces références complètent la lecture.</p></details>`,
  }));
  return { pages: pages.size + 1, output: site };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!existsSync(join(ROOT, 'docs'))) { throw new Error('Dossier docs introuvable'); }
  const result = buildGuides();
  console.log(`Guides : ${result.pages} pages générées dans docs/site/`);
}
