import { buildSecurityReport } from './build-security-report.js';
import { spawnSync } from 'node:child_process';

const ids = ['npm-audit', 'eslint-security', 'trivy-scan', 'gitleaks', 'outdated-check', 'docker-security'];
const metadata = { commit: 'a'.repeat(40), branch: 'quality-baseline' };
const results = () => Object.fromEntries(ids.map(id => [id, { result: 'success' }]));

describe('Rapport de sécurité fidèle aux exécutions', () => {
  test('un succès consultatif ne conclut pas à zéro problème', () => {
    const report = buildSecurityReport(results(), metadata);
    expect(report).toContain('Analyse consultative');
    expect(report).toContain('problèmes de niveau faible restent possibles');
    expect(report).toContain('Gate JavaScript ciblé');
    expect(report).toContain('HIGH/CRITICAL');
    expect(report).not.toMatch(/Aucun problème|Aucune vulnérabilité détectée/);
  });

  test.each(['failure', 'cancelled', 'skipped'])('%s est affiché sans conclusion favorable', state => {
    const jobs = results();
    jobs['npm-audit'].result = state;
    const report = buildSecurityReport(jobs, metadata);
    expect(report).toContain('aucune conclusion favorable');
    expect(report).toContain({ failure: 'Échec', cancelled: 'Annulé', skipped: 'Non exécuté' }[state]);
  });

  test('un état manquant ou inconnu est une erreur explicite', () => {
    const jobs = results();
    delete jobs['gitleaks'];
    expect(() => buildSecurityReport(jobs, metadata)).toThrow('gitleaks');
    jobs.gitleaks = { result: 'unknown' };
    expect(() => buildSecurityReport(jobs, metadata)).toThrow('gitleaks');
    expect(() => buildSecurityReport(null, metadata)).toThrow('États');
  });

  test('les métadonnées sont des données, pas du Markdown interprété', () => {
    const report = buildSecurityReport(results(), { ...metadata, branch: '<img>|`branch`\ntext' });
    expect(report).toContain('\\<img\\>\\|\\`branch\\` text');
    expect(() => buildSecurityReport(results(), { ...metadata, commit: '' })).toThrow('Métadonnée');
  });

  test.each([true, false])('le CLI reçoit les états du workflow : données valides %s', valid => {
    const result = spawnSync(process.execPath, ['scripts/build-security-report.js'], {
      env: {
        ...process.env,
        SECURITY_JOB_RESULTS: valid ? JSON.stringify(results()) : '{invalid',
        GITHUB_SHA: metadata.commit,
        REPORT_BRANCH: metadata.branch,
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(valid ? 0 : 1);
    if (valid) {
      expect(result.stdout).toContain('État du job');
      expect(result.stdout).toContain(metadata.commit);
    } else {
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('Rapport de sécurité impossible');
    }
  });
});
