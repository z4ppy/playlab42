## Why

Le lint qualité et sécurité JS est actif, mais les sources TS et les scripts
embarqués dans les HTML échappent encore aux contrôles. L'utilisateur exige
ce lot avant les travaux de qualité du code ; `tsc` ne remplace pas ce lint.

## What Changes

- Conserver ESLint 10 et le contrôle strict TS 7, sans peers forcés.
- Linter les sources TS avec Biome 2.5.15, dont le parser ne dépend pas du
  compilateur TypeScript ; vérifier sa couverture sur les fichiers réels.
- Linter les scripts HTML pertinents avec eslint-plugin-html 8.2.1 et les
  règles existantes, puis corriger les diagnostics et défauts confirmés.
- Faire de la commande globale de lint le gate local/CI de ces périmètres.
- Exercer les vrais outils avec entrées sûres, interdites, invalides et sortie
  exploitable ; documenter les limites (notamment les attributs HTML inline).
- Actualiser guides, parcours et skills pour distinguer lint, types et sécurité.

## Authorization

L'utilisateur demande de poursuivre tous les lots, priorise le lint au lot 3
puis la qualité du code au lot 4, et insère l'optimisation CI avant ces lots.
Les PR précédentes et l'optimisation CI ont été vérifiées nativement avant
ce worktree. Implémentation isolée autorisée ; aucun merge ni déploiement.

## Impact

Dépendances et lockfile, configurations/scripts lint, sources existantes
concernées, tests de politique et documentation. Les API et interactions
restent compatibles ; aucune désactivation générale pour contourner un échec.
