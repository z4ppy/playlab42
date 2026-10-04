## Why

Les PR documentaires et les rebases relancent toute la CI. Les checks requis
doivent rester bloquants, mais un controle sans impact peut etre explicitement
non applicable et une preuve identique peut etre reutilisee avec sa provenance.

Autorisation : demande utilisateur « Bien fait le stp », apres presentation
du parcours documentaire puis de la reutilisation par empreinte.

## What Changes

- Selection conservative par impact sur le vrai commit teste.
- Conservation des neuf noms de checks requis et du guard Build.
- Fabrication et verification de la nouvelle archive, meme pour la documentation.
- Reutilisation bornee aux executions reussies de la meme PR, avec comparaison
  des entrees Git, du workflow, de Node et de l'image du runner.
- Parcours complet sur main et lors des lancements manuels ; audits evolutifs
  et detection des secrets toujours executes.

## Capabilities

### New Capabilities
- `selective-ci`: selection explicite, empreintes et preuves reutilisables.

### Modified Capabilities
- Aucun remplacement des specs principales ; les contrats de livraison des
  changes actifs restent applicables avec des gates explicites.

## Impact

Workflows CI/navigateur, scripts de politique et leurs tests, documentation
de livraison. Aucune modification applicative, protection distante, fusion
automatique ou certification de securite.
