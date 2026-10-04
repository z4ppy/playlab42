import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const controls = ['lint', 'security-lint', 'test', 'code-quality', 'typecheck', 'openspec', 'browser'];
export const modes = ['execute', 'documentation', 'not-applicable', 'reused'];
export const documentaryTests = [
  'scripts/build-guides.test.js', 'scripts/openspec-guide.test.js',
  'scripts/openspec-parcours.test.js', 'scripts/project-skills.test.js', 'scripts/playlab-guide.test.js',
];
export const proofVersion = 1;

export function isDocumentary(path) {
  return /^(?:README|AGENTS|CLAUDE)\.md$/.test(path)
    || /^(?:docs|openspec|\.github\/skills)\/.*\.md$/.test(path);
}

function validPath(path) {
  return typeof path === 'string' && path.length > 0 && !/[\r\n\0]/.test(path)
    && !path.startsWith('/') && !path.split('/').some(part => part === '..' || part === '.');
}

function fullPlan(paths, reason, reuseAllowed = false) {
  return {
    version: proofVersion, full: true, paths, reuseAllowed,
    controls: Object.fromEntries(controls.map(id => [id, { mode: 'execute', reason }])),
  };
}

/** @param {string[]} paths Chemins du diff, suppressions comprises. */
export function classifyChanges(paths) {
  if (!Array.isArray(paths) || !paths.length || !paths.every(validPath)) {
    return fullPlan([], 'Diff vide ou chemins non fiables.');
  }
  const codePaths = paths.filter(path => !isDocumentary(path));
  const shared = path => /^(?:lib|app|assets|scripts|vendor|metadata|bookmarks)\//.test(path)
    || !/^(?:games|tools|parcours|docs)\//.test(path);
  if (codePaths.some(shared)) {
    return fullPlan(paths, 'Entrees partagees, fabrication ou configuration.', true);
  }
  if (codePaths.some(path => !/\.(?:[cm]?js|ts|html|css|json|png|jpe?g|svg|webp|gif|woff2?|mp3|ogg|wav)$/.test(path))) {
    return fullPlan(paths, 'Chemin inconnu : validation complete.');
  }
  const hasCode = codePaths.some(path => /\.(?:[cm]?js|ts|html)$/.test(path));
  const selected = {
    lint: hasCode,
    'security-lint': hasCode,
    'code-quality': codePaths.some(path => /\.(?:[cm]?js|ts|html|css)$/.test(path)),
    typecheck: codePaths.some(path => /\.(?:[cm]?js|ts|json)$/.test(path)),
    openspec: paths.some(path => path.startsWith('openspec/')),
  };
  return {
    version: proofVersion, full: false, paths, reuseAllowed: true,
    controls: Object.fromEntries(controls.map(id => {
      const mode = ['test', 'browser'].includes(id)
        ? codePaths.length ? 'execute' : 'documentation'
        : selected[id] ? 'execute' : 'not-applicable';
      return [id, { mode, reason: codePaths.length ? 'Selection conservative des fichiers impactes.' : 'Markdown documentaire uniquement.' }];
    })),
  };
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function activeDocuments(root, commit) {
  const result = spawnSync('git', ['grep', '-I', '-l', '-z', '-E', '<[[:alpha:]!/]', commit, '--', '*.md'], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || ![0, 1].includes(result.status)) { throw new Error('Inspection des Markdown Git impossible.'); }
  return new Set(result.stdout.split('\0').filter(Boolean).map(path => path.slice(commit.length + 1)));
}

export function readTree(root, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) { throw new Error('Commit CI invalide.'); }
  const active = activeDocuments(root, commit);
  return git(root, ['ls-tree', '-r', '-z', '--full-tree', commit]).split('\0').filter(Boolean).map(entry => {
    const match = /^(\d{6}) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);
    if (!match || !validPath(match[3])) { throw new Error('Entree Git non prise en charge.'); }
    return { mode: match[1], oid: match[2], path: match[3], activeMarkdown: active.has(match[3]) };
  });
}

/** Empreinte des blobs et modes Git, pas du SHA de la branche ou du cache npm. */
export function fingerprint(id, tree, runner) {
  if (!controls.includes(id) || !runner?.node || !runner.image || !runner.arch) {
    throw new Error('Controle ou environnement CI absent.');
  }
  const inputs = tree.filter(file => id === 'test' || file.activeMarkdown || !isDocumentary(file.path)
    || (id === 'openspec' && file.path.startsWith('openspec/')))
    .map(file => [file.path, file.mode, file.oid]).sort((a, b) => a[0].localeCompare(b[0], 'en'));
  return createHash('sha256').update(JSON.stringify([proofVersion, id, runner, inputs])).digest('hex');
}

function selectPullRequest(event, root, commit, warn) {
  try {
    const base = event.pull_request.base.sha;
    if (!/^[a-f0-9]{40}$/.test(base) || !/^[a-f0-9]{40}$/.test(commit)) { throw new Error('Base ou merge absent.'); }
    const paths = git(root, ['diff', '--name-only', '-z', '--no-renames', base, commit]).split('\0').filter(Boolean);
    return { ...classifyChanges(paths), base };
  } catch (error) {
    warn(`Diff CI indisponible, execution complete : ${error.message}`);
    return fullPlan([], 'Diff indisponible : execution complete.');
  }
}

function pullRequestMetadata(event, repository) {
  return {
    pr: event.pull_request?.number ?? null,
    branch: event.pull_request?.head?.ref ?? null,
    fromSameRepo: Boolean(repository) && event.pull_request?.head?.repo?.full_name === repository,
  };
}

function addFingerprints(plan, root, warn) {
  try {
    const tree = readTree(root, plan.commit);
    const baseTree = plan.base ? readTree(root, plan.base) : [];
    if ([...tree, ...baseTree].some(file => file.activeMarkdown && plan.paths.includes(file.path))) {
      Object.assign(plan, fullPlan(plan.paths, 'Markdown contenant du HTML : validation complete.'));
    }
    for (const id of controls) {
      plan.controls[id].fingerprint = fingerprint(id, tree, plan.runner);
    }
  } catch (error) {
    warn(`Empreintes indisponibles, aucune reutilisation : ${error.message}`);
    Object.assign(plan, fullPlan(plan.paths, 'Inspection Git indisponible : validation complete.'));
  }
}

export function planCi({ eventName, event, root, commit, runner, repository, warn = console.warn }) {
  const plan = eventName === 'pull_request' ? selectPullRequest(event, root, commit, warn)
    : fullPlan([], 'Publication ou lancement manuel : execution complete.');
  const { pr, branch, fromSameRepo } = pullRequestMetadata(event, repository);
  Object.assign(plan, { commit, runner, repository, pr, branch });
  plan.reuseAllowed = plan.reuseAllowed && eventName === 'pull_request' && fromSameRepo;
  addFingerprints(plan, root, warn);
  return plan;
}
