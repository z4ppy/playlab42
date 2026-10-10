import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const yamlRequire = createRequire(require.resolve('js-yaml'));
const serveRequire = createRequire(require.resolve('serve/package.json'));

describe('security overrides for development dependencies', () => {
  it('installs patched compression for the actual serve consumer', () => {
    expect(serveRequire('compression/package.json').version).toBe('1.8.2');
    expect(typeof serveRequire('compression')).toBe('function');
  });

  it('removes sprintf-js without replacing the js-yaml 3 API', () => {
    expect(require('js-yaml/package.json').version).toMatch(/^3\./);
    expect(yamlRequire('argparse/package.json').version).toBe('2.0.1');
    expect(require('js-yaml').safeLoad('enabled: true\n')).toEqual({ enabled: true });

    const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
    for (const [path, entry] of Object.entries(lock.packages)) {
      expect(path).not.toMatch(/(?:^|\/)node_modules\/sprintf-js$/);
      expect(entry.dependencies ?? {}).not.toHaveProperty('sprintf-js');
    }
  });

  it('preserves Istanbul YAML configuration loading', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'playlab42-nyc-'));
    try {
      writeFileSync(join(directory, '.nycrc.yml'), 'all: true\ninclude:\n  - lib/**/*.js\n');
      const { loadNycConfig } = require('@istanbuljs/load-nyc-config');
      const config = await loadNycConfig({ cwd: directory });
      expect(config.all).toBe(true);
      expect(config.include).toEqual(['lib/**/*.js']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('preserves the js-yaml CLI legacy argparse aliases', () => {
    const cli = yamlRequire.resolve('./bin/js-yaml.js');
    const run = (args, input) => execFileSync(process.execPath, [cli, ...args], {
      input,
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(run(['--help'])).toContain('--compact');
    expect(run(['--version']).trim()).toBe(require('js-yaml/package.json').version);
    expect(JSON.parse(run(['--compact', '--to-json'], 'enabled: true\n'))).toEqual({ enabled: true });
    expect(require('js-yaml').safeLoad(run([], '{"enabled":true}'))).toEqual({ enabled: true });
  });
});
