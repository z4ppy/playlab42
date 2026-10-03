## Why

Après le lint (PR #140, contrôles natifs constatés), le lot 4 demandé vise la
qualité du code existant. La lecture et la mesure montrent des défauts concrets :
racine déduite d'un simple substring `lib`, erreurs JSON/cache silencieuses,
cache daté dans le futur accepté, entités numériques invalides faisant échouer
une page, lectures JSON dupliquées et fonctions OG de complexité 14 et 17.

## What Changes

- Corriger ces contrats et isoler les responsabilités parsing/repli/enrichissement.
- Réutiliser les lecteurs JSON communs et rendre leurs échecs explicites.
- Préserver un fichier généré précédent lorsqu'une écriture atomique échoue.
- Ajouter invariants/bornes/erreurs et seuils ciblés de lint/couverture après mesure.
- Actualiser guides, parcours, skills et changelog sans prétendre une qualité globale.

## Authorization

L'utilisateur autorise tous les lots suivants en ordre, avec correction de
l'existant à chaque étape. Lot 3 vérifié avant ce worktree distinct.
Ni merge, déploiement, archive ni nouvelle dépendance ne sont autorisés implicitement.

## Impact

Utilitaires/builders et transport OG, tests des contrats, seuils ciblés et docs.
Les données valides et interactions restent compatibles ; les entrées invalides
sont diagnostiquées plutôt que transformées silencieusement en succès.
