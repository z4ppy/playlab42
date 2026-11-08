/**
 * Brouillon, préférences, export HTML, correspondance de défilement et raccourcis.
 */
import { readFileSync } from 'node:fs';
import { DRAFT_KEY, VIEW_KEY, createDraftStore, createPreference, isQuotaError } from '../src/storage.js';
import { EXPORT_CSP, buildStandaloneHtml, documentTitle, fileNameFor } from '../src/export.js';
import { DOCUMENT_CSS } from '../src/document-css.js';
import { parse } from '../src/parser/index.js';
import { renderHtml } from '../src/render-html.js';
import { buildScrollMap, interpolate } from '../src/scroll-map.js';
import { COMMANDS, commandForKey, shortcutLabel } from '../src/commands.js';

/** Stockage en mémoire, avec pannes simulables. */
function memoryStorage({ failWith } = {}) {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (failWith) {
        throw failWith;
      }
      data.set(key, String(value));
    },
    removeItem: (key) => data.delete(key),
  };
}

describe('brouillon', () => {
  test('aller-retour', () => {
    const storage = memoryStorage();
    const store = createDraftStore(() => storage);
    expect(store.load()).toBeNull();
    expect(store.save('# Texte', 1234)).toEqual({ ok: true });
    expect(store.load()).toEqual({ text: '# Texte', savedAt: 1234 });
    expect(JSON.parse(storage.data.get(DRAFT_KEY))).toEqual({ v: 1, text: '# Texte', savedAt: 1234 });
    expect(store.clear()).toBe(true);
    expect(store.load()).toBeNull();
  });

  test('quota dépassé et stockage indisponible signalés sans exception', () => {
    const quota = Object.assign(new Error('plein'), { name: 'QuotaExceededError' });
    expect(createDraftStore(() => memoryStorage({ failWith: quota })).save('x')).toEqual({ ok: false, reason: 'quota' });
    expect(createDraftStore(() => memoryStorage({ failWith: new Error('refus') })).save('x')).toEqual({ ok: false, reason: 'unavailable' });
    expect(createDraftStore(() => undefined).save('x')).toEqual({ ok: false, reason: 'unavailable' });
    const throwing = () => {
      throw new Error('SecurityError');
    };
    expect(createDraftStore(throwing).load()).toBeNull();
    expect(createDraftStore(throwing).clear()).toBe(false);
  });

  test('brouillon corrompu ou d\'un autre format ignoré', () => {
    for (const raw of ['{', '"texte"', '{"v":2,"text":"a","savedAt":1}', '{"v":1,"text":3,"savedAt":1}', 'null']) {
      const storage = memoryStorage();
      storage.data.set(DRAFT_KEY, raw);
      expect(createDraftStore(() => storage).load()).toBeNull();
    }
  });

  test('isQuotaError', () => {
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError(new Error('x'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });

  test('préférence de vue : valeurs énumérées uniquement', () => {
    const storage = memoryStorage();
    const preference = createPreference(VIEW_KEY, ['editor', 'split'], () => storage);
    expect(preference.get()).toBeNull();
    expect(preference.set('split')).toBe(true);
    expect(preference.get()).toBe('split');
    storage.data.set(VIEW_KEY, 'autre');
    expect(preference.get()).toBeNull();
    const broken = createPreference(VIEW_KEY, ['editor'], () => memoryStorage({ failWith: new Error('x') }));
    expect(broken.set('editor')).toBe(false);
    expect(createPreference(VIEW_KEY, ['editor'], () => {
      throw new Error('x');
    }).get()).toBeNull();
  });
});

describe('export HTML autonome', () => {
  test('document complet, sans script, CSS incluse, CSP restrictive', () => {
    const html = buildStandaloneHtml({ title: 'A <b> & "c"', body: '<p>x</p>\n' });
    expect(html).toMatch(/^<!DOCTYPE html>\n<html lang="fr">/);
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>');
    expect(html).toContain(`content="${EXPORT_CSP}"`);
    expect(EXPORT_CSP).toContain("default-src 'none'");
    expect(EXPORT_CSP).not.toMatch(/script-src/);
    expect(html).toContain(DOCUMENT_CSS);
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('<article class="md-doc">\n<p>x</p>\n</article>');
    expect(html).not.toMatch(/<script/i);
  });

  test('titre et nom de fichier', () => {
    expect(documentTitle(parse('texte\n\n## Mon *beau* titre\n'))).toBe('Mon beau titre');
    expect(documentTitle(parse('rien'))).toBe('Document Markdown');
    expect(fileNameFor('Éditeur : l\'été 2026 !', 'md')).toBe('editeur-lete-2026.md');
    expect(fileNameFor('???', 'html')).toBe('document.html');
  });

  test('la feuille du document couvre clair/sombre via les variables et l\'impression', () => {
    expect(DOCUMENT_CSS).toContain('var(--color-text)');
    expect(DOCUMENT_CSS).toContain('@media print');
  });

  test('contraste AA (4,5:1) des teintes claires propres à l\'outil', () => {
    const luminance = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    // Fonds clairs : blocs de code de l'outil (#fff) et de l'export (#f3f5f9).
    const lightTokens = [...DOCUMENT_CSS.matchAll(/--md-tok-[a-z]+: light-dark\((#[0-9a-f]{6})/g)].map((m) => m[1]);
    expect(lightTokens).toHaveLength(3);
    for (const color of lightTokens) {
      expect(contrast(color, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, '#f3f5f9')).toBeGreaterThanOrEqual(4.5);
    }
    // Avertissement de brouillon (clair, sur la barre d'état blanche).
    const warning = /\.mde-save\.is-warning \{[^}]*light-dark\((#[0-9a-f]{6})/.exec(style)[1];
    expect(contrast(warning, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    // « Nouveau document » (sombre, sur la carte du menu #1c2b40).
    const danger = /\.mde-menu-item--danger \{[^}]*light-dark\(var\(--color-error\), (#[0-9a-f]{6})\)/.exec(style)[1];
    expect(contrast(danger, '#1c2b40')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('correspondance de défilement', () => {
  test('interpolation linéaire par morceaux et bornes', () => {
    expect(interpolate(-5, [0, 10, 20], [0, 100, 120])).toBe(0);
    expect(interpolate(5, [0, 10, 20], [0, 100, 120])).toBe(50);
    expect(interpolate(15, [0, 10, 20], [0, 100, 120])).toBe(110);
    expect(interpolate(99, [0, 10, 20], [0, 100, 120])).toBe(120);
    expect(interpolate(0, [0, 0], [5, 5])).toBe(5);
  });

  test('ancres non monotones ignorées, fonction inversible', () => {
    const map = buildScrollMap([[100, 300], [50, 400], [200, 250], [300, 600], [5000, 9000]], 1000, 2000);
    // Gardées : (50, 400) et (300, 600) ; (100, 300) et (200, 250) reculent.
    expect(map.toPreview(50)).toBe(400);
    expect(map.toPreview(175)).toBe(500);
    expect(map.toPreview(300)).toBe(600);
    expect(map.toPreview(1000)).toBe(2000);
    expect(map.toEditor(map.toPreview(250))).toBeCloseTo(250);
  });

  test('sans défilement possible', () => {
    const map = buildScrollMap([], 0, 0);
    expect(map.toPreview(0)).toBe(0);
    expect(Number.isFinite(map.toEditor(10))).toBe(true);
  });
});

describe('raccourcis clavier', () => {
  const key = (overrides) => ({ key: '', code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...overrides });

  test('Ctrl/Cmd + lettre', () => {
    expect(commandForKey(key({ key: 'b', ctrlKey: true }))?.id).toBe('bold');
    expect(commandForKey(key({ key: 'I', metaKey: true }))?.id).toBe('italic');
    expect(commandForKey(key({ key: 'k', ctrlKey: true }))?.id).toBe('link');
    expect(commandForKey(key({ key: 'e', ctrlKey: true }))?.id).toBe('code');
    expect(commandForKey(key({ key: 'X', ctrlKey: true, shiftKey: true }))?.id).toBe('strike');
  });

  test('chiffres avec Maj selon la touche physique', () => {
    expect(commandForKey(key({ key: '_', code: 'Digit8', ctrlKey: true, shiftKey: true }))?.id).toBe('bullet');
    expect(commandForKey(key({ key: '&', code: 'Digit7', ctrlKey: true, shiftKey: true }))?.id).toBe('ordered');
  });

  test('sans modificateur, avec Alt ou combinaison inconnue : rien', () => {
    expect(commandForKey(key({ key: 'b' }))).toBeNull();
    expect(commandForKey(key({ key: 'b', ctrlKey: true, altKey: true }))).toBeNull();
    expect(commandForKey(key({ key: 'b', ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(commandForKey(key({ key: 'z', ctrlKey: true }))).toBeNull();
  });

  test('libellés', () => {
    const bold = COMMANDS.find((command) => command.id === 'bold');
    const bullet = COMMANDS.find((command) => command.id === 'bullet');
    const table = COMMANDS.find((command) => command.id === 'table');
    expect(shortcutLabel(bold, false)).toBe('Ctrl+B');
    expect(shortcutLabel(bullet, true)).toBe('⌘⇧8');
    expect(shortcutLabel(bullet, false)).toBe('Ctrl+Maj+8');
    expect(shortcutLabel(table, false)).toBe('');
  });

  test('chaque commande agit sur la sélection', () => {
    for (const command of COMMANDS) {
      // Le retrait ne s'applique qu'aux éléments de liste (vérifié par l'interface).
      const text = { indent: '- a\n- mot', outdent: '- a\n  - mot' }[command.id] ?? 'mot';
      const next = command.run({ text, start: text.length - 3, end: text.length });
      expect(next.text).not.toBe(text);
    }
  });

  test('retrait : équivalents tactiles de Tab et Maj+Tab', () => {
    const indent = COMMANDS.find((command) => command.id === 'indent');
    const outdent = COMMANDS.find((command) => command.id === 'outdent');
    expect([indent.listOnly, outdent.listOnly]).toEqual([true, true]);
    expect(indent.run({ text: '- a\n- b', start: 7, end: 7 }).text).toBe('- a\n  - b');
    expect(outdent.run({ text: '- a\n  - b', start: 9, end: 9 }).text).toBe('- a\n- b');
    expect(shortcutLabel(indent, false)).toBe('Tab');
    expect(shortcutLabel(outdent, true)).toBe('Maj+Tab');
  });

  test('italique avec « * » : agit aussi au milieu d\'un mot', () => {
    const italic = COMMANDS.find((command) => command.id === 'italic');
    const next = italic.run({ text: 'foobarbaz', start: 3, end: 6 });
    expect(next).toEqual({ text: 'foo*bar*baz', start: 4, end: 7 });
    expect(renderHtml(next.text)).toBe('<p>foo<em>bar</em>baz</p>\n');
    // Second appui : l'italique est retiré.
    expect(italic.run(next).text).toBe('foobarbaz');
    // Dans du gras, l'italique s'ajoute au lieu de retirer une étoile du gras.
    expect(italic.run({ text: '**gras**', start: 2, end: 6 }).text).toBe('***gras***');
    expect(italic.run({ text: '***gras***', start: 3, end: 7 }).text).toBe('**gras**');
    expect(italic.run({ text: '**gras**', start: 0, end: 8 }).text).toBe('***gras***');
    expect(italic.run({ text: '*a*', start: 0, end: 3 }).text).toBe('a');
  });
});
