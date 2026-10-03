## Why

La demande « finalizes le lot1 […] une PR […] attaques le lot2 […] corriger
l'existant à chaque étape » autorise ce lot dans un worktree empilé distinct.
Le lot 1 est proposé dans la PR #135, pas encore livré sur main.

Les scanners installés à la volée, les tags d'actions et images mobiles et les
commandes de lint de sécurité incompatibles avec la configuration actuelle
affaiblissent la reproductibilité et la fidélité des contrôles.

## What Changes

- Verrouiller les plugins de sécurité npm et utiliser une configuration ESLint
  flat avec règles vérifiées, périmètre réel et gate explicite.
- Épingler les actions par SHA et les images de développement/navigateur par digest.
- Installer les scanners versionnés après vérification du checksum, sans
  téléchargement directement extrait ni installation mutable via apt.
- Séparer diagnostics consultatifs et contrôles bloquants, corriger les
  commandes locales et les rapports trompeurs.
- Échapper les termes associés du glossaire, qui doivent être affichés comme
  texte et non interprétés comme HTML, avec régressions de rendu.
- Corriger la minification JSON écrasée par l'auto-formatage différé, reproduite
  pendant la validation navigateur, sans masquer le défaut par une attente.
- Documenter les exceptions et la mise à jour des références dans les guides
  et skills existants, sans procédure concurrente.

## Capabilities

### New Capabilities

- `quality-toolchain`: références immuables, contrôles fidèles et maintenance.

### Modified Capabilities

Aucune exigence canonique existante n'est supprimée. Les contrôles se complètent.

## Impact

Workflows, Dockerfiles, Dependabot, plugins/lockfile, lint de sécurité, cibles
Make, documentation et tests. Pas de downgrade TypeScript ni dépendance forcée :
le parser typescript-eslint disponible exclut TS 7 de ses peers, donc le lint TS
reste un chantier identifié avec contrôle strict tsc maintenu.
Aucun merge, déploiement ou archivage n'est demandé.
