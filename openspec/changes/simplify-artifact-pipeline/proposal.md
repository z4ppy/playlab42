## Why

Le 4 octobre 2026, l'utilisateur confirme la fusion #150 et demande de
poursuivre. Le rapport natif du main `d4c55d2`, run `37205096915`, conserve
58 clones et 53 fonctions de production JS/HTML > 10, aucune > 20.
La fabrication contient quatre responsabilités au-dessus de 10 :
vendors (20), assemblage du site (17), vérification (17) et images (12).

## What Changes

- Caractériser les fichiers, manifestes, licences, erreurs et ordre des effets
  des vraies fonctions avant extraction.
- Simplifier ces responsabilités avec peu de helpers cohérents et les
  utilitaires existants lorsque leurs contrats sont réellement compatibles.
- Conserver les versions, octets publics, règles de publication, provenance,
  contrôles d'intégrité, reprise et erreurs visibles.
- Protéger les sources réelles et comparer les mêmes outils et paramètres ;
  ne pas mutualiser artificiellement des clones CSS ou pédagogiques.

## Impact

Scripts de fabrication/vérification, tests et budgets ciblés, guides et
parcours associés. Nouveau worktree `quality/artifact-pipeline` depuis main.
La demande autorise l'implémentation ; pas de fusion, publication ou archivage
automatiques. Aucune dépendance ou infrastructure supplémentaire prévue.
