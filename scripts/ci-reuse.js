import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { controls, fingerprint, proofVersion, readTree } from './ci-plan.js';

function admissible(run, plan) {
  return run.event === 'pull_request' && run.status === 'completed' && run.conclusion === 'success'
    && run.head_repository?.full_name === plan.repository
    && run.head_branch === plan.branch
    && (!run.pull_requests?.length || run.pull_requests.some(pr => pr.number === plan.pr));
}

function validProof(proof, run, plan) {
  return proof?.version === proofVersion && proof.repository === plan.repository && proof.pr === plan.pr
    && proof.runId === run.id && proof.attempt === run.run_attempt && /^[a-f0-9]{40}$/.test(proof.commit)
    && JSON.stringify(proof.runner) === JSON.stringify(plan.runner) && admissible(run, plan);
}

export function applyEvidence(plan, proof, run, tree) {
  if (!validProof(proof, run, plan)) { return; }
  for (const id of controls) {
    const prior = proof.controls?.[id];
    const current = plan.controls[id];
    if (current.mode !== 'execute' || prior?.mode !== 'execute' || prior.eligible !== true) { continue; }
    const actual = fingerprint(id, tree, plan.runner);
    if (prior.fingerprint !== actual || current.fingerprint !== actual) { continue; }
    current.mode = 'reused';
    current.source = { runId: run.id, attempt: run.run_attempt, commit: proof.commit };
  }
}

async function readEvidence(github, coordinates, run) {
  const { data } = await github.rest.actions.listWorkflowRunArtifacts({ ...coordinates, run_id: run.id, per_page: 100 });
  const artifact = data.artifacts.find(item => item.name === `ci-evidence-${run.id}-${run.run_attempt}` && !item.expired);
  if (!artifact) { throw new Error(`Preuve originale absente pour le run ${run.id}.`); }
  if (artifact.size_in_bytes > 65536) { throw new Error('Archive de preuve trop volumineuse.'); }
  const response = await github.rest.actions.downloadArtifact({ ...coordinates, artifact_id: artifact.id, archive_format: 'zip' });
  const directory = mkdtempSync(join(tmpdir(), 'playlab-ci-evidence-'));
  try {
    const archive = join(directory, 'proof.zip');
    writeFileSync(archive, Buffer.from(response.data));
    return JSON.parse(execFileSync('unzip', ['-p', archive, 'ci-evidence.json'], {
      encoding: 'utf8', maxBuffer: 65536, timeout: 10000,
    }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Les erreurs d'optimisation provoquent une execution, jamais un succes sans preuve. */
export async function reuseCi(plan, { github, root, currentRunId, warn = console.warn }) {
  if (!plan.reuseAllowed) { return; }
  const [owner, repo] = plan.repository.split('/');
  const coordinates = { owner, repo };
  let candidates;
  try {
    const { data } = await github.rest.actions.listWorkflowRuns({
      ...coordinates, workflow_id: 'ci.yml', event: 'pull_request', branch: plan.branch, per_page: 30,
    });
    candidates = data.workflow_runs.filter(run => run.id !== currentRunId && admissible(run, plan)).slice(0, 3);
  } catch (error) {
    warn(`Preuves CI indisponibles, nouvelle execution : ${error.message}`);
    return;
  }
  for (const run of candidates) {
    try {
      const proof = await readEvidence(github, coordinates, run);
      if (!validProof(proof, run, plan)) { throw new Error(`Provenance invalide du run ${run.id}.`); }
      execFileSync('git', ['fetch', '--no-tags', 'origin', proof.commit], { cwd: root, timeout: 30000, stdio: 'pipe' });
      applyEvidence(plan, proof, run, readTree(root, proof.commit));
    } catch (error) {
      warn(`Preuve du run ${run.id} non reutilisable, nouvelle execution : ${error.message}`);
    }
  }
}
