import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyChanges, fingerprint, readTree, planCi, controls } from './ci-plan.js';

const runner = { node: '26.10.0', image: 'ubuntu24-20261001', arch: 'x64' };
const modes = plan => Object.fromEntries(Object.entries(plan.controls).map(([id, control]) => [id, control.mode]));

describe('Selection conservative des controles', () => {
  test.each(['README.md', 'AGENTS.md', 'docs/guides/software-quality.md', 'openspec/changes/example/tasks.md'])(
    'un Markdown documentaire %s conserve les contrats et le navigateur documentaire', path => {
      const plan = classifyChanges([path]);
      expect(modes(plan)).toMatchObject({
        lint: 'not-applicable', 'security-lint': 'not-applicable', 'code-quality': 'not-applicable',
        typecheck: 'not-applicable', test: 'documentation', browser: 'documentation',
      });
      expect(plan.controls.openspec.mode).toBe(path.startsWith('openspec/') ? 'execute' : 'not-applicable');
    },
  );

  test.each(['docs/example.html', 'parcours/epics/example/slides/one/index.html'])(
    '%s reste executable, pas docs-only', path => {
      expect(modes(classifyChanges([path]))).toMatchObject({
        lint: 'execute', 'security-lint': 'execute', 'code-quality': 'execute',
        test: 'execute', browser: 'execute',
      });
    },
  );

  test.each(['package-lock.json', '.github/workflows/ci.yml', 'lib/theme.js', 'scripts/build-site.js', 'surprise.xyz'])(
    '%s impose tous les controles et interdit la reutilisation', path => {
      const plan = classifyChanges([path]);
      expect(plan.full).toBe(true);
      expect(Object.values(modes(plan))).toEqual(controls.map(() => 'execute'));
    },
  );

  test('un CSS local garde qualite, tests et navigateur, mais pas les types ou ESLint', () => {
    expect(modes(classifyChanges(['games/example/style.css']))).toMatchObject({
      lint: 'not-applicable', 'security-lint': 'not-applicable', typecheck: 'not-applicable',
      'code-quality': 'execute', test: 'execute', browser: 'execute',
    });
  });

  test('une PR mixte ne prend pas le parcours documentaire', () => {
    expect(modes(classifyChanges(['docs/example.md', 'games/example/engine.js'])))
      .toMatchObject({ test: 'execute', lint: 'execute', typecheck: 'execute', browser: 'execute' });
  });

  test.each([[], ['../outside.md'], ['docs/a.md\nnot-a-path']].map(paths => [paths]))('un classement ambigu est complet : %j', paths => {
    expect(classifyChanges(paths).full).toBe(true);
  });

  test.each(['push', 'workflow_dispatch', 'workflow_call'])('%s ne selectionne pas de controles', eventName => {
    expect(planCi({ eventName, event: {}, root: '/absent', commit: 'a'.repeat(40), runner }).full).toBe(true);
  });

  test('un diff indisponible est signale et ne produit pas de parcours leger', () => {
    const warnings = [];
    const plan = planCi({
      eventName: 'pull_request', event: { pull_request: { base: { sha: 'b'.repeat(40) } } },
      root: '/absent', commit: 'a'.repeat(40), runner, warn: message => warnings.push(message),
    });
    expect(plan.full).toBe(true);
    expect(warnings.join('\n')).toMatch(/diff/i);
  });
});

describe('Empreintes des vraies entrees Git', () => {
  const tree = [
    { path: 'games/example/engine.js', mode: '100644', oid: '1'.repeat(40) },
    { path: 'docs/guide.md', mode: '100644', oid: '2'.repeat(40) },
    { path: '.github/workflows/ci.yml', mode: '100644', oid: '3'.repeat(40) },
  ];
  const digest = (id, files = tree, environment = runner) => fingerprint(id, files, environment);

  test('un Markdown modifie invalide Jest, mais pas les controles statiques ou applicatifs', () => {
    const changed = tree.map(file => file.path.endsWith('.md') ? { ...file, oid: '4'.repeat(40) } : file);
    expect(digest('test', changed)).not.toBe(digest('test'));
    for (const id of ['lint', 'security-lint', 'typecheck', 'code-quality', 'browser']) {
      expect(digest(id, changed)).toBe(digest(id));
    }
  });

  test.each(['lint', 'security-lint', 'typecheck', 'test', 'code-quality', 'browser', 'openspec'])(
    'le workflow et le runner font partie de %s', id => {
      expect(digest(id, tree.map(file => file.path.endsWith('.yml') ? { ...file, oid: '4'.repeat(40) } : file)))
        .not.toBe(digest(id));
      expect(digest(id, tree, { ...runner, node: '26.11.0' })).not.toBe(digest(id));
      expect(digest(id, tree, { ...runner, image: 'new-image' })).not.toBe(digest(id));
    },
  );

  test('les suppressions, ajouts, chemins et modes changent une empreinte', () => {
    expect(digest('lint', tree.slice(1))).not.toBe(digest('lint'));
    expect(digest('lint', [...tree, { ...tree[0], path: 'games/other/engine.js' }])).not.toBe(digest('lint'));
    expect(digest('lint', tree.map(file => ({ ...file, mode: '100755' })))).not.toBe(digest('lint'));
    expect(digest('lint', [...tree].reverse())).toBe(digest('lint'));
  });

  test('un Markdown avec HTML reste une entree applicative, meme apres modification de la base', () => {
    const changed = tree.map(file => file.path.endsWith('.md') ? { ...file, activeMarkdown: true } : file);
    expect(digest('browser', changed)).not.toBe(digest('browser'));
  });

  test('le vrai diff traite les deux cotes du renommage et les modifications de base', () => {
    const root = mkdtempSync(join(tmpdir(), 'playlab-ci-plan-'));
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const commit = () => { git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
    try {
      git('init', '-q');
      mkdirSync(join(root, 'docs'));
      writeFileSync(join(root, 'docs/guide.md'), 'guide');
      const base = commit();
      mkdirSync(join(root, 'games'));
      git('mv', 'docs/guide.md', 'games/new.html');
      const head = commit();
      const plan = planCi({ eventName: 'pull_request', event: { pull_request: { base: { sha: base } } }, root, commit: head, runner });
      expect(plan.paths).toEqual(['docs/guide.md', 'games/new.html']);
      expect(plan.controls.browser.mode).toBe('execute');
      expect(readTree(root, head).map(file => file.path)).toEqual(['games/new.html']);
      expect(plan.controls.browser.fingerprint).toBe(fingerprint('browser', readTree(root, head), runner));
      writeFileSync(join(root, 'docs/guide.md'), '<script>document.title = "example";</script>');
      const active = commit();
      const activePlan = planCi({ eventName: 'pull_request', event: { pull_request: { base: { sha: head } } }, root, commit: active, runner });
      expect(activePlan.full).toBe(true);
      expect(activePlan.reuseAllowed).toBe(false);
      writeFileSync(join(root, 'docs/guide.md'), 'Documentation passive');
      const passive = commit();
      const removal = planCi({ eventName: 'pull_request', event: { pull_request: { base: { sha: active } } }, root, commit: passive, runner });
      expect(removal.full).toBe(true);
      expect(removal.controls.browser.mode).toBe('execute');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
