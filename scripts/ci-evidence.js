import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controls, modes, proofVersion } from './ci-plan.js';

export function currentRunner() {
  return { node: process.version.slice(1), image: `${process.env.ImageOS}-${process.env.ImageVersion}`, arch: process.arch };
}

export function decideControl(control, expected, actual) {
  if (!control || !modes.includes(control.mode)) { throw new Error('Plan du controle absent ou invalide.'); }
  const eligible = JSON.stringify(expected) === JSON.stringify(actual);
  return { mode: control.mode === 'reused' && !eligible ? 'execute' : control.mode, eligible };
}

export function renderPlan(plan) {
  return [
    '## Selection CI', '', `Commit teste : \`${plan.commit}\``, '',
    '| Controle | Decision | Motif / preuve originale |', '|---|---|---|',
    ...controls.map(id => {
      const control = plan.controls[id];
      const reason = control.source
        ? `run ${control.source.runId}, tentative ${control.source.attempt}, commit ${control.source.commit}`
        : control.reason;
      return `| ${id} | ${control.mode} | ${reason} |`;
    }),
    '', 'Build, verification de la nouvelle archive et audits evolutifs restent executes.',
    "Browser documentaire inclut les guides et les smokes multi-moteurs ; aucun ancien site n'est publie.",
    '',
  ].join('\n');
}

export function createEvidence(plan, needs, { runId, attempt }) {
  for (const id of ['impact', 'trivy-scan', 'dependency-audit', 'build', ...controls]) {
    if (needs[id]?.result !== 'success') { throw new Error(`Le controle ${id} doit reussir : ${needs[id]?.result ?? 'absent'}.`); }
  }
  const results = Object.fromEntries(controls.map(id => {
    const mode = needs[id].outputs?.mode;
    const expected = plan.controls[id].mode;
    requireMode(id, expected, mode);
    const control = { ...plan.controls[id], mode, eligible: needs[id].outputs.eligible === 'true' };
    if (mode !== 'reused') { delete control.source; }
    return [id, control];
  }));
  return { version: proofVersion, repository: plan.repository, pr: plan.pr, commit: plan.commit,
    runner: plan.runner, runId, attempt, controls: results };
}

function requireMode(id, expected, actual) {
  if (!modes.includes(expected) || !modes.includes(actual)) {
    throw new Error(`Decision du controle ${id} absente ou invalide.`);
  }
  if (actual !== expected && !(expected === 'reused' && actual === 'execute')) {
    throw new Error(`Decision du controle ${id} contraire au plan.`);
  }
}

export function guardBrowser(needs) {
  for (const id of ['impact', 'trivy-scan', 'dependency-audit', 'build', ...controls.filter(id => id !== 'browser')]) {
    if (needs[id]?.result !== 'success') { throw new Error(`Le controle ${id} doit reussir : ${needs[id]?.result ?? 'absent'}.`); }
  }
  for (const id of controls.filter(id => id !== 'browser')) {
    requireMode(id, needs.impact.outputs[id], needs[id].outputs?.mode);
  }
}

function startControl() {
  const mode = process.env.CI_MODE;
  const expected = JSON.parse(process.env.CI_RUNNER);
  const decision = decideControl({ mode }, expected, currentRunner());
  if (mode === 'reused' && decision.mode === 'execute') {
    console.warn('::warning::Environnement different du plan : nouvelle execution obligatoire.');
  }
  for (const [key, value] of Object.entries(decision)) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `Decision : **${decision.mode}**. Une non-applicabilite ou reutilisation n'est pas une nouvelle analyse.\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'start') {
      startControl();
    } else if (process.argv[2] === 'guard') {
      guardBrowser(JSON.parse(process.env.CI_JOB_RESULTS));
    } else if (process.argv[2] === 'finish') {
      const plan = JSON.parse(readFileSync(process.env.CI_PLAN_PATH, 'utf8'));
      const needs = JSON.parse(process.env.CI_JOB_RESULTS);
      if (process.env.CI_BROWSER_MODE) {
        needs.browser = { result: 'success', outputs: {
          mode: process.env.CI_BROWSER_MODE, eligible: process.env.CI_BROWSER_ELIGIBLE,
        } };
      }
      const evidence = createEvidence(plan, needs, {
        runId: Number(process.env.GITHUB_RUN_ID), attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      });
      writeFileSync(process.env.CI_EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderPlan({ ...plan, controls: evidence.controls }));
    } else {
      throw new Error('Commande de preuve CI inconnue.');
    }
  } catch (error) {
    console.error(`::error::Preuve CI impossible : ${error.message}`);
    process.exitCode = 1;
  }
}
