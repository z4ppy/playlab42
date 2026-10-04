import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { sourceIgnores } from './lint-source-policy.js';

const root = path.resolve(import.meta.dirname, '..');
const scopes = ['production', 'pedagogy', 'tests'];
const parameters = { minTokens: 50, minLines: 5, mode: 'mild', formats: ['javascript', 'typescript', 'markup', 'css'] };

export function sourceScope(filename) {
  if (/(^|\/)(__tests__|__mocks__|fixtures|e2e)(\/|$)|\.(test|spec)\.[cm]?[jt]s$/.test(filename)) {
    return 'tests';
  }
  return /^(parcours|docs)\//.test(filename) ? 'pedagogy' : 'production';
}

export function selectSources(files) {
  return files.filter(filename => /\.(?:[cm]?js|ts|html|css)$/.test(filename)
    && !sourceIgnores.some(pattern => path.matchesGlob(filename, pattern)))
    .sort();
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function relativeSource(filename, directory) {
  const relative = path.relative(directory, path.resolve(directory, filename)).split(path.sep).join('/');
  requireCondition(relative && !relative.startsWith('../') && !path.isAbsolute(relative), `Source hors racine : ${filename}`);
  return relative;
}

function run(command, args, directory) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  requireCondition(!result.error && result.status === 0, `Scanner échoué : ${command}\n${result.error?.message ?? result.stderr}\n${result.stdout}`);
  return result.stdout;
}

export function normalizeDuplication(raw, directory) {
  const totals = raw.statistics?.total;
  requireCondition(totals && Array.isArray(raw.duplicates), 'Rapport jscpd invalide');
  for (const key of ['sources', 'lines', 'tokens', 'clones', 'duplicatedLines', 'duplicatedTokens']) {
    requireCondition(Number.isSafeInteger(totals[key]) && totals[key] >= 0, `Compteur jscpd invalide : ${key}`);
  }
  requireCondition(totals.clones === raw.duplicates.length, 'Clones jscpd incohérents');
  const clones = raw.duplicates.map(clone => {
    requireCondition(Number.isSafeInteger(clone.tokens) && clone.tokens >= parameters.minTokens, 'Tokens de clone invalides');
    const locations = [clone.firstFile, clone.secondFile].map(location => {
      requireCondition(location && Number.isSafeInteger(location.start) && location.start > 0
        && Number.isSafeInteger(location.end) && location.end >= location.start, 'Position de clone invalide');
      return { file: relativeSource(location.name, directory), start: location.start, end: location.end };
    });
    return { format: clone.format, tokens: clone.tokens, locations };
  }).sort((a, b) => b.tokens - a.tokens || a.locations[0].file.localeCompare(b.locations[0].file, 'en'));
  return { totals, clones };
}

function scanDuplication(files, directory, temporary) {
  const output = path.join(temporary, 'duplicates');
  const config = path.join(temporary, 'jscpd.json');
  writeFileSync(config, JSON.stringify({ ...parameters, semantic: false }));
  run(path.join(directory, 'node_modules/.bin/jscpd'), [
    '--config', config, '--min-tokens', String(parameters.minTokens), '--min-lines', String(parameters.minLines),
    '--mode', parameters.mode, '--format', parameters.formats.join(','), '--reporters', 'json',
    '--absolute', '--no-gitignore', '--no-tips', '--no-colors', '--output', output, ...files,
  ], directory);
  return normalizeDuplication(JSON.parse(readFileSync(path.join(output, 'jscpd-report.json'), 'utf8')), directory);
}

async function scanCyclomatic(files, directory) {
  const linter = new ESLint({ cwd: directory, overrideConfig: { rules: { complexity: ['warn', 0] } } });
  const results = await linter.lintFiles(files.filter(file => /\.[cm]?js$|\.html$/.test(file)));
  const functions = [];
  for (const result of results) {
    requireCondition(!result.fatalErrorCount && !result.errorCount,
      `ESLint n'a pas analysé correctement ${result.filePath} : ${result.messages.filter(message => message.severity === 2).map(message => message.message).join('; ')}`);
    requireCondition(result.messages.every(message => message.ruleId), `Source ignorée ou non analysée par ESLint : ${result.filePath}`);
    for (const diagnostic of result.messages) {
      if (diagnostic.ruleId !== 'complexity') {
        requireCondition(diagnostic.severity !== 2 && !diagnostic.fatal, `Diagnostic ESLint : ${diagnostic.message}`);
        continue;
      }
      const match = /^(.*?) has a complexity of (\d+)\./.exec(diagnostic.message);
      requireCondition(match, `Diagnostic complexité ESLint invalide : ${diagnostic.message}`);
      functions.push({
        file: relativeSource(result.filePath, directory), line: diagnostic.line,
        name: match[1], value: Number(match[2]),
      });
    }
  }
  return functions.sort((a, b) => b.value - a.value || a.file.localeCompare(b.file, 'en') || a.line - b.line);
}

export function normalizeCognitive(raw, directory, expectedFiles) {
  requireCondition(raw.command === 'lint' && raw.summary?.errors === 0
    && raw.summary.skipped === 0 && raw.summary.diagnosticsNotPrinted === 0
    && raw.summary.unchanged === expectedFiles && Array.isArray(raw.diagnostics), 'Rapport Biome incomplet ou invalide');
  return raw.diagnostics.map(diagnostic => {
    requireCondition(diagnostic.category === 'lint/complexity/noExcessiveCognitiveComplexity', `Diagnostic Biome inattendu : ${diagnostic.message}`);
    const match = /^Excessive complexity of (\d+) detected/.exec(diagnostic.message);
    requireCondition(match && Number.isSafeInteger(diagnostic.location?.start?.line), 'Position/complexité Biome invalide');
    return { file: relativeSource(diagnostic.location.path, directory), line: diagnostic.location.start.line, value: Number(match[1]) };
  }).sort((a, b) => b.value - a.value || a.file.localeCompare(b.file, 'en') || a.line - b.line);
}

function scanCognitive(files, directory, temporary) {
  const typed = files.filter(file => file.endsWith('.ts'));
  if (!typed.length) {
    return [];
  }
  const config = path.join(temporary, 'biome');
  mkdirSync(config);
  writeFileSync(path.join(config, 'biome.json'), JSON.stringify({
    formatter: { enabled: false }, assist: { enabled: false },
    linter: { rules: { preset: 'none', complexity: { noExcessiveCognitiveComplexity: { level: 'warn', options: { maxAllowedComplexity: 1 } } } } },
  }));
  const output = run(path.join(directory, 'node_modules/.bin/biome'), [
    'lint', `--config-path=${config}`, '--reporter=json', '--max-diagnostics=none', ...typed,
  ], directory);
  return normalizeCognitive(JSON.parse(output), directory, typed.length);
}

function provenance(directory) {
  const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
  const sha = process.env.GITHUB_SHA ?? gitSha;
  requireCondition(/^[a-f0-9]{40}$/.test(sha) && sha === gitSha, 'SHA de provenance différent du checkout');
  const runId = process.env.GITHUB_RUN_ID ?? null;
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? null;
  requireCondition((runId === null && runAttempt === null) || (/^[1-9]\d*$/.test(runId) && /^[1-9]\d*$/.test(runAttempt)), 'Provenance CI incomplète');
  return { sha, runId, runAttempt, workingTree: execFileSync('git', ['status', '--porcelain'], { cwd: directory, encoding: 'utf8' }).trim() ? 'dirty' : 'clean' };
}

function cell(value) {
  return String(value).replace(/[|`<>&\r\n]/g, character => `&#${character.charCodeAt(0)};`);
}

export function renderQualityReport(report) {
  const lines = [
    '# Rapport de qualité du code',
    `SHA : ${report.provenance.sha} — run : ${report.provenance.runId ?? 'local'} — tentative : ${report.provenance.runAttempt ?? 'N/A'} — arbre : ${report.provenance.workingTree}`,
    `Outils verrouillés : ${Object.entries(report.tools).map(([name, version]) => `${name} ${version}`).join(', ')}.`,
    '',
    'Clones exacts locaux : minimum 50 tokens / 5 lignes, mode mild ; JS/TS, HTML et CSS, sans modèle distant.',
    '',
    '| Scope | Sources sélectionnées / scannées | Clones | Lignes dupliquées / lignes | JS/HTML cyclomatique >10 / >20 | TS cognitif >15 |',
    '|---|---|---|---|---|---|',
  ];
  for (const scope of scopes) {
    const data = report.scopes[scope];
    const totals = data.duplication.totals;
    const cognitive = data.cognitiveSources ? data.cognitive.filter(fn => fn.value > 15).length : 'N/A (aucun TS)';
    lines.push(`| ${scope} | ${data.files.length} / ${totals.sources} | ${totals.clones} | ${totals.duplicatedLines} / ${totals.lines} | ${data.cyclomatic.filter(fn => fn.value > 10).length} / ${data.cyclomatic.filter(fn => fn.value > 20).length} | ${cognitive} |`);
  }
  lines.push('', '## Hotspots de production (cyclomatique JS/HTML)', '', '| Source | Ligne | Fonction | Complexité |', '|---|---|---|---|');
  for (const fn of report.scopes.production.cyclomatic.filter(fn => fn.value > 10).slice(0, 20)) {
    lines.push(`| ${cell(fn.file)} | ${fn.line} | ${cell(fn.name)} | ${fn.value} |`);
  }
  lines.push('', '## Hotspots de production (cognitif TS)', '', '| Source | Ligne | Complexité |', '|---|---|---|');
  for (const fn of report.scopes.production.cognitive.filter(fn => fn.value > 10)) {
    lines.push(`| ${cell(fn.file)} | ${fn.line} | ${fn.value} |`);
  }
  lines.push('', '## Principaux clones de production', '', '| Première source | Seconde source | Tokens |', '|---|---|---|');
  for (const clone of report.scopes.production.duplication.clones.slice(0, 20)) {
    const locations = clone.locations.map(location => `${cell(location.file)}:${location.start}-${location.end}`);
    lines.push(`| ${locations.join(' | ')} | ${clone.tokens} |`);
  }
  lines.push('', 'Limites : les scopes sont scannés séparément (les clones entre scopes ne sont pas mesurés).',
    'Sources suivies JS/CJS/MJS/TS/HTML/CSS ; scripts HTML via ESLint, pas le markup. Les déclarations TS ne sont pas des fonctions.',
    'jscpd peut ne pas scanner une source trop courte pour les paramètres : le nombre scanné reste distinct du nombre sélectionné.',
    'Biome signale le cognitif TS >1, pas sa complexité cyclomatique ni toutes les fonctions.',
    'Les pourcentages de duplication ne remplacent pas les compteurs ni la revue des clones. Tests/pédagogie restent visibles séparément.',
    'Ce rapport mesure sans seuil global ; les budgets ciblés du lint et les seuils Jest restent bloquants.',
    'Une erreur de scanner ou un rapport incomplet échoue. Aucun score de certification ni couverture déduite.', '');
  return lines.join('\n');
}

export async function generateQualityReport(directory = root, output = path.join(directory, 'coverage/code-quality')) {
  const files = selectSources(execFileSync('git', ['ls-files', '-z'], { cwd: directory, encoding: 'utf8' }).split('\0').filter(Boolean));
  mkdirSync(output, { recursive: true });
  for (const filename of ['code-quality.json', 'code-quality.md']) {
    rmSync(path.join(output, filename), { force: true });
  }
  const temporary = mkdtempSync(path.join(output, '.scanners-'));
  try {
    const versions = {};
    for (const name of ['eslint', '@biomejs/biome', 'jscpd']) {
      versions[name] = JSON.parse(readFileSync(path.join(directory, 'node_modules', name, 'package.json'), 'utf8')).version;
    }
    const cyclomatic = await scanCyclomatic(files, directory);
    const cognitive = scanCognitive(files, directory, temporary);
    const data = {};
    for (const scope of scopes) {
      const members = files.filter(file => sourceScope(file) === scope);
      requireCondition(members.length > 0, `Scope sans sources : ${scope}`);
      const folder = path.join(temporary, scope);
      mkdirSync(folder);
      data[scope] = {
        files: members, duplication: scanDuplication(members, directory, folder),
        cyclomatic: cyclomatic.filter(fn => sourceScope(fn.file) === scope),
        cognitiveSources: members.filter(file => file.endsWith('.ts')).length,
        cognitive: cognitive.filter(fn => sourceScope(fn.file) === scope),
      };
    }
    const report = { formatVersion: 1, provenance: provenance(directory), tools: versions, parameters, excludes: sourceIgnores, scopes: data };
    const markdown = renderQualityReport(report);
    writeFileSync(path.join(output, 'code-quality.json'), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(path.join(output, 'code-quality.md'), markdown);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    }
    return report;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await generateQualityReport(root, process.argv[2] ? path.resolve(process.argv[2]) : undefined);
    console.log(`Rapport qualité : ${report.provenance.sha}, ${report.scopes.production.files.length} sources de production.`);
  } catch (error) {
    console.error(`Rapport qualité échoué : ${error.message}`);
    process.exitCode = 1;
  }
}
