## Why

La PR #151 est fusionnee sur main a54954c. Le rapport verifie conserve
49 fonctions JS/HTML de complexite > 10 et 58 clones / 610 lignes.
Les orchestration et controles musicaux restent moins caracterises que
les moteurs ; App.js est hors collecte explicite et plusieurs controles
ont une faible couverture Jest. Une CI verte ne certifie pas la perfection.

L'utilisateur autorise la continuation en fleet : « j'ai merge, continue
jusqu'a ce que la base de code soit parfaite ». Cette demande autorise
les corrections, tests et refactorings des axes du bilan, pas une fusion,
publication ou suppression arbitraire de fonctionnalites.

## What Changes

- Caracteriser puis clarifier orchestration musicale, controles audio,
  Relativity, portail et commandes/rendus des jeux.
- Proteger toutes les fonctions de production mesurees au budget 10,
  sans exclure les helpers, et ajouter des floors sur les scenarios mesures.
- Renforcer les contrats JS par une verification statique ciblee.
- Rendre bloquants des budgets explicites de qualite, sans seuil global
  artificiel de couverture ni chasse aux clones pedagogiques.
- Exercer des interactions critiques dans Firefox/WebKit en complement
  de Chromium, sans changer silencieusement les checks requis de main.
- Aligner documentation, parcours, preuves et limites de livraison.

## Capabilities

### New Capabilities
- `application-quality`: contrats d'orchestration caracterises et budgets
  verifiables sur le code applicatif.

### Modified Capabilities
- None. Les API et comportements publics restent compatibles, sauf defaut
  reproduit dont la correction et les limites sont explicites.

## Impact

Sources musicales, portail, bibliotheques partagees, outils, controles
de jeux, tests et configurations de qualite/navigateur. Aucun backend,
framework applicatif, changement des versions runtime ou migration TS
generale. Les changements sans preuve restent hors scope.
