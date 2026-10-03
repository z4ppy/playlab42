## Why

La demande « continuer les améliorations […] lint, securite, code qualité »
autorise ce premier lot dans le worktree courant. La livraison est déjà
conditionnée à la CI, mais les avertissements lint, audits séparés, seuils
inactifs et rapports sans preuve laissent des écarts de qualité.

## What Changes

- Bloquer les avertissements lint et les constructions JavaScript dangereuses.
- Intégrer l'audit npm existant au seuil modéré dans la CI de livraison.
- Activer des seuils ciblés sur trois composants critiques déjà mesurés.
- Distinguer analyses réussies, consultatives, échouées et non exécutées.
- Limiter les permissions d'écriture du workflow de sécurité aux jobs SARIF et commentaire PR.
- Formaliser les pratiques logicielles et ajouter une procédure de revue avec
  des scénarios évaluables, sans revendiquer une comparaison d'agents exécutée.

## Capabilities

### New Capabilities

- `software-quality`: socle automatique, revue et communication des preuves.

### Modified Capabilities

- `software-delivery`: l'audit des dépendances devient requis pour publier.

## Impact

Configurations lint/Jest, CI et rapport de sécurité, guide qualité et skills.
Aucun changement de framework, règle de jeu, protection GitHub, merge,
déploiement ou archivage n'est autorisé implicitement.
