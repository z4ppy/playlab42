## Why

La demande explicite « c'est merge, continue de corriger le code (duplication et
clone) » autorise cette continuation en fleet apres la fusion de la PR #152 sur
main `5956cd92f69c2a2d36c9f27fcc838dd6e4dd1290`.
La baseline native contient 56 clones, 584 lignes et 4360 tokens dupliques,
sans fonction de production JS/HTML de complexite superieure a 10.

## What Changes

- Caracteriser avant mutualisation les styles, etats et algorithmes concernes.
- Consolider seulement des contrats reellement identiques, avec proprietaires
  de fichiers distincts en worktrees independants.
- Preserver cascade, themes, responsive, accessibilite, APIs, seeds et messages.
- Mesurer les trois compteurs absolus, conserver outils/parametres/exclusions
  et resserrer les budgets sur les resultats effectivement verifies.
- Documenter les clones intentionnels et distinguer PR, fusion et publication.

## Capabilities

### New Capabilities
- `semantic-deduplication`: reductions de clones avec preuves de comportement.

### Modified Capabilities
None. Les contrats fonctionnels existants ne sont pas remplaces.

## Impact

Styles partages/jeux/outils/musique, petites mutualisations JS isomorphes ou
musicales, entrees CLI de fabrication si leur contrat est identique, tests,
budgets mesures et documentation directement associee.
Pas de nouveau framework, preprocessseur CSS, exclusion, minification artificielle,
migration de DOM ou changement de politique navigateur sans justification.
Cette autorisation ne vaut ni revue, ni fusion, ni publication, ni archivage.
