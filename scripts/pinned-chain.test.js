import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(join(root, path), 'utf8');
const workflows = Object.fromEntries(readdirSync(join(root, '.github/workflows'))
  .filter(name => name.endsWith('.yml'))
  .map(name => [name, parse(read(`.github/workflows/${name}`))]));
const ci = workflows['ci.yml'];
const audit = workflows['security-audit.yml'];
const deploy = workflows['deploy.yml'];
const trivyScan = workflows['trivy-scan.yml'].jobs.scan;
const fixtureRoot = join(root, `.pinned-chain-tests-${process.pid}`);
let sequence = 0;

const checksums = {
  gitleaks: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
  trivy: 'c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f',
};

function fixture() {
  const directory = join(fixtureRoot, String(sequence++));
  mkdirSync(join(directory, 'bin'), { recursive: true });
  const log = join(directory, 'events');
  const pathFile = join(directory, 'github-path');
  writeFileSync(log, '');
  writeFileSync(pathFile, '');
  return {
    directory, log, pathFile,
    env: {
      ...process.env,
      PATH: `${join(directory, 'bin')}:${process.env.PATH}`,
      RUNNER_TEMP: directory,
      GITHUB_PATH: pathFile,
      FIXTURE_LOG: log,
    },
  };
}

function executable(directory, name, body) {
  const path = join(directory, 'bin', name);
  writeFileSync(path, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`, { mode: 0o755 });
  return path;
}

function installerFixture(scanner, { realChecksum = false, downloadExit = 0 } = {}) {
  const state = fixture();
  state.env.EXPECTED_CHECKSUM = checksums[scanner];
  executable(state.directory, 'curl', `
printf 'download\\n' >> "$FIXTURE_LOG"
exit_code=${downloadExit}
if [ "$exit_code" != 0 ]; then exit "$exit_code"; fi
while [ "$#" -gt 0 ]; do
  if [ "$1" = --output ]; then printf 'corrupt archive\\n' > "$2"; break; fi
  shift
done`);
  if (!realChecksum) {
    executable(state.directory, 'sha256sum', `
read -r checksum archive
test "$checksum" = "$EXPECTED_CHECKSUM"
test -f "$archive"
test "$*" = "-c"
printf 'checksum\\n' >> "$FIXTURE_LOG"`);
  }
  executable(state.directory, 'tar', `
test "$1" = -xzf
test "$3" = -C
printf 'extract\\n' >> "$FIXTURE_LOG"
printf '#!/usr/bin/env bash\\nprintf "version\\\\n" >> "$FIXTURE_LOG"\\n' > "$4/$5"
chmod +x "$4/$5"`);
  return state;
}

function install(scanner, state) {
  return spawnSync('bash', [join(root, 'scripts/install-security-scanner.sh'), scanner], {
    cwd: state.directory, env: state.env, encoding: 'utf8',
  });
}

afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

describe('Chaîne épinglée et reproductibilité bornée', () => {
  test('toutes les actions externes ont un SHA complet et un commentaire de version', () => {
    for (const [name, workflow] of Object.entries(workflows)) {
      const references = Object.values(workflow.jobs)
        .flatMap(job => [job.uses, ...(job.steps ?? []).map(step => step.uses)])
        .filter(Boolean);
      for (const reference of references) {
        if (reference.startsWith('./')) {
          expect(existsSync(join(root, reference))).toBe(true);
        } else {
          expect(reference).toMatch(/^[\w./-]+@[a-f0-9]{40}$/);
          expect(read(`.github/workflows/${name}`))
            .toMatch(new RegExp(`${reference.replaceAll('.', '\\.')} # v\\d+(?:\\.\\d+)*\\b`));
        }
      }
    }
    const browserUpload = workflows['ui-e2e.yml'].jobs.browser.steps
      .find(step => step.with?.name === 'ui-e2e-failure');
    expect(browserUpload.uses).toMatch(/^actions\/upload-artifact@[a-f0-9]{40}$/);
    expect(browserUpload.if).toBe('failure()');
    expect(browserUpload.with).toEqual({
      name: 'ui-e2e-failure',
      path: 'playwright-report/\ntest-results/\n',
      'if-no-files-found': 'ignore',
      'retention-days': 14,
    });
  });

  test('les images de base portent un digest et Dependabot couvre les deux répertoires', () => {
    const from = ['Dockerfile', 'docker/e2e.Dockerfile']
      .flatMap(path => read(path).split('\n').filter(line => line.startsWith('FROM ')));
    expect(from).toHaveLength(3);
    for (const line of from) {
      expect(line).toMatch(/^FROM \S+:[\w.-]+@sha256:[a-f0-9]{64}(?: AS node)?$/);
    }
    expect(from.join('\n')).toContain('node:26-alpine@');
    expect(from.join('\n')).toContain('node:26-bookworm-slim@');
    expect(from.join('\n')).toContain('playwright:v1.63.0-noble@');
    const directories = parse(read('.github/dependabot.yml')).updates
      .filter(update => update['package-ecosystem'] === 'docker')
      .map(update => update.directory);
    expect(directories.sort()).toEqual(['/', '/docker']);
  });

  test('Security lint appartient à la CI requise sur PR et avant publication', () => {
    expect(ci.on.pull_request).toEqual({});
    expect(audit.on.pull_request).toEqual({});
    expect(ci.on).toHaveProperty('workflow_call');
    expect(ci.jobs['security-lint'].name).toBe('Security lint');
    expect(deploy.jobs.validate.uses).toBe('./.github/workflows/ci.yml');
    expect(deploy.jobs.deploy.needs).toBe('validate');
    expect(ci.jobs.browser.uses).toBe('./.github/workflows/ui-e2e.yml');
    expect(ci.jobs.browser.needs).toContain('build');
    expect(audit.jobs['npm-audit'].name).toBe('Audit dépendances npm');
    expect(audit.jobs.gitleaks.name).toBe('Détection de secrets');
  });

  test('aucune élévation globale, seules publication et rapports ont des droits dédiés', () => {
    for (const [name, workflow] of Object.entries(workflows)) {
      expect(workflow.permissions).toEqual({ contents: 'read' });
      for (const [id, job] of Object.entries(workflow.jobs)) {
        if (job.permissions) {
          expect(job.permissions.contents).toBe('read');
          if ((name === 'ci.yml' && id === 'impact') || (name === 'deploy.yml' && id === 'validate')) {
            expect(job.permissions.actions).toBe('read');
          } else {
            expect(job.permissions).not.toHaveProperty('actions');
          }
        }
      }
    }
    expect(deploy.jobs.deploy.permissions)
      .toEqual({ contents: 'read', pages: 'write', 'id-token': 'write' });
    expect(audit.jobs['docker-security'].permissions)
      .toEqual({ contents: 'read', 'security-events': 'write' });
    expect(audit.jobs['security-report'].permissions)
      .toEqual({ contents: 'read', 'pull-requests': 'write' });
  });

  test('les rapports existent même en échec et leur absence est une erreur explicite', () => {
    for (const job of [
      ci.jobs['security-lint'], audit.jobs['eslint-security'], audit.jobs['npm-audit'],
      trivyScan, audit.jobs.gitleaks,
    ]) {
      expect(job['continue-on-error']).toBeUndefined();
      const upload = job.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'));
      expect(upload.if).toBe(job === ci.jobs['security-lint']
        ? "always() && steps.decision.outputs.mode == 'execute'" : 'always()');
      expect(upload.with['if-no-files-found']).toBe('error');
      expect(job.steps.every(step => !step['continue-on-error'])).toBe(true);
    }
    expect(trivyScan.steps.filter(step => step.run?.includes('trivy fs'))).toHaveLength(1);
    const hadolint = audit.jobs['docker-security'];
    expect(hadolint.name).toContain('consultatif');
    expect(hadolint.strategy.matrix.include.map(entry => entry.dockerfile))
      .toEqual(['Dockerfile', 'docker/e2e.Dockerfile']);
    expect(hadolint.steps.find(step => step.uses?.startsWith('hadolint/')).with['no-fail']).toBe(true);
  });

  test.each(['gitleaks', 'trivy'])('installer %s vérifie avant extraction et exposition dans PATH', scanner => {
    const state = installerFixture(scanner);
    const result = install(scanner, state);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(readFileSync(state.log, 'utf8')).toBe('download\nchecksum\nextract\nversion\n');
    expect(readFileSync(state.pathFile, 'utf8'))
      .toBe(`${join(state.directory, 'security-scanners', scanner)}\n`);
  });

  test.each(['gitleaks', 'trivy'])('une archive %s corrompue ne peut ni être extraite ni atteindre PATH', scanner => {
    const state = installerFixture(scanner, { realChecksum: true });
    const result = install(scanner, state);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/checksum.*(?:mismatch|did NOT match)/i);
    expect(readFileSync(state.log, 'utf8')).toBe('download\n');
    expect(readFileSync(state.pathFile, 'utf8')).toBe('');
    expect(existsSync(join(state.directory, 'security-scanners', scanner, scanner))).toBe(false);
  });

  test('une erreur réseau ne devient pas un succès et ne lance pas le vérificateur', () => {
    const state = installerFixture('gitleaks', { downloadExit: 22 });
    expect(install('gitleaks', state).status).toBe(22);
    expect(readFileSync(state.log, 'utf8')).toBe('download\n');
    expect(readFileSync(state.pathFile, 'utf8')).toBe('');
    expect(install('unsupported', state).status).toBe(2);
  });

  test.each([true, false])('la commande réelle de checksum valide ou rejette une archive (intègre : %s)', intact => {
    const state = fixture();
    const content = 'fixture archive\n';
    const archive = 'fixture.tar.gz';
    writeFileSync(join(state.directory, archive), intact ? content : 'corrupt archive\n');
    const verification = read('scripts/install-security-scanner.sh').split('\n')
      .find(line => line.includes('| sha256sum'));
    expect(verification).toBeDefined();
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', verification], {
      cwd: state.directory,
      env: {
        ...state.env,
        checksum: createHash('sha256').update(content).digest('hex'),
        install_dir: state.directory,
        archive,
      },
      encoding: 'utf8',
    });
    if (intact) {
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    } else {
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/checksum.*(?:mismatch|did NOT match)/i);
    }
  });

  test.each([1, 42])('les gates conservent les erreurs de scanner/lint (code %i)', exitCode => {
    const gates = [
      [ci.jobs['security-lint'], 'npm', 'npm run lint:security'],
      [audit.jobs['eslint-security'], 'npm', 'npm run lint:security'],
      [audit.jobs['npm-audit'], 'npm', 'npm run --silent audit:dependencies'],
      [trivyScan, 'trivy', 'trivy fs'],
      [audit.jobs.gitleaks, 'gitleaks', 'gitleaks git'],
    ];
    for (const [job, command, prefix] of gates) {
      const state = fixture();
      executable(state.directory, command, `
printf '%s\\n' "$@" > "$FIXTURE_LOG"
printf '[]\\n'
exit ${exitCode}`);
      const step = job.steps.find(candidate => candidate.run?.startsWith(prefix));
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', step.run], {
        cwd: state.directory, env: state.env, encoding: 'utf8',
      });
      expect(result.status).toBe(exitCode);
      const args = readFileSync(state.log, 'utf8').trim().split('\n');
      if (command === 'trivy') {
        expect(args.slice(args.indexOf('--scanners'), args.indexOf('--scanners') + 2))
          .toEqual(['--scanners', 'vuln,secret']);
        expect(args.slice(args.indexOf('--exit-code'), args.indexOf('--exit-code') + 2))
          .toEqual(['--exit-code', '1']);
        expect(args.slice(args.indexOf('--severity'), args.indexOf('--severity') + 2))
          .toEqual(['--severity', 'CRITICAL,HIGH']);
      } else if (command === 'gitleaks') {
        expect(args).toContain('--redact');
        expect(args.slice(args.indexOf('--gitleaks-ignore-path'), args.indexOf('--gitleaks-ignore-path') + 2))
          .toEqual(['--gitleaks-ignore-path', '.gitleaksignore']);
      } else if (prefix.includes('lint:security')) {
        expect(args).toEqual(['run', 'lint:security', '--', '--format', 'json', '--output-file', 'eslint-security-results.json']);
      }
    }
  });
});
