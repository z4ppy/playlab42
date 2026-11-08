/**
 * Exports : document HTML autonome et noms de fichiers.
 * @module export
 */

import { inlineText } from './parser/ast.js';
import { DOCUMENT_CSS } from './document-css.js';
import { escapeHtml } from './render-html.js';
import { slugify } from './toc.js';

/**
 * Palette embarquée dans l'export (hors de l'outil, le thème Playlab42
 * n'est pas chargé) : clair par défaut, sombre selon la préférence système.
 */
export const EXPORT_PALETTE_CSS = `
:root {
  color-scheme: light dark;
  --color-bg: #ffffff; --color-bg-secondary: #f3f5f9; --color-text: #182338;
  --color-text-muted: #52617a; --color-border: #c4cede; --color-accent: #b42349;
  --color-error: #dc2626; --color-info: #0277b5; --color-warning: #a35400;
  --color-syntax-string: #2e7d32; --color-syntax-number: #c2410c;
  --color-syntax-boolean: #7b1fa2; --color-syntax-key: #1565c0;
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #101827; --color-bg-secondary: #162235; --color-text: #f1f5fb;
    --color-text-muted: #b8c3d4; --color-border: #42516a; --color-accent: #ff8fa3;
    --color-error: #f87171; --color-info: #4fc3f7; --color-warning: #f4b752;
    --color-syntax-string: #a8db8f; --color-syntax-number: #f4b752;
    --color-syntax-boolean: #da70d6; --color-syntax-key: #88c8ff;
  }
}
body { margin: 0; background: var(--color-bg); }
.md-doc { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
@media print { body { background: #fff; } .md-doc { padding: 0; max-width: none; } }
`;

/**
 * Politique de sécurité du document exporté : aucun script, aucune
 * ressource active ; seules les images et les styles internes sont permis.
 */
export const EXPORT_CSP = "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

/**
 * Titre du document : premier titre rencontré, sinon un intitulé par défaut.
 * @param {import('./parser/ast.js').MdNode} doc
 * @returns {string}
 */
export function documentTitle(doc) {
  const heading = (doc.children ?? []).find((node) => node.type === 'heading');
  const text = heading ? inlineText(heading.children).trim() : '';
  return text || 'Document Markdown';
}

/**
 * Nom de fichier sûr dérivé du titre.
 * @param {string} title
 * @param {string} extension - Sans le point.
 * @returns {string}
 */
export function fileNameFor(title, extension) {
  const base = slugify(title.normalize('NFD').replace(/\p{M}/gu, '')).replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${base || 'document'}.${extension}`;
}

/**
 * Document HTML complet, lisible hors ligne, sans script.
 * @param {{ title: string, body: string }} content - `body` : HTML produit par render-html.
 * @returns {string}
 */
export function buildStandaloneHtml({ title, body }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${EXPORT_CSP}">
<meta name="generator" content="Playlab42 - Éditeur Markdown">
<title>${escapeHtml(title)}</title>
<style>${EXPORT_PALETTE_CSS}${DOCUMENT_CSS}</style>
</head>
<body>
<article class="md-doc">
${body}</article>
</body>
</html>
`;
}
