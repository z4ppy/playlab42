/**
 * Thème automatique des styles de parcours (lecteur et slides).
 *
 * En mode automatique, lib/theme.js retire l'attribut data-theme de <html> :
 * seule la préférence du système décide, via le color-scheme posé par
 * lib/theme.css. Une règle qui ne vise que [data-theme="dark"] ou
 * [data-theme="light"] est alors ignorée et le lecteur mélange les deux thèmes.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from '@jest/globals';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Feuilles du lecteur et des parcours ; le fork transformer-explainer a son propre build. */
function parcoursStylesheets() {
  const found = ['lib/parcours-viewer.css'];
  const walk = directory => {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory() && entry.name !== 'transformer-explainer') { walk(path); }
      if (entry.isFile() && entry.name.endsWith('.css')) { found.push(relative(root, join(root, path))); }
    }
  };
  walk('parcours');
  return found.sort();
}

/**
 * Découpe une feuille en règles { media, selectors, declarations }.
 * Suffisant pour ces feuilles : règles simples, éventuellement dans un @media.
 */
function parseRules(css) {
  const rules = [];
  const media = [];
  let prelude = '';
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      const head = prelude.trim();
      prelude = '';
      if (head.startsWith('@')) {
        media.push(head);
        continue;
      }
      const end = source.indexOf('}', index);
      const declarations = source.slice(index + 1, end).split(';')
        .map(declaration => declaration.trim().replace(/\s+/g, ' ')).filter(Boolean).sort();
      rules.push({ media: media.join(' '), selectors: head.split(',').map(selector => selector.trim()), declarations });
      index = end;
    } else if (char === '}') {
      media.pop();
      prelude = '';
    } else {
      prelude += char;
    }
  }
  return rules;
}

/**
 * Règles visant un thème choisi sans équivalent en mode automatique : il faut
 * la même règle sur :root:not([data-theme]) dans @media (prefers-color-scheme: …),
 * ou un sélecteur :root non conditionnel dans la même liste.
 */
function rulesMissingAutoTheme(css) {
  const rules = parseRules(css);
  const missing = [];
  for (const rule of rules) {
    for (const selector of rule.selectors) {
      const match = selector.match(/^\[data-theme="(dark|light)"\]\s*(.*)$/);
      if (!match) { continue; }
      const [, theme, rest] = match;
      if (!rest && rule.selectors.includes(':root')) { continue; }
      const automatic = `:root:not([data-theme])${rest ? ` ${rest}` : ''}`;
      const covered = rules.some(candidate => candidate.media.includes(`(prefers-color-scheme: ${theme})`)
        && candidate.selectors.includes(automatic)
        && JSON.stringify(candidate.declarations) === JSON.stringify(rule.declarations));
      if (!covered) { missing.push(selector); }
    }
  }
  return missing;
}

describe('rulesMissingAutoTheme : détection des règles réservées à un thème choisi', () => {
  it('signale une surcharge sombre sans équivalent automatique (défaut corrigé)', () => {
    const css = '.tip { box-shadow: a; }\n[data-theme="dark"] .tip { box-shadow: b; }';
    expect(rulesMissingAutoTheme(css)).toEqual(['[data-theme="dark"] .tip']);
  });

  it('accepte une surcharge doublée à l’identique pour la préférence système', () => {
    const css = `[data-theme="light"] .x { color: red; }
      @media (prefers-color-scheme: light) { :root:not([data-theme]) .x { color: red; } }`;
    expect(rulesMissingAutoTheme(css)).toEqual([]);
  });

  it('refuse un équivalent automatique incomplet ou sous la mauvaise préférence', () => {
    const partial = `[data-theme="light"] .x { color: red; background: blue; }
      @media (prefers-color-scheme: light) { :root:not([data-theme]) .x { color: red; } }`;
    const inverted = `[data-theme="dark"] .x { color: red; }
      @media (prefers-color-scheme: light) { :root:not([data-theme]) .x { color: red; } }`;
    expect(rulesMissingAutoTheme(partial)).toEqual(['[data-theme="light"] .x']);
    expect(rulesMissingAutoTheme(inverted)).toEqual(['[data-theme="dark"] .x']);
  });

  it('accepte une liste qui inclut déjà :root sans condition', () => {
    expect(rulesMissingAutoTheme(':root,\n[data-theme="light"] { --a: 1; }')).toEqual([]);
  });
});

describe('styles de parcours en thème automatique', () => {
  const stylesheets = parcoursStylesheets();

  it('analyse le lecteur, les styles partagés des slides et ceux des epics', () => {
    expect(stylesheets).toEqual(expect.arrayContaining([
      'lib/parcours-viewer.css',
      'parcours/_shared/highlight-theme.css',
      'parcours/_shared/slide-layout.css',
      'parcours/epics/openspec-usage-guide/openspec-guide.css',
    ]));
  });

  for (const file of stylesheets) {
    it(`${file} : chaque règle de thème choisi s’applique aussi en automatique`, () => {
      expect(rulesMissingAutoTheme(readFileSync(join(root, file), 'utf8'))).toEqual([]);
    });
  }

  it('déclare une seule fois, avec light-dark(clair, sombre), les teintes propres au sombre du lecteur', () => {
    const rules = parseRules(readFileSync(join(root, 'lib/parcours-viewer.css'), 'utf8'));
    const declarationsOf = selector => rules.filter(rule => rule.selectors.includes(selector))
      .flatMap(rule => rule.declarations);
    // Valeurs du thème sombre choisi conservées : voile 0,7 derrière le menu mobile, ombre 0,3 de l'infobulle.
    expect(declarationsOf('.parcours-viewer.menu-open::before'))
      .toContain('background: light-dark(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7))');
    const shadow = declarationsOf('.glossary-tooltip').find(declaration => declaration.startsWith('box-shadow:'));
    expect(shadow.match(/light-dark\(rgba\(0, 0, 0, 0\.1\), rgba\(0, 0, 0, 0\.3\)\)/g)).toHaveLength(2);
  });
});
