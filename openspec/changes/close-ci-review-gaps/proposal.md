## Why

La revue constate un écart entre les neuf checks réellement requis sur main et
la CI de publication : Security lint pouvait être rouge sans empêcher le merge.
Trivy HIGH/CRITICAL n'était exécuté que dans l'audit complémentaire.
Le commentaire du rapport échouait sur les PR de forks avec token en lecture seule.

La demande utilisateur explicite de correction dans le worktree
`fix/review-software-factory` autorise l'implémentation ciblée, pas une mutation
GitHub, un commit, push, merge, déploiement ou archivage. Cette proposal consigne
cette autorisation ; elle ne simule aucune revue ou livraison.

## What Changes

- Garder le check requis Build et en faire l'agrégateur du succès Security lint
  et Trivy : exécution même après échec, refus explicite de tout non-succès.
- Extraire un workflow Trivy partagé, bloquant sur PR et avant publication,
  sans changer les scanners, seuils, devDependencies ou installation vérifiée.
- Séparer les noms d'artefacts entre appelants et conserver les états de jobs
  réutilisés dans le rapport.
- Conserver artefact et résumé sur forks ; commenter uniquement les PR de
  branches du même dépôt et attendre les erreurs API.
- Tester les vrais scripts et conditions YAML ; documenter garanties et limites.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `software-delivery` : couverture effective des gates par le check Build requis.
- `software-quality` : rapports sûrs pour les forks et résultats de scans partagés.

## Impact

Workflows CI/Trivy/audit, tests de politique, documentation pipeline/déploiement
et référence de validation release. Les neuf checks distants restent inchangés :
Lint, Tests, TypeScript, Build, Audit dépendances npm, Détection de secrets,
Browser / Chromium interactions, OpenSpec, Dependency audit.
Aucune modification de package, configuration globale, comportement applicatif
ou change étranger. La CI native et son coût restent à observer après livraison.
