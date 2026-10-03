import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { getRootDir } from './lib/build-utils.js';

// Contrats observables des vrais builders : sortie, statut, JSON généré et catalogue précédent.
const previous = '{"previous":true}\n';
const template = '<!doctype html><title>{{TITLE}}</title><main>{{CONTENT}}</main>';
let root;

function write(path, content) {
  const target = join(root, path);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content));
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function run(builder, args = []) {
  const result = spawnSync(process.execPath, [`scripts/build-${builder}.js`, ...args], {
    cwd: root, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, SOURCE_DATE_EPOCH: '1700000000' },
  });
  expect(result.error).toBeUndefined();
  return {
    status: result.status,
    stdout: result.stdout.replaceAll(root, '<ROOT>'),
    stderr: result.stderr.replaceAll(root, '<ROOT>'),
  };
}

const lines = text => text.split('\n');
// L'ordre de readdir dépend du système de fichiers : les diagnostics multiples sont comparés triés.
const sortedLines = text => lines(text).filter(Boolean).sort();

beforeEach(() => {
  root = mkdtempSync(join(getRootDir(import.meta.url), '.builders-contract-'));
  mkdirSync(join(root, 'scripts'));
  for (const source of ['build-catalogue.js', 'build-parcours.js', 'build-bookmarks.js', 'build-typescript.js', 'parcours-utils.js', 'og-fetcher.js']) {
    cpSync(fileURLToPath(new URL(source, import.meta.url)), join(root, 'scripts', source));
  }
  cpSync(fileURLToPath(new URL('lib', import.meta.url)), join(root, 'scripts', 'lib'), { recursive: true });
  symlinkSync(join(getRootDir(import.meta.url), 'node_modules'), join(root, 'node_modules'));
  write('package.json', { type: 'module' });
  for (const output of ['catalogue', 'parcours', 'bookmarks']) {
    write(`data/${output}.json`, previous);
  }
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const html = '<!doctype html><title>x</title>';
const toolBase = { id: 'alpha', name: 'Alpha', description: 'Premier outil', tags: ['demo'] };
const gameBase = {
  id: 'duel', name: 'Duel', description: 'Un jeu', tags: ['jeu'], players: { min: 1, max: 2 }, type: 'turn-based',
};

describe('catalogue : sortie publique', () => {
  test('publie outils simples puis complexes, jeux, champs optionnels et résumé exacts', () => {
    write('tools/alpha.json', { ...toolBase, version: '1.2.3', author: 'Ada', icon: '🧪', ignored: true });
    write('tools/alpha.html', html);
    write('tools/beta/tool.json', { ...toolBase, id: 'beta', name: 'Beta' });
    write('tools/beta/index.html', html);
    write('tools/sans-manifest/readme.txt', 'ignoré');
    write('games/duel/game.json', { ...gameBase, version: '2.0.0', author: 'Bob', icon: '🎲' });
    write('games/duel/index.html', html);
    write('games/sans-manifest/index.html', html);

    const result = run('catalogue');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(sortedLines(result.stdout)).toEqual(sortedLines([
      '', '\x1b[36mBuilding catalogue...\x1b[0m', '',
      'Scanning tools/ (simple)', '\x1b[32m  ✓ Alpha\x1b[0m', '',
      'Scanning tools/ (complex)', '\x1b[32m  ✓ Beta (complex)\x1b[0m', '',
      'Scanning games/', '\x1b[2m  sans-manifest/: No game.json found, skipping\x1b[0m',
      '\x1b[32m  ✓ Duel\x1b[0m', '',
      '\x1b[36mSummary:\x1b[0m', '  Tools: 2', '  Games: 1', '',
      '\x1b[32m✓ Catalogue written to <ROOT>/data/catalogue.json\x1b[0m', '', '',
    ].join('\n')));
    expect(read('data/catalogue.json')).toBe(`${JSON.stringify({
      version: '1.0',
      generatedAt: '2023-11-14T22:13:20.000Z',
      tools: [
        {
          id: 'alpha', name: 'Alpha', description: 'Premier outil', path: 'tools/alpha.html', tags: ['demo'],
          version: '1.2.3', author: 'Ada', icon: '🧪',
        },
        { id: 'beta', name: 'Beta', description: 'Premier outil', path: 'tools/beta/index.html', tags: ['demo'] },
      ],
      games: [{
        id: 'duel', name: 'Duel', description: 'Un jeu', path: 'games/duel/index.html',
        players: { min: 1, max: 2 }, tags: ['jeu'], type: 'turn-based', version: '2.0.0', author: 'Bob', icon: '🎲',
      }],
    }, null, 2)}`);
  });

  test('sans dossiers tools/ ni games/, publie un catalogue vide avec les messages dédiés', () => {
    const result = run('catalogue');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('\x1b[2m  tools/ directory not found, skipping\x1b[0m');
    expect(result.stdout).toContain('\x1b[2m  games/ directory not found, skipping\x1b[0m');
    expect(JSON.parse(read('data/catalogue.json'))).toMatchObject({ tools: [], games: [] });
  });
});

describe('catalogue : erreurs de schéma et mode d’échec', () => {
  test.each([
    ['outil simple', 'tools/x.json', 'x.json', {}, 'x.json: Missing required field \'id\', Missing required field \'name\', '
      + 'Missing required field \'description\', Missing required field \'tags\''],
    ['outil simple', 'tools/x.json', 'x.json', { ...toolBase, id: 'Bad_Id', tags: 'demo', version: '1.0' },
      'x.json: \'id\' must be kebab-case (lowercase letters, numbers, hyphens), \'tags\' must be an array, '
      + '\'version\' must be semver format (e.g., \'1.0.0\')'],
    ['outil complexe', 'tools/x/tool.json', 'x/tool.json', { ...toolBase, tags: 'demo' }, 'x/tool.json: \'tags\' must be an array'],
    ['jeu', 'games/x/game.json', 'x/game.json', { id: 'Bad Id', tags: 'jeu', version: 'v1' },
      'x/game.json: Missing required field \'name\', Missing required field \'description\', '
      + 'Missing required field \'players\', Missing required field \'type\', '
      + '\'id\' must be kebab-case (lowercase letters, numbers, hyphens), \'tags\' must be an array, '
      + '\'version\' must be semver format (e.g., \'1.0.0\')'],
    ['jeu', 'games/x/game.json', 'x/game.json', { ...gameBase, players: { min: 'a', max: 'b' }, type: 'solo' },
      'x/game.json: \'players.min\' must be a number, \'players.max\' must be a number, '
      + '\'type\' must be \'turn-based\' or \'real-time\''],
    ['jeu', 'games/x/game.json', 'x/game.json', { ...gameBase, players: { min: 3, max: 2 } },
      'x/game.json: \'players.min\' cannot be greater than \'players.max\''],
  ])('%s invalide : message unique, exit 1, catalogue précédent conservé', (_kind, manifest, _label, data, message) => {
    write(manifest, data);
    const result = run('catalogue');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`\n\x1b[31mErrors:\x1b[0m\n\x1b[31m  ✗ ${message}\x1b[0m\n\n`);
    expect(result.stdout).not.toContain('Catalogue written');
    expect(read('data/catalogue.json')).toBe(previous);
  });

  test('cumule toutes les erreurs de scan, doublons et fichiers HTML manquants avant d’échouer', () => {
    write('tools/dup.json', { ...toolBase, id: 'same' });
    write('tools/dup.html', html);
    write('tools/folder/tool.json', { ...toolBase, id: 'same' });
    write('tools/folder/index.html', html);
    write('tools/broken.json', '{');
    write('games/g/game.json', gameBase);

    const result = run('catalogue');
    expect(result.status).toBe(1);
    const diagnostics = sortedLines(result.stdout).filter(line => line.includes('✗'));
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics).toContain('\x1b[31m  ✗ Duplicate tool id: \'same\'\x1b[0m');
    expect(diagnostics).toContain('\x1b[31m  ✗ g/game.json: No index.html found\x1b[0m');
    expect(diagnostics.some(line => line.includes('broken.json'))).toBe(true);
    expect(read('data/catalogue.json')).toBe(previous);
  });
});

function epic(overrides = {}) {
  return {
    id: 'demo', title: 'Demo', description: 'Parcours', hierarchy: ['tests'], tags: ['t1'],
    metadata: { author: 'Test', created: '2026-10-03' }, content: [{ id: 'intro' }], ...overrides,
  };
}

function writeEpic(id, manifest, slides = ['intro']) {
  write(`parcours/epics/${id}/epic.json`, manifest);
  for (const slide of slides) {
    write(`parcours/epics/${id}/slides/${slide}/slide.json`, { id: slide, title: `Titre ${slide}` });
    write(`parcours/epics/${id}/slides/${slide}/index.html`, html);
  }
}

describe('parcours : rapport, avertissements et erreurs', () => {
  test('publie triés par ordre, ignore brouillons et sans manifest, rapporte les avertissements en exit 0', () => {
    write('parcours/index.json', {});
    writeEpic('second', epic({ id: 'second', order: 2, thumbnail: 'absent.png', tags: ['b'] }));
    writeEpic('first', epic({ id: 'first', order: 1, tags: ['a', 'b'], icon: '🧪' }));
    writeEpic('draft', epic({ id: 'draft', draft: true }));
    write('parcours/epics/vide/readme.txt', 'sans epic.json');
    write('parcours/glossary.json', { terms: { alpha: { short: 'x'.repeat(201), see: ['Beta', 'Inconnu'] }, beta: { short: 'ok' } } });

    const result = run('parcours');
    expect(result.status).toBe(0);
    expect(sortedLines(result.stdout)).toEqual(sortedLines([
      'Build Parcours', '==============', '',
      'Config chargée: <ROOT>/parcours/index.json',
      'Glossaire global chargé: 2 termes', '', 'Scan des epics...',
      '  [OK] second (1 slides, 2 termes glossaire)', '  [OK] first (1 slides, 2 termes glossaire)', '  [DRAFT] draft', '',
      'Construction du catalogue...', '', '--- Rapport ---',
      'Epics trouvés: 3', 'Epics publiés: 2', 'Brouillons: 1', 'Tags uniques: 2', 'Termes de glossaire: 4', '',
      'Warnings (3):',
      '  ⚠️  second: Vignette non trouvée: absent.png',
      '  ⚠️  second: Glossaire - terme "alpha" définition courte > 200 caractères, '
        + 'Glossaire - terme "alpha" référence "Inconnu" non défini',
      '  ⚠️  first: Glossaire - terme "alpha" définition courte > 200 caractères, '
        + 'Glossaire - terme "alpha" référence "Inconnu" non défini',
      '', 'Catalogue généré: <ROOT>/data/parcours.json', '', '✅ Build terminé avec succès', '',
    ].join('\n')));
    // Template absent : avertissement console non bloquant, hors rapport.
    expect(result.stderr).toContain('Template de slide non trouvé');
    const catalogue = JSON.parse(read('data/parcours.json'));
    expect(catalogue.epics.map(entry => entry.id)).toEqual(['first', 'second']);
    expect(catalogue.epics[1]).toMatchObject({
      path: './parcours/epics/second', thumbnail: './parcours/epics/second/absent.png', slideCount: 1,
      hierarchy: ['tests'], author: 'Test', glossaryTermCount: 2,
    });
    expect(catalogue.generatedAt).toBe('2023-11-14T22:13:20.000Z');
  });

  test('cumule les erreurs métier sous forme de rapport et conserve le catalogue précédent', () => {
    write('parcours/index.json', {});
    writeEpic('champs', { id: 'champs', metadata: {} });
    writeEpic('slides', epic({ id: 'slides', content: [{ id: 'absente' }, { id: 'sans-json' }] }), []);
    write('parcours/epics/slides/slides/sans-json/index.html', html);
    writeEpic('glossaire', epic({ id: 'glossaire' }));
    write('parcours/epics/glossaire/glossary.json', { terme: {} });
    write('parcours/epics/cassee/epic.json', '{');

    const result = run('parcours');
    expect(result.status).toBe(1);
    const report = result.stdout.slice(result.stdout.indexOf('Erreurs ('));
    expect(report.split('\n')[0]).toBe('Erreurs (4):');
    const failures = sortedLines(report).filter(line => line.startsWith('  ❌'));
    expect(failures.filter(line => line.includes('cassee/epic.json'))).toEqual([
      expect.stringMatching(/^ {2}❌ Erreur lecture <ROOT>\/parcours\/epics\/cassee\/epic\.json: /),
    ]);
    expect(failures.filter(line => !line.includes('cassee/epic.json'))).toEqual(sortedLines([
      '  ❌ champs: Champ requis manquant: title, Champ requis manquant: description, '
        + 'Champ requis manquant: hierarchy, Champ requis manquant: tags, Champ requis manquant: content, '
        + 'metadata.author requis, metadata.created requis',
      '  ❌ slides: Slide non trouvée: absente, slide.json manquant pour: sans-json',
      '  ❌ glossaire: Glossaire - terme "terme" sans définition courte (short)',
    ].join('\n')));
    expect(result.stdout).toContain('  [ERREUR] champs: 7 erreur(s)');
    expect(result.stdout).not.toContain('terminé avec succès');
    expect(read('data/parcours.json')).toBe(previous);
  });
});

function bookmarkFixture() {
  write('bookmarks/index.json', { categories: [{ id: 'demo', label: 'Demo', order: 1 }] });
  write('bookmarks/demo.json', {
    category: 'demo',
    bookmarks: [{ title: 'Docs', url: 'https://example.invalid/docs', tags: ['a', 'b'] }],
  });
  write('bookmarks/libre.json', { bookmarks: [{ title: 'Libre', url: 'https://example.invalid/libre', tags: ['b'] }] });
  write('tools/outil.json', {
    id: 'outil', bookmarks: [
      { title: 'Doublon', url: 'https://example.invalid/docs' },
      { title: 'Outil', url: 'https://example.invalid/outil', tags: ['c'] },
    ],
  });
  write('games/jeu/game.json', { id: 'jeu', bookmarks: [{ title: 'Jeu', url: 'https://example.invalid/jeu', category: 'demo' }] });
  write('parcours/epics/pub/epic.json', { id: 'pub', bookmarks: [{ title: 'Pub', url: 'https://example.invalid/pub' }] });
  write('parcours/epics/brouillon/epic.json', { id: 'brouillon', draft: true, bookmarks: [{ title: 'No', url: 'https://example.invalid/no' }] });
  write('metadata/bookmarks-og.json', { version: 1, entries: { 'https://example.invalid/docs': { ogDescription: 'Snapshot' } } });
}

describe('bookmarks : rapport et mode d’échec', () => {
  test('fusionne sources, déduplique, trie catégories et tags, rapporte les métadonnées absentes en exit 0', () => {
    bookmarkFixture();
    const result = run('bookmarks');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe([
      'Build Bookmarks', '===============', '',
      'Config chargée: <ROOT>/bookmarks/index.json', '',
      'Scan des bookmarks standalone...', '  2 bookmarks trouvés', '',
      'Scan des manifests (tools, games, parcours)...', '  4 bookmarks trouvés', '',
      'Déduplication...', '  1 doublons supprimés', '',
      'Métadonnées OG : snapshot éditorial, sans accès réseau.', '',
      'Construction du catalogue...', '',
      '--- Rapport ---', 'Catégories: 3', 'Bookmarks total: 5', 'Tags uniques: 3',
      'Métadonnées OG: 0 fetchées, 0 en cache, 0 échouées', '',
      'Warnings (4):',
      ...['jeu', 'libre', 'outil', 'pub'].map(name => `  ⚠️  Métadonnées OG absentes du snapshot : https://example.invalid/${name}`),
      '', 'Catalogue généré: <ROOT>/data/bookmarks.json', '', '✅ Build terminé avec succès', '',
    ].join('\n'));
    const catalogue = JSON.parse(read('data/bookmarks.json'));
    expect(catalogue.categories.map(category => [category.id, category.bookmarks.map(bookmark => bookmark.title)])).toEqual([
      ['demo', ['Docs', 'Jeu']],
      ['libre', ['Libre']],
      ['modules', ['Outil', 'Pub']],
    ]);
    expect(catalogue.tags).toEqual([{ id: 'b', count: 2 }, { id: 'a', count: 1 }, { id: 'c', count: 1 }]);
  });

  test('--skip-og conserve le même rapport sans ligne de snapshot', () => {
    bookmarkFixture();
    const result = run('bookmarks', ['--skip-og']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('\nEnrichissement Open Graph ignoré (--skip-og).\n');
    expect(result.stdout).not.toContain('Warnings');
  });

  test('bloque avec le rapport coloré historique et conserve le catalogue précédent', () => {
    write('bookmarks/index.json', { categories: [] });
    write('bookmarks/demo.json', { bookmarks: [
      { title: 'Sans url' }, { url: 'https://example.invalid/t' }, { title: 'Mauvaise', url: 'pas une url' },
    ] });
    const result = run('bookmarks', ['--skip-og']);
    expect(result.status).toBe(1);
    expect(result.stdout.slice(result.stdout.indexOf('\n--- Rapport ---'))).toBe([
      '', '--- Rapport ---', '', 'Erreurs (3):',
      '  \x1b[31m❌ Bookmark sans URL (standalone:demo.json)\x1b[0m',
      '  \x1b[31m❌ Bookmark sans titre: https://example.invalid/t (standalone:demo.json)\x1b[0m',
      '  \x1b[31m❌ URL invalide: pas une url (standalone:demo.json)\x1b[0m', '',
    ].join('\n'));
    expect(read('data/bookmarks.json')).toBe(previous);
    expect(existsSync(join(root, 'metadata/bookmarks-og.json'))).toBe(false);
  });

  test('un dossier bookmarks/ absent cumule avertissement et erreur de configuration', () => {
    write('metadata/bookmarks-og.json', { version: 1, entries: {} });
    const result = run('bookmarks', ['--skip-og']);
    // Sans index.json, la lecture de configuration échoue : le rapport cumule avertissement et erreur.
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Warnings (1):');
    expect(result.stdout).toContain('Dossier bookmarks/ non trouvé');
    expect(result.stdout).toContain('Erreurs (1):');
    expect(result.stdout).toContain('bookmarks/index.json');
  });
});

function typescriptFixture() {
  write('lib/util.ts', 'export const util: number = 1;');
  write('lib/util.d.ts', 'export declare const util: number;');
  write('lib/util.test.ts', 'export const t: number = 1;');
  write('lib/__tests__/skip.ts', 'export const skip: number = 1;');
  write('lib/node_modules/pkg/skip.ts', 'export const skip: number = 1;');
  write('lib/dist/skip.ts', 'export const skip: number = 1;');
  write('lib/.cache/skip.ts', 'export const skip: number = 1;');
  write('tools/demo/src/main.ts', 'export const main: number = 2;');
  write('games/demo/engine.ts', 'export const engine: number = 3;');
  write('parcours/epic/script.ts', 'export const script: number = 4;');
  write('app/ignore.ts', 'export const ignored: number = 5;');
}

describe('typescript : sortie publique et mode d’échec', () => {
  test('transpile les quatre racines vers les mêmes chemins et résume le build', () => {
    typescriptFixture();
    const result = run('typescript', ['--verbose']);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(sortedLines(result.stdout)).toEqual(sortedLines([
      '', '\x1b[36mBuilding TypeScript files...\x1b[0m', '', '  Fichiers trouvés: 4',
      '\x1b[32m  ✓\x1b[0m lib/util.ts → lib/dist/util.js',
      '\x1b[32m  ✓\x1b[0m tools/demo/src/main.ts → tools/demo/dist/main.js',
      '\x1b[32m  ✓\x1b[0m games/demo/engine.ts → games/demo/dist/engine.js',
      '\x1b[32m  ✓\x1b[0m parcours/epic/script.ts → parcours/epic/dist/script.js',
      '', '\x1b[32m✓ 4 fichier(s) transpilé(s)\x1b[0m', '', '',
    ].join('\n')));
    for (const output of ['lib/dist/util.js', 'tools/demo/dist/main.js', 'games/demo/dist/engine.js', 'parcours/epic/dist/script.js']) {
      expect(existsSync(join(root, output))).toBe(true);
      expect(existsSync(join(root, `${output}.map`))).toBe(true);
    }
    expect(existsSync(join(root, 'app/dist/ignore.js'))).toBe(false);
    expect(existsSync(join(root, 'lib/dist/skip.js'))).toBe(false);
  });

  test('sans source TypeScript, termine sans erreur avec un message dédié', () => {
    const result = run('typescript');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('\x1b[33m  Aucun fichier TypeScript trouvé\x1b[0m');
  });

  test('un fichier invalide est signalé, les autres sont transpilés et le statut est 1', () => {
    write('lib/good.ts', 'export const good: number = 1;');
    write('lib/bad.ts', 'export const = ;');
    const result = run('typescript');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('\x1b[31m  ✗ lib/bad.ts\x1b[0m');
    expect(result.stdout).toContain('\x1b[31m✗ Build terminé avec 1 erreur(s)\x1b[0m');
    expect(existsSync(join(root, 'lib/dist/good.js'))).toBe(true);
  });
});
