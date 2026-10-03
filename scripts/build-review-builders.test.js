import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { getRootDir } from './lib/build-utils.js';

const previousCatalogue = '{"previous":true}\n';
const marker = '<!-- playlab42:generated-from-index.md -->\n';
const template = '<!doctype html><title>{{TITLE}}</title><main>{{CONTENT}}</main>';
let root;

function write(relativePath, content) {
  const path = join(root, relativePath);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function run(builder) {
  const result = spawnSync(process.execPath, [`scripts/build-${builder}.js`], {
    cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SOURCE_DATE_EPOCH: '1700000000' },
  });
  expect(result.error).toBeUndefined();
  return { status: result.status, output: result.stdout + result.stderr };
}

function expectFailure(builder, diagnostic) {
  const result = run(builder);
  expect(result.status).toBe(1);
  expect(result.output).toContain(diagnostic);
  expect(result.output).not.toMatch(/terminé avec succès|Catalogue généré|Catalogue written/);
  expect(read(`data/${builder}.json`)).toBe(previousCatalogue);
}

function createSlide(content = '# Alpha') {
  write('parcours/index.json', {});
  write('parcours/_shared/slide-template.html', template);
  write('parcours/epics/example/epic.json', {
    id: 'example', title: 'Example', description: 'Parcours de test',
    hierarchy: ['tests'], tags: [], metadata: { author: 'Test', created: '2026-10-03' },
    content: [{ id: 'intro' }],
  });
  write('parcours/epics/example/slides/intro/slide.json', { id: 'intro', title: 'Premier titre' });
  write('parcours/epics/example/slides/intro/index.md', content);
}

const slidePath = 'parcours/epics/example/slides/intro';
const tool = { id: 'missing', name: 'Missing', description: 'Test', tags: [] };

beforeEach(() => {
  root = mkdtempSync(join(getRootDir(import.meta.url), '.builders-review-'));
  mkdirSync(join(root, 'scripts'));
  for (const source of ['build-catalogue.js', 'build-parcours.js', 'parcours-utils.js']) {
    cpSync(fileURLToPath(new URL(source, import.meta.url)), join(root, 'scripts', source));
  }
  cpSync(fileURLToPath(new URL('lib', import.meta.url)), join(root, 'scripts', 'lib'), { recursive: true });
  symlinkSync(join(getRootDir(import.meta.url), 'node_modules'), join(root, 'node_modules'));
  write('package.json', { type: 'module' });
  write('data/catalogue.json', previousCatalogue);
  write('data/parcours.json', previousCatalogue);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('catalogue : points d’entrée manquants', () => {
  test.each([
    ['tools/missing.json', tool, 'missing.html'],
    ['tools/missing/tool.json', tool, 'index.html'],
    ['games/missing/game.json', { ...tool, players: { min: 1, max: 1 }, type: 'turn-based' }, 'index.html'],
  ])('%s bloque même en présence d’un autre outil valide', (manifest, data, diagnostic) => {
    write('tools/valid.json', { ...tool, id: 'valid', name: 'Valid' });
    write('tools/valid.html', '<!doctype html><title>Valid</title>');
    write(manifest, data);
    expectFailure('catalogue', diagnostic);
    rmSync(join(root, manifest));
    expect(run('catalogue').status).toBe(0);
    expect(JSON.parse(read('data/catalogue.json')).tools.map(entry => entry.id)).toEqual(['valid']);
  });
});

describe('parcours : contrat explicite des sources Markdown', () => {
  test('reconstruit après seconde exécution, modification Markdown, titre et template', () => {
    createSlide();
    expect(run('parcours').status).toBe(0);
    const firstHtml = read(`${slidePath}/index.html`);
    const firstCatalogue = read('data/parcours.json');
    expect(firstHtml.startsWith(marker)).toBe(true);
    expect(firstHtml).toContain('<h1>Alpha</h1>');
    expect(run('parcours').status).toBe(0);
    expect(read(`${slidePath}/index.html`)).toBe(firstHtml);
    expect(read('data/parcours.json')).toBe(firstCatalogue);

    write(`${slidePath}/index.md`, '# Beta');
    expect(run('parcours').status).toBe(0);
    expect(read(`${slidePath}/index.html`)).toContain('<h1>Beta</h1>');
    expect(read(`${slidePath}/index.html`)).not.toContain('Alpha');

    write(`${slidePath}/slide.json`, { id: 'intro', title: 'Nouveau titre' });
    write('parcours/_shared/slide-template.html', template.replace('<main>', '<main class="nouveau">'));
    expect(run('parcours').status).toBe(0);
    expect(read(`${slidePath}/index.html`)).toContain('<title>Nouveau titre</title>');
    expect(read(`${slidePath}/index.html`)).toContain('<main class="nouveau"><h1>Beta</h1>');
    expect(JSON.parse(read('data/parcours.json')).epics[0].structure[0].title).toBe('Nouveau titre');
  });

  test('reconnaît la sortie passée en CRLF et reconstruit le Markdown actuel avec un marqueur LF', () => {
    createSlide();
    expect(run('parcours').status).toBe(0);
    write(`${slidePath}/index.html`, read(`${slidePath}/index.html`).replaceAll('\n', '\r\n'));
    expect(read(`${slidePath}/index.html`).startsWith(marker.replace('\n', '\r\n'))).toBe(true);
    write(`${slidePath}/index.md`, '# Beta');
    expect(run('parcours').status).toBe(0);
    const html = read(`${slidePath}/index.html`);
    expect(html.startsWith(marker)).toBe(true);
    expect(html).toContain('<h1>Beta</h1>');
    expect(html).not.toContain('Alpha');
    expect(html).not.toContain('\r');
  });

  test.each([
    ['HTML auteur', '<!doctype html><title>Auteur</title><p>Contenu manuel</p>'],
    ['sortie legacy', template.replace('{{TITLE}}', 'Ancien').replace('{{CONTENT}}', '<h1>Alpha</h1>')],
    ['commentaire similaire', `${marker.replace('index.md', 'indexXmd')}<p>Auteur</p>`],
    ['commentaire avec espace ajouté', `${marker.replace(' -->', '  -->')}<p>Auteur</p>`],
    ['marqueur pas en première ligne', `<!doctype html>\n${marker}<p>Auteur</p>`],
    ['marqueur sans fin de ligne', marker.trimEnd()],
    ['marqueur avec CR seul', `${marker.replace('\n', '\r')}<p>Auteur</p>`],
  ])('refuse une paire ambiguë (%s), préserve le HTML et permet une migration explicite', (_kind, html) => {
    createSlide();
    write(`${slidePath}/index.html`, html);
    expectFailure('parcours', 'Sources ambiguës');
    expect(read(`${slidePath}/index.html`)).toBe(html);
    rmSync(join(root, slidePath, 'index.html'));
    expect(run('parcours').status).toBe(0);
    expect(read(`${slidePath}/index.html`).startsWith(marker)).toBe(true);
  });

  test('préserve le HTML seul même sans template', () => {
    createSlide();
    rmSync(join(root, slidePath, 'index.md'));
    rmSync(join(root, 'parcours/_shared/slide-template.html'));
    const authoredHtml = '<!doctype html><title>Auteur</title>';
    write(`${slidePath}/index.html`, authoredHtml);
    expect(run('parcours').status).toBe(0);
    expect(run('parcours').status).toBe(0);
    expect(read(`${slidePath}/index.html`)).toBe(authoredHtml);
  });

  test.each([false, true])('un template absent bloque (HTML déjà généré : %s)', (generated) => {
    createSlide();
    if (generated) {
      expect(run('parcours').status).toBe(0);
    }
    write('data/parcours.json', previousCatalogue);
    rmSync(join(root, 'parcours/_shared/slide-template.html'));
    expectFailure('parcours', 'Template Markdown manquant');
    if (generated) {
      expect(read(`${slidePath}/index.html`)).toContain('<h1>Alpha</h1>');
    } else {
      expect(existsSync(join(root, slidePath, 'index.html'))).toBe(false);
    }
  });

  test.each([
    ['source supprimée', 'index.md', null, 'Source index.md manquante'],
    ['métadonnées invalides', 'slide.json', '{', 'slide.json invalide'],
    ['métadonnées absentes', 'slide.json', null, 'slide.json manquant'],
    ['conversion impossible', 'index.md', null, 'Échec conversion Markdown'],
  ])('préserve le catalogue et l’ancienne sortie en cas de %s', (kind, file, content, diagnostic) => {
    createSlide();
    expect(run('parcours').status).toBe(0);
    const html = read(`${slidePath}/index.html`);
    write('data/parcours.json', previousCatalogue);
    rmSync(join(root, slidePath, file));
    if (content !== null) {
      write(`${slidePath}/${file}`, content);
    } else if (kind === 'conversion impossible') {
      mkdirSync(join(root, slidePath, file));
    }
    expectFailure('parcours', diagnostic);
    expect(read(`${slidePath}/index.html`)).toBe(html);
  });

  test('refuse une slide sans aucun contenu', () => {
    createSlide();
    rmSync(join(root, slidePath, 'index.md'));
    expectFailure('parcours', 'Contenu manquant');
  });
});
