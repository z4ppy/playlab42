/** @jest-environment jsdom */

import { existsSync, globSync, mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceIgnores } from './lint-source-policy.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = join(root, 'scripts', `.source-lint-tests-${process.pid}`);
const ownedDirectories = new Set([fixtureRoot]);
const createdParents = new Set();
const eslint = join(root, 'node_modules/eslint/bin/eslint.js');
let sequence = 0;

function lintHtml(source, { config = 'eslint.config.js', extra = [], directory = fixtureRoot } = {}) {
  ownedDirectories.add(directory);
  for (let parent = dirname(directory); !existsSync(parent); parent = dirname(parent)) {
    createdParents.add(parent);
  }
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${sequence++}.html`);
  writeFileSync(path, `${source.replaceAll('</script>', '\n</script>')}\n`);
  const result = spawnSync(process.execPath, [
    eslint, '--config', config, '--format', 'json', '--max-warnings=0', ...extra, path,
  ], { cwd: root, encoding: 'utf8', timeout: 15000 });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect([0, 1]).toContain(result.status);
  expect(result.stderr).toBe('');
  return { ...result, results: JSON.parse(result.stdout) };
}

function eventAttributes(source) {
  const template = document.createElement('template');
  template.innerHTML = source;
  const attributes = [];
  function visit(fragment) {
    for (const element of fragment.querySelectorAll('*')) {
      attributes.push(...element.getAttributeNames().filter(name => /^on[a-z]/i.test(name)));
      if (element.tagName === 'TEMPLATE') {
        visit(element.content);
      }
    }
  }
  visit(template.content);
  return attributes;
}

afterAll(() => {
  for (const directory of ownedDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  for (const directory of [...createdParents].sort((a, b) => b.length - a.length)) {
    rmdirSync(directory);
  }
});

describe('Couverture réelle du lint des scripts HTML', () => {
  test('accepter un module valide, pas une entrée ignorée', () => {
    const result = lintHtml('<script type="module">document.title = String(42);</script>');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].messages).toEqual([]);
    expect(result.status).toBe(0);
  });

  test('signaler une construction interdite avec sa position dans le HTML', () => {
    const result = lintHtml('<main>Exemple</main>\n<script type="module">eval(location.hash);</script>');
    expect(result.status).toBe(1);
    expect(result.results[0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'no-eval', severity: 2, line: 2 }),
    ]));
  });

  test('refuser une syntaxe invalide dans un module', () => {
    const result = lintHtml('<script type="module">const broken = ;</script>');
    expect(result.status).toBe(1);
    expect(result.results[0].messages.some(message => message.fatal && message.line === 1)).toBe(true);
  });

  test('respecter le scope partagé des scripts classiques lorsqu’il est configuré', () => {
    mkdirSync(fixtureRoot, { recursive: true });
    const config = join(fixtureRoot, 'classic.config.mjs');
    writeFileSync(config, `import base from '${pathToFileURL(join(root, 'eslint.config.js')).href}';
export default [...base, { files: ['**/*.html'], languageOptions: { sourceType: 'script' } }];\n`);
    const result = lintHtml(
      '<script>const shared = 42;</script>\n<script>document.title = String(shared);</script>',
      { config },
    );
    expect(result.results[0].messages).toEqual([]);
    expect(result.status).toBe(0);
  });

  test('ne pas partager le scope entre deux modules', () => {
    const result = lintHtml(
      '<script type="module">const shared = 42;</script>\n<script type="module">document.title = String(shared);</script>',
    );
    expect(result.status).toBe(1);
    expect(result.results[0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'no-undef', line: 3 }),
    ]));
  });

  test('ignorer les données JSON, importmaps et exemples textuels non exécutables', () => {
    const result = lintHtml(
      '<script type="application/ld+json">{"name": "Example"}</script>'
      + '<script type="importmap">{"imports": {"x": "./x.js"}}</script>'
      + '<pre>&lt;script&gt;eval(location.hash);&lt;/script&gt;</pre>'
      + '<script type="module">document.title = String(42);</script>',
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0].messages).toEqual([]);
    expect(result.status).toBe(0);
  });

  test('appliquer aussi le gate sécurité aux méthodes DOM embarquées', () => {
    const result = lintHtml(
      '<script type="module">document.body.insertAdjacentHTML("beforeend", location.hash);</script>',
      { config: 'eslint.security.config.js' },
    );
    expect(result.status).toBe(1);
    expect(result.results[0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'no-unsanitized/method', severity: 2, line: 1 }),
    ]));
  });

  test.each(['site', 'vendor', 'test-results', 'playwright-report', `tools/.source-lint-tests-${process.pid}/dist`])('exclure la sortie ou le vendor %s', parent => {
    const directory = join(root, parent, `.source-lint-tests-${process.pid}`);
    const result = lintHtml('<script>eval(location.hash);</script>', {
      directory, extra: ['--no-warn-ignored'],
    });
    expect(result.status).toBe(0);
    expect(result.results).toEqual([]);
  });

  test('détecter les attributs inline, y compris dans les templates imbriqués', () => {
    expect(eventAttributes('<template><button onclick="eval(location.hash)">Action</button></template>'))
      .toEqual(['onclick']);
    expect(eventAttributes('<pre>&lt;button onclick="example()"&gt;</pre>')).toEqual([]);
  });

  test('ne conserver aucun attribut événementiel non couvert dans les HTML source', () => {
    const paths = globSync('**/*.html', {
      cwd: root,
      exclude: [...sourceIgnores, `${relative(root, fixtureRoot)}/**`],
    });
    expect(paths).toContain('index.html');
    expect(paths.length).toBeGreaterThan(0);
    const violations = paths.flatMap(path => eventAttributes(readFileSync(join(root, path), 'utf8'))
      .map(attribute => `${path}: ${attribute}`));
    expect(violations).toEqual([]);
  });
});
