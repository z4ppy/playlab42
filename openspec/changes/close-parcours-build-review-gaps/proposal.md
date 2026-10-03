## Why

La revue reproduit deux succès trompeurs : un outil simple privé de HTML est
ignoré et un HTML produit depuis Markdown n'est plus actualisé au second build.
La demande explicite d'implémentation du 3 octobre 2026 autorise ces corrections
dans le worktree partagé, sans commit, publication, merge ni mutation GitHub.

## What Changes

- Faire de l'absence de HTML d'un outil simple une erreur collectée bloquante,
  même en présence d'autres outils valides, sans remplacer le catalogue.
- Marquer explicitement les HTML générés depuis `index.md` et les régénérer
  à chaque build avec le Markdown, le titre et le template courants.
- Refuser les paires Markdown/HTML non marquées plutôt que deviner la source
  ou écraser du contenu auteur ; documenter la migration des sorties legacy.
- Bloquer le Markdown sans template et les sorties marquées sans leur source.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `parcours` : propriété explicite des sorties Markdown et reconstruction.
- `catalogue` : absence de point d'entrée HTML bloquante pour tous les outils.

## Impact

Scripts builders, tests CLI dédiés et guides création d'epic/build catalogue.
Aucune nouvelle configuration, dépendance ou modification de workflow.
Les HTML seuls restent des sources auteur. Les anciennes paires non marquées
doivent choisir leur source explicitement ; aucun `index.md` n'est actuellement
présent dans les parcours du dépôt. Le tableau historique de la spec catalogue
annonçant un warning pour le HTML absent sera remplacé lors de la synchronisation
après livraison ; ce delta impose désormais une erreur bloquante.
