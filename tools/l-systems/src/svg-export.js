/**
 * Export SVG — logique pure (produit une chaîne).
 *
 * Les segments consécutifs d'un même style qui se prolongent sont fusionnés
 * en polylignes « M … L … L … » : un fichier bien plus léger et des jonctions
 * propres. Le dessin est recadré dans un carré logique de `size` unités.
 */

/** Au-delà, le fichier dépasserait plusieurs dizaines de Mo. */
export const MAX_SVG_SEGMENTS = 400_000;

/**
 * Arrondit une coordonnée à deux décimales, sans zéros inutiles.
 * @param {number} value - Valeur
 * @returns {string}
 */
function format(value) {
  return String(Math.round(value * 100) / 100);
}

/**
 * Échappe un texte pour un attribut XML.
 * @param {string} text - Texte
 * @returns {string}
 */
function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Construit les données de chemin « d » de chaque style.
 * @param {import('./turtle.js').Drawing} drawing - Dessin
 * @param {Uint16Array} keys - Style de chaque segment
 * @param {(x: number, y: number) => [number, number]} project - Projection
 * @returns {Map<number, string[]>}
 */
function buildPaths(drawing, keys, project) {
  const paths = new Map();
  const lastEnd = new Map();
  const s = drawing.segments;
  for (let i = 0; i < drawing.count; i++) {
    const [x1, y1] = project(s[i * 4], s[i * 4 + 1]);
    const [x2, y2] = project(s[i * 4 + 2], s[i * 4 + 3]);
    const start = `${format(x1)} ${format(y1)}`;
    const key = keys[i];
    if (!paths.has(key)) {
      paths.set(key, []);
    }
    const parts = paths.get(key);
    if (lastEnd.get(key) !== start) {
      parts.push(`M${start}`);
    }
    const end = `${format(x2)} ${format(y2)}`;
    parts.push(`L${end}`);
    lastEnd.set(key, end);
  }
  return paths;
}

/**
 * Refuse un dessin vide ou trop gros pour un fichier SVG raisonnable.
 * @param {import('./turtle.js').Drawing} drawing - Dessin
 * @throws {Error} Message lisible
 */
function assertExportable(drawing) {
  if (!drawing.bounds || drawing.count === 0) {
    throw new Error('Rien à exporter : le dessin est vide.');
  }
  if (drawing.count > MAX_SVG_SEGMENTS) {
    throw new Error(`SVG trop volumineux (${drawing.count.toLocaleString('fr-FR')} segments, maximum ${MAX_SVG_SEGMENTS.toLocaleString('fr-FR')}). Réduisez les itérations ou exportez en PNG.`);
  }
}

/**
 * Produit un document SVG autonome.
 * @param {import('./turtle.js').Drawing} drawing - Dessin
 * @param {import('./style.js').StyleIndex} styleIndex - Styles
 * @param {{ size?: number, padding?: number, background?: string|null, title?: string }} [options] - Options
 * @returns {string} Document SVG
 * @throws {Error} Si le dessin est vide ou trop volumineux
 */
export function buildSvg(drawing, styleIndex, options = {}) {
  const { size = 1000, padding = 20, background = null, title = 'L-système' } = options;
  assertExportable(drawing);
  const { minX, minY, maxX, maxY } = drawing.bounds;
  const span = Math.max(maxX - minX, maxY - minY, 1e-9);
  const scale = (size - 2 * padding) / span;
  const width = Math.ceil((maxX - minX) * scale + 2 * padding);
  const height = Math.ceil((maxY - minY) * scale + 2 * padding);
  // y du monde vers le haut, y du SVG vers le bas.
  const project = (x, y) => [(x - minX) * scale + padding, (maxY - y) * scale + padding];
  const paths = buildPaths(drawing, styleIndex.keys, project);
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<title>${escapeXml(title)}</title>`,
  ];
  if (background) {
    lines.push(`<rect width="100%" height="100%" fill="${escapeXml(background)}"/>`);
  }
  lines.push('<g fill="none" stroke-linecap="round" stroke-linejoin="round">');
  for (const [key, parts] of paths) {
    const style = styleIndex.styles[key];
    lines.push(`<path stroke="${escapeXml(style.color)}" stroke-width="${format(style.width)}" d="${parts.join('')}"/>`);
  }
  lines.push('</g>', '</svg>');
  return lines.join('\n');
}
