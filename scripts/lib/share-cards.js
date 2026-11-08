/**
 * Cartes de partage (Open Graph, X/Twitter) des pages autonomes des jeux et outils.
 *
 * Le portail navigue par hash (`#/games/<id>`) : les robots des plateformes ignorent
 * ce qui suit « # » et lisent toujours la page d'accueil. Seules les pages autonomes
 * des jeux et outils peuvent donc porter leur propre carte. Ces balises sont générées
 * au build à partir du catalogue : nom, description et vignette restent la source unique.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { thumbnailPath } from '../../lib/catalogue-ui.js';

/** Adresse publique par défaut, identique à celle de la surveillance du site. */
export const DEFAULT_SITE_URL = 'https://z4ppy.github.io/playlab42/';

/** Image générale du site, utilisée quand une entrée n'a pas de vignette. */
export const FALLBACK_IMAGE = 'assets/social-preview.jpg';

/**
 * Normalise l'adresse publique du site ; les plateformes exigent des URL absolues.
 * @param {string|undefined} value - Adresse configurée, ou vide pour le défaut
 * @returns {string} Adresse HTTPS terminée par « / », sans requête ni fragment
 */
export function resolveSiteUrl(value) {
  const url = new URL(value || DEFAULT_SITE_URL);
  if (url.protocol !== 'https:') {
    throw new Error(`Adresse du site non HTTPS : ${url.href}`);
  }
  if (!url.pathname.endsWith('/')) {url.pathname += '/';}
  url.search = '';
  url.hash = '';
  return url.href;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * Construit les balises d'une carte de partage.
 * Une vignette de catalogue (380 × 180) convient à une petite carte ;
 * l'image générale du site, en 1280 × 640, justifie la grande carte.
 * @param {{title: string, description: string, url: string, image: string, imageAlt: string, largeImage: boolean}} card
 * @returns {string} Balises HTML indentées, terminées par un saut de ligne
 */
export function shareTags({ title, description, url, image, imageAlt, largeImage }) {
  const tags = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Playlab42'],
    ['property', 'og:locale', 'fr_FR'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', url],
    ['property', 'og:image', image],
    ['property', 'og:image:alt', imageAlt],
    ['name', 'twitter:card', largeImage ? 'summary_large_image' : 'summary'],
  ];
  const lines = tags.map(([kind, key, value]) => `  <meta ${kind}="${key}" content="${escapeAttribute(value)}">`);
  return `  <!-- Carte de partage générée au build depuis le catalogue -->\n${lines.join('\n')}\n`;
}

/**
 * Insère les balises avant </head>, sauf si la page déclare déjà sa propre carte.
 * @param {string} html - Page HTML
 * @param {string} tags - Balises produites par shareTags
 * @returns {string} Page enrichie, ou inchangée si elle a déjà des balises og:
 */
export function injectShareTags(html, tags) {
  if (/<meta\s[^>]*property=["']og:/i.test(html)) {return html;}
  const index = html.search(/<\/head>/i);
  if (index < 0) {throw new Error('Page sans </head> : carte de partage impossible.');}
  return html.slice(0, index) + tags + html.slice(index);
}

function sitePath(output, path) {
  const absolute = resolve(output, path);
  const local = relative(output, absolute);
  if (local.startsWith('..') || isAbsolute(local)) {
    throw new Error(`Chemin hors du site : ${path}`);
  }
  return absolute;
}

/**
 * Ajoute une carte de partage à chaque page de jeu et d'outil du site préparé.
 * @param {string} output - Dossier du site, avec data/catalogue.json
 * @param {string} siteUrl - Adresse publique normalisée (voir resolveSiteUrl)
 * @returns {number} Nombre de pages enrichies
 */
export function addShareCards(output, siteUrl) {
  const catalogue = JSON.parse(readFileSync(join(output, 'data/catalogue.json'), 'utf8'));
  let count = 0;
  for (const [type, items] of [['game', catalogue.games ?? []], ['tool', catalogue.tools ?? []]]) {
    for (const item of items) {
      const page = sitePath(output, item.path);
      if (!existsSync(page)) {throw new Error(`Page du catalogue absente du site : ${item.path}`);}
      const thumb = thumbnailPath(type, item);
      const hasThumb = existsSync(sitePath(output, thumb));
      const tags = shareTags({
        title: `${item.name} — Playlab42`,
        description: item.description,
        url: new URL(item.path, siteUrl).href,
        image: new URL(hasThumb ? thumb : FALLBACK_IMAGE, siteUrl).href,
        imageAlt: hasThumb ? `Vignette de ${item.name}` : 'Playlab42, le laboratoire du développement assisté par IA',
        largeImage: !hasThumb,
      });
      const html = readFileSync(page, 'utf8');
      const enriched = injectShareTags(html, tags);
      if (enriched !== html) {
        writeFileSync(page, enriched);
        count++;
      }
    }
  }
  return count;
}
