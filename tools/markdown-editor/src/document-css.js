/**
 * Feuille de style du document rendu, source unique partagée par l'aperçu
 * de l'outil et par l'export HTML autonome (qui l'embarque telle quelle).
 *
 * Elle ne dépend que des variables du thème Playlab42 (`--color-*`) : dans
 * l'outil, `lib/theme.css` les fournit en clair comme en sombre ; dans
 * l'export, `EXPORT_PALETTE_CSS` les redéfinit selon la préférence système.
 *
 * @module document-css
 */

export const DOCUMENT_CSS = `
.md-doc {
  /* Coloration : en clair, teintes plus foncées que le thème pour tenir le
   * contraste AA (4,5:1) sur le fond des blocs de code ; en sombre, le thème. */
  --md-tok-number: light-dark(#bf360c, var(--color-syntax-number));
  --md-tok-function: light-dark(#0369a1, var(--color-info));
  --md-tok-variable: light-dark(#a35400, var(--color-warning));
  color: var(--color-text);
  font: 1rem/1.65 var(--font-family, system-ui, sans-serif);
  overflow-wrap: break-word;
  word-break: normal;
}
.md-doc > :first-child { margin-top: 0; }
.md-doc > :last-child { margin-bottom: 0; }
.md-doc :is(p, ul, ol, blockquote, pre, .md-table, table, hr) { margin: 0 0 1em; }
.md-doc :is(h1, h2, h3, h4, h5, h6) {
  margin: 1.4em 0 0.6em;
  line-height: 1.25;
  font-weight: 700;
  scroll-margin-top: 1rem;
}
.md-doc h1 { font-size: 1.9em; padding-bottom: 0.25em; border-bottom: 1px solid var(--color-border); }
.md-doc h2 { font-size: 1.45em; padding-bottom: 0.2em; border-bottom: 1px solid var(--color-border); }
.md-doc h3 { font-size: 1.2em; }
.md-doc h4 { font-size: 1em; }
.md-doc :is(h5, h6) { font-size: 0.9em; color: var(--color-text-muted); }
.md-doc a { color: var(--color-accent); text-underline-offset: 0.15em; }
.md-doc :is(ul, ol) { padding-left: 1.6em; }
.md-doc li + li, .md-doc li > :is(ul, ol) { margin-top: 0.25em; }
.md-doc li > :is(ul, ol) { margin-bottom: 0; }
.md-doc .contains-task-list { list-style: none; padding-left: 0.4em; }
.md-doc .task-list-item .contains-task-list { padding-left: 1.6em; }
.md-doc .task-list-item-checkbox {
  width: 1.15em;
  height: 1.15em;
  margin: 0 0.35em 0 0;
  vertical-align: -0.15em;
  accent-color: var(--color-accent);
}
.md-doc blockquote {
  padding: 0.1em 1em;
  color: var(--color-text-muted);
  border-left: 0.25em solid var(--color-accent);
  background: var(--color-bg-secondary);
  border-radius: 0 6px 6px 0;
}
.md-doc blockquote > * { margin: 0.6em 0; }
.md-doc code {
  font: 0.88em/1.5 var(--font-mono, ui-monospace, monospace);
  padding: 0.1em 0.35em;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}
.md-doc pre {
  padding: 0.85em 1em;
  overflow-x: auto;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  -webkit-overflow-scrolling: touch;
}
.md-doc pre code { padding: 0; border: 0; background: none; font-size: 0.86em; }
.md-doc hr { height: 0; border: 0; border-top: 2px solid var(--color-border); }
.md-doc img { max-width: 100%; height: auto; }
.md-doc .md-table { max-width: 100%; overflow-x: auto; }
.md-doc .md-table table { margin: 0; }
.md-doc table { border-collapse: collapse; }
.md-doc :is(th, td) { padding: 0.4em 0.75em; border: 1px solid var(--color-border); vertical-align: top; }
.md-doc th { background: var(--color-bg-secondary); }
.md-doc tbody tr:nth-child(even) { background: color-mix(in srgb, var(--color-bg-secondary) 55%, transparent); }
.md-doc .md-blocked { text-decoration: underline wavy var(--color-error); cursor: help; }
.md-doc .tok-comment { color: var(--color-text-muted); font-style: italic; }
.md-doc .tok-string { color: var(--color-syntax-string); }
.md-doc :is(.tok-number, .tok-literal) { color: var(--md-tok-number); }
.md-doc .tok-keyword { color: var(--color-syntax-boolean); font-weight: 600; }
.md-doc :is(.tok-property, .tok-attr) { color: var(--color-syntax-key); }
.md-doc .tok-function { color: var(--md-tok-function); }
.md-doc .tok-tag { color: var(--color-accent); }
.md-doc .tok-variable { color: var(--md-tok-variable); }
@media print {
  .md-doc { color: #000; font-size: 11pt; }
  .md-doc a { color: #000; }
  .md-doc a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; word-break: break-all; }
  .md-doc :is(pre, blockquote, table, img, li) { break-inside: avoid; }
  .md-doc :is(h1, h2, h3, h4) { break-after: avoid; }
  .md-doc pre { white-space: pre-wrap; }
}
`;
