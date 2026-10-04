/**
 * Preuves Jest : node scripts/coverage-report.js [coverage-directory].
 * Exige GITHUB_SHA, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT et TEST_OUTCOME.
 * Les compteurs JSON sont vérifiés avant agrégation ; aucun seuil ajouté ici.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const measures = ['statements', 'branches', 'functions', 'lines'];
const families = ['app', 'lib', 'games', 'tools', 'scripts'];
const priorities = [
  'app/events.js', 'app/game-loader.js', 'app/settings.js',
  'games/checkers/engine.js', 'games/triomino/engine.ts',
  'tools/relativity-lab/src/Simulation.js',
];

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function object(value, label) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), `${label} : objet attendu`);
  return value;
}

function counter(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validateProvenance(provenance) {
  object(provenance, 'provenance');
  requireCondition(typeof provenance.sha === 'string' && provenance.sha.length === 40 && /^[a-f0-9]{40}$/i.test(provenance.sha), 'provenance : SHA invalide');
  for (const key of ['runId', 'runAttempt']) {
    requireCondition(typeof provenance[key] === 'string' && provenance[key].trim() === provenance[key] && /^[1-9]\d*$/.test(provenance[key]), `provenance : ${key} invalide`);
  }
  requireCondition(['success', 'failure', 'cancelled', 'skipped'].includes(provenance.tests), 'provenance : statut Tests invalide');
}

function validateMetric(metric, label) {
  object(metric, label);
  requireCondition(['total', 'covered', 'skipped'].every(key => counter(metric[key])), `${label} : compteurs invalides`);
  requireCondition(metric.covered <= metric.total && metric.skipped <= metric.total, `${label} : compteurs excessifs`);
  const expected = metric.total ? metric.covered / metric.total * 100 : 100;
  requireCondition(typeof metric.pct === 'number' && Number.isFinite(metric.pct) && Math.abs(metric.pct - expected) < 0.011, `${label} : pourcentage incohérent`);
}

function finalMetrics(data, file) {
  object(data, file);
  requireCondition(data.path === file, `${file} : chemin final incohérent`);
  const hits = {};
  for (const [key, map] of [['s', 'statementMap'], ['f', 'fnMap'], ['b', 'branchMap']]) {
    object(data[key], `${file}/${key}`);
    object(data[map], `${file}/${map}`);
    requireCondition(JSON.stringify(Object.keys(data[key]).sort()) === JSON.stringify(Object.keys(data[map]).sort()), `${file} : maps incohérentes`);
    hits[key] = Object.values(data[key]);
  }
  requireCondition(hits.b.every(value => Array.isArray(value) && value.length > 0), `${file} : branches invalides`);
  hits.b = hits.b.flat();
  requireCondition(Object.values(hits).every(values => values.every(counter)), `${file} : hits invalides`);
  const lines = new Map();
  for (const [id, location] of Object.entries(data.statementMap)) {
    requireCondition(Number.isSafeInteger(location?.start?.line) && location.start.line > 0, `${file} : ligne invalide`);
    const line = location.start.line;
    lines.set(line, Math.max(lines.get(line) ?? 0, data.s[id]));
  }
  const count = values => ({ total: values.length, covered: values.filter(value => value > 0).length });
  return { statements: count(hits.s), functions: count(hits.f), branches: count(hits.b), lines: count([...lines.values()]) };
}

function escapeMarkdown(value) {
  return String(value).replace(/[&<>|`[\]\\*_{}\r\n]/g, char => `&#${char.charCodeAt(0)};`)
    .replace(/&#60;/g, '&lt;').replace(/&#62;/g, '&gt;');
}

function aggregate(entries) {
  return Object.fromEntries(measures.map(measure => [measure, entries.reduce((sum, entry) => {
    sum.total += entry[measure].total;
    sum.covered += entry[measure].covered;
    sum.skipped += entry[measure].skipped;
    requireCondition(counter(sum.total) && counter(sum.covered) && counter(sum.skipped), `${measure} : agrégation hors limites`);
    return sum;
  }, { total: 0, covered: 0, skipped: 0 })]));
}

function percent(covered, total) {
  // Même ordre d'opérations et troncature à deux décimales qu'Istanbul.
  const scaled = (100000 * covered) / total;
  return Math.floor(scaled / 10) / 100;
}

function row(label, data) {
  const values = measures.map(measure => {
    const { total, covered } = data[measure];
    return total ? `${percent(covered, total).toFixed(2)}% (${covered}/${total})` : 'N/A (0/0)';
  });
  return `| ${escapeMarkdown(label)} | ${values.join(' | ')} |`;
}

function coverageEntries(summary, finalCoverage, root) {
  const entries = [];
  for (const [file, data] of Object.entries(summary)) {
    if (file === 'total') {
      continue;
    }
    const relative = path.relative(root, file);
    requireCondition(path.isAbsolute(file) && relative && !relative.startsWith('../') && !path.isAbsolute(relative), `${file} : source hors racine`);
    const measured = finalMetrics(finalCoverage[file], file);
    for (const measure of measures) {
      validateMetric(data[measure], `${file}/${measure}`);
      requireCondition(data[measure].total === measured[measure].total && data[measure].covered === measured[measure].covered, `${file}/${measure} : JSON incohérents`);
    }
    entries.push({ file: relative.split(path.sep).join('/'), data });
  }
  requireCondition(Object.keys(finalCoverage).length === entries.length, 'coverage-final.json : fichiers incohérents');
  return entries;
}

/** Valide les deux JSON Jest et construit le résumé sans moyenne de pourcentages. */
export function buildReport({ summary, finalCoverage, provenance, root }) {
  validateProvenance(provenance);
  object(summary, 'coverage-summary.json');
  object(finalCoverage, 'coverage-final.json');
  object(summary.total, 'total');
  const entries = coverageEntries(summary, finalCoverage, root);
  const total = aggregate(entries.map(entry => entry.data));
  for (const measure of measures) {
    validateMetric(summary.total[measure], `total/${measure}`);
    requireCondition(['total', 'covered', 'skipped'].every(key => total[measure][key] === summary.total[measure][key]), `total/${measure} : agrégation incohérente`);
  }
  const rows = [row('Total instrumenté', total)];
  for (const family of families) {
    const members = entries.filter(entry => entry.file.startsWith(`${family}/`));
    requireCondition(members.length > 0, `${family} : données manquantes`);
    rows.push(row(family, aggregate(members.map(entry => entry.data))));
  }
  for (const priority of priorities) {
    const entry = entries.find(entry => entry.file === priority);
    requireCondition(entry, `${priority} : données manquantes`);
    rows.push(row(priority, entry.data));
  }
  const header = '| Périmètre | Statements | Branches | Fonctions | Lignes |\n|---|---|---|---|---|';
  return [
    '## Preuves de couverture Jest',
    `SHA : ${provenance.sha} — run : ${provenance.runId} — tentative : ${provenance.runAttempt}`,
    `État du pas Tests : **${provenance.tests}**. La présence de couverture ne prouve pas leur succès.`,
    '', header, ...rows,
    '',
    'Limites : couverture Jest des sources collectCoverageFrom seulement. Les subprocessus ne sont pas instrumentés automatiquement ; HTML inline et interactions navigateur/E2E ne sont pas mesurés ici. N/A signifie aucun compteur, pas 100% ni absence de tests. Ce rapport n’applique pas de seuil ; Jest applique les seuils versionnés. Aucune certification globale.',
    '',
    '<details><summary>Fichiers instrumentés (compteurs vérifiés)</summary>\n',
    header, ...entries.sort((a, b) => a.file.localeCompare(b.file)).map(entry => row(entry.file, entry.data)),
    '\n</details>\n',
  ].join('\n');
}

function main() {
  const directory = path.resolve(process.argv[2] ?? 'coverage');
  const provenance = {
    sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT, tests: process.env.TEST_OUTCOME,
  };
  let report;
  try {
    validateProvenance(provenance);
    writeFileSync(path.join(directory, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
    const readJson = name => JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
    const summary = readJson('coverage-summary.json');
    const finalCoverage = readJson('coverage-final.json');
    const lcov = readFileSync(path.join(directory, 'lcov.info'), 'utf8');
    requireCondition(/^SF:.+/m.test(lcov) && /^end_of_record$/m.test(lcov), 'lcov.info : données manquantes ou invalides');
    report = buildReport({ summary, finalCoverage, provenance, root: process.cwd() });
  } catch (error) {
    report = `## ERREUR — preuves de couverture Jest\n\n${escapeMarkdown(error.message)}\n\nSHA/run/statut reçus : ${escapeMarkdown(JSON.stringify(provenance))}\n`;
    console.error(error.message);
    process.exitCode = 1;
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  }
  writeFileSync(path.join(directory, 'coverage-report.md'), report);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
