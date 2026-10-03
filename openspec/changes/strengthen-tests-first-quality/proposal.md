## Why

La demande utilisateur « c'est parti, il faudra surement commencer par les
tests avant les refacto » autorise l'application du plan qualité proposé
dans la PR #146. La CI de référence `a5598b2` mesure 65,24 % de branches Jest,
avec des déficits sur les contrats du portail et l'orchestration de Simulation.
Ces chiffres ne mesurent pas les assertions navigateur ou tous les fichiers.

## What Changes

- Rendre les preuves Jest exploitables par module et corriger les scopes Codecov.
- Caractériser les messages, chargements concurrents et erreurs de reset du portail.
- Vérifier captures/replay des Dames, transitions/scoring/reprise du Triomino.
- Fermer l'écart de prise majoritaire confirmé pendant la caractérisation :
  les specs/README annoncent les Dames françaises sans variante dérogatoire.
- Tester l'orchestration temporelle et les ressources de Relativity Simulation.
- Corriger seulement les défauts reproduits et refactorer après caractérisation.
- Ajouter des seuils ciblés après mesure, sans réduire ceux déjà actifs.

## Capabilities

### New Capabilities

- `test-first-quality`: scénarios comportementaux, rapports et verrouillage progressif.

### Modified Capabilities

Aucune nouvelle variante de jeu, API publique, plateforme ou protection distante.
La prise majoritaire aligne les actions sur les règles françaises annoncées :
les anciennes captures courtes acceptées à tort ne deviennent plus légales.
Les autres corrections préservent les contrats moteur et les intentions de cycle de vie.
Toute rupture découverte exige une décision explicitée avant son introduction.

## Impact

Tests et corrections bornées dans app/, Dames, Triomino et Relativity ;
rapports Jest/CI/Codecov et guides liés. Contributions indépendantes en worktrees.
Pas de framework, dépendance, migration RNG, backend ou scanner supplémentaire.
Validation et PR sont autorisées ; pas de merge, déploiement ou archivage implicite.
