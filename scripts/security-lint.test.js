import { ESLint } from 'eslint';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const gate = new ESLint({
  cwd: root,
  overrideConfigFile: resolve(root, 'eslint.security.config.js'),
});
const advisory = new ESLint({
  cwd: root,
  overrideConfigFile: resolve(root, 'scripts/security-lint-advisory.config.js'),
});

describe('gate de sécurité JavaScript', () => {
  it.each([
    ['no-eval', 'eval(input);'],
    ['no-implied-eval', 'setTimeout("run()", 10);'],
    ['no-new-func', 'new Function(input);'],
    ['no-script-url', 'const url = "javascript:alert(1)";'],
    ['security/detect-buffer-noassert', 'buffer.readUInt8(0, true);'],
    ['security/detect-new-buffer', 'new Buffer(size);'],
    ['security/detect-disable-mustache-escape', 'template.escapeMarkup = false;'],
    ['security/detect-bidi-characters', '// \u202e masquer le code\nconst value = 1;'],
    ['no-unsanitized/method', 'element.insertAdjacentHTML("beforeend", input);'],
    ['no-unsanitized/method', 'document.write(input);'],
  ])('bloque une sonde réelle pour %s', async (ruleId, source) => {
    const [result] = await gate.lintText(source, { filePath: 'app/security-probe.js' });
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId, severity: 2 }),
    ]));
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it('accepte du texte DOM et du HTML littéral sans exécution dynamique', async () => {
    const [result] = await gate.lintText(`
      element.textContent = input;
      element.insertAdjacentHTML('beforeend', '<strong>Texte fixe</strong>');
      setTimeout(() => run(), 10);
      const buffer = Buffer.alloc(size);
      buffer.readUInt8(0);
    `, { filePath: 'app/security-probe.js' });
    expect(result.messages).toEqual([]);
    expect(result.errorCount).toBe(0);
  });

  it('publie séparément les diagnostics heuristiques sans en faire des exceptions', async () => {
    const source = 'element.innerHTML = input; const value = object[key];';
    const [result] = await advisory.lintText(source, { filePath: 'app/security-probe.js' });
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: 'no-unsanitized/property', severity: 1 }),
      expect.objectContaining({ ruleId: 'security/detect-object-injection', severity: 1 }),
    ]));
    expect(result.errorCount).toBe(0);
  });

  it('garde les erreurs bloquantes dans le diagnostic advisory', async () => {
    const [result] = await advisory.lintText('document.write(input);', {
      filePath: 'app/security-probe.js',
    });
    expect(result.errorCount).toBe(1);
  });

  it('exclut les dépendances et sorties générées, pas les tests JavaScript', async () => {
    expect(await gate.isPathIgnored('games/example/dist/engine.js')).toBe(true);
    expect(await gate.isPathIgnored('assets/vendor/example.js')).toBe(true);
    expect(await gate.isPathIgnored('app/example.test.js')).toBe(false);
    expect(await gate.isPathIgnored('tools/example/src/main.ts')).toBe(true);
  });

  it.each([
    ['unsafe', 'document.write(input);', 1],
    ['safe', 'element.textContent = input;', 0],
  ])('renvoie le bon statut npm et un rapport JSON pour la sonde %s', (label, source, status) => {
    const report = resolve(root, `node_modules/security-lint-${label}-results.json`);
    try {
      const result = spawnSync('npm', [
        '--silent', 'run', 'lint:security', '--',
        '--stdin', '--stdin-filename', 'app/security-probe.js',
        '--format', 'json', '--output-file', report,
      ], { cwd: root, input: source, encoding: 'utf8', timeout: 30000 });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(status);
      const diagnostics = JSON.parse(readFileSync(report, 'utf8'));
      expect(diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ filePath: resolve(root, 'app/security-probe.js') }),
      ]));
      const probe = diagnostics.find(item => item.filePath.endsWith('/security-probe.js'));
      expect(probe.errorCount).toBe(status);
      if (status) {
        expect(probe.messages[0].ruleId).toBe('no-unsanitized/method');
      }
    } finally {
      rmSync(report, { force: true });
    }
  }, 40000);
});
