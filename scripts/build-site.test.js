import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, isPublicSitePath } from './build-site.js';

describe('Packaging du site public', () => {
  let root;
  const put = (path, content = 'public') => {
    const parts = path.split('/');
    mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'playlab-site-'));
    put('package.json', '{"version":"0.2.0"}');
    for (const name of ['index.html', 'app.js', 'style.css', 'README.md', 'AGENTS.md', 'LICENSE']) {put(name);}
    for (const name of ['app', 'assets', 'lib', 'tools', 'games', 'parcours', 'data', 'docs', 'bookmarks', 'openspec']) {
      put(`${name}/example.txt`);
    }
    for (const name of ['catalogue', 'parcours', 'bookmarks']) {put(`data/${name}.json`, '{}');}
    put('docs/site/index.html', '<html>Guides</html>');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('publier les bundles et sources documentaires, jamais les dépendances ou tests', () => {
    for (const name of [
      'node_modules/pkg/index.js', '.github/workflows/ci.yml', '.claude/skills/link',
      'lib/a.test.js', 'tools/x/__tests__/a.js', 'tools/__mocks__/fake.js',
      'data/bookmarks-cache.json', 'docs/.secret', 'scripts/ci.js',
    ]) {put(name);}
    put('assets/vendor/tone.js');
    put('tools/x/dist/main.js');
    const commit = 'a'.repeat(40);
    const output = buildSite({ root, commit });
    expect(JSON.parse(readFileSync(join(output, 'build-info.json'), 'utf8'))).toEqual({ version: '0.2.0', commit });
    for (const name of ['assets/vendor/tone.js', 'tools/x/dist/main.js', 'docs/site/index.html', 'AGENTS.md']) {
      expect(existsSync(join(output, name))).toBe(true);
    }
    for (const name of ['node_modules', '.github', '.claude', 'scripts', 'lib/a.test.js', 'data/bookmarks-cache.json']) {
      expect(existsSync(join(output, name))).toBe(false);
    }
  });

  test('supprimer une sortie obsolète seulement dans un site déjà généré', () => {
    const output = buildSite({ root, commit: null });
    writeFileSync(join(output, 'obsolete.html'), 'obsolete');
    buildSite({ root, commit: null });
    expect(existsSync(join(output, 'obsolete.html'))).toBe(false);
    expect(existsSync(join(root, 'index.html'))).toBe(true);
  });

  test('refuser un dossier site étranger ou un lien symbolique', () => {
    put('site/manual.txt', 'ne pas supprimer');
    expect(() => buildSite({ root })).toThrow('Refus de remplacer');
    expect(readFileSync(join(root, 'site/manual.txt'), 'utf8')).toBe('ne pas supprimer');
    rmSync(join(root, 'site'), { recursive: true });
    symlinkSync(join(root, 'docs'), join(root, 'site'));
    expect(() => buildSite({ root })).toThrow('Refus de remplacer');
    expect(existsSync(join(root, 'docs/site/index.html'))).toBe(true);
  });

  test('refuser de publier un lien vers des fichiers hors du projet', () => {
    symlinkSync(join(root, 'package.json'), join(root, 'assets/link.json'));
    expect(() => buildSite({ root })).toThrow('Lien symbolique non publiable');
  });

  test('échouer si un build préalable manque ou si le SHA est invalide', () => {
    expect(() => buildSite({ root, commit: 'main' })).toThrow('SHA Git complet');
    rmSync(join(root, 'data/parcours.json'));
    expect(() => buildSite({ root, commit: null })).toThrow('Build préalable incomplet');
  });

  test('partager la politique de publication avec le lecteur documentaire', () => {
    expect(isPublicSitePath('docs/site/guides/architecture.html')).toBe(true);
    expect(isPublicSitePath('lib/types/game-engine.ts')).toBe(true);
    for (const name of ['../etc/passwd', 'Makefile', '.github/skills/a.md', 'app/a.test.js']) {
      expect(isPublicSitePath(name)).toBe(false);
    }
  });
});
