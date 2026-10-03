import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const analyses = [
  ['npm-audit', 'npm audit', 'Audit bloquant au seuil modéré ; les problèmes de niveau faible restent possibles.'],
  ['eslint-security', 'ESLint Security', 'Analyse consultative ; consulter les diagnostics et artefacts.'],
  ['trivy-scan', 'Trivy', 'Analyse consultative ; consulter les diagnostics et artefacts.'],
  ['gitleaks', 'Gitleaks', 'Scan terminé sans détection bloquante ; pas une garantie exhaustive.'],
  ['outdated-check', 'Packages obsolètes', 'Inventaire consultatif, pas un verdict de sécurité.'],
  ['docker-security', 'Hadolint', 'Analyse consultative ; consulter les diagnostics et artefacts.'],
];
const states = {
  success: 'Réussi',
  failure: 'Échec : analyse ou outil en erreur',
  cancelled: 'Annulé : résultat non validé',
  skipped: 'Non exécuté',
};

function escapeMarkdown(value) {
  if (typeof value !== 'string' || !value.trim()) {throw new Error('Métadonnée du rapport absente.');}
  return value.replace(/[\r\n]/g, ' ').replace(/[\\`*_[\]<>|]/g, '\\$&');
}

/**
 * @param {Record<string, {result: string}>} results États GitHub des analyses.
 * @param {{commit: string, branch: string}} metadata Identité du run.
 */
export function buildSecurityReport(results, { commit, branch }) {
  if (!results || typeof results !== 'object' || Array.isArray(results)) {
    throw new Error('États des analyses absents ou invalides.');
  }
  const rows = analyses.map(([id, name, interpretation]) => {
    const result = results[id]?.result;
    if (!Object.hasOwn(states, result)) {throw new Error(`État de l'analyse ${id} invalide ou absent.`);}
    return `| ${name} | ${states[result]} | ${result === 'success' ? interpretation : 'Consulter le job ; aucune conclusion favorable.'} |`;
  });
  return [
    '# Rapport de sécurité',
    '',
    `**Commit** : ${escapeMarkdown(commit)}`,
    `**Branche** : ${escapeMarkdown(branch)}`,
    '',
    '| Analyse | État du job | Interprétation |',
    '|---------|-----------|----------------|',
    ...rows,
    '',
    'Les états viennent des jobs, pas de la présence d’un fichier de rapport.',
    'Un job consultatif peut réussir malgré des diagnostics ou une commande masquée.',
    'Consulter les logs et artefacts du workflow ; ce résumé ne remplace pas les résultats détaillés.',
    '',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(buildSecurityReport(JSON.parse(process.env.SECURITY_JOB_RESULTS), {
      commit: process.env.GITHUB_SHA,
      branch: process.env.REPORT_BRANCH,
    }));
  } catch (error) {
    console.error(`Rapport de sécurité impossible : ${error.message}`);
    process.exitCode = 1;
  }
}
