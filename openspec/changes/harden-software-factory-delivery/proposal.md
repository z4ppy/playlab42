## Why

La recherche du 3 octobre 2026 met en évidence un déploiement indépendant des
contrôles CI, une archive Pages préparée depuis la racine avec ses dépendances
de développement, et des guides qui promettent des garanties absentes.

La demande utilisateur « Corrige playlab42 et complete le document » autorise
l'implémentation dans ce worktree. Elle ne vaut ni autorisation de modifier les
protections GitHub, ni revue, merge, déploiement ou archivage.

## What Changes

- Réutiliser une seule CI pour les PR et la publication sur `main`.
- Valider lint, tests, types, OpenSpec et navigateur avant publication.
- Construire TypeScript avec le build complet et préparer un dossier public `site/`.
- Tester dans Chromium l'archive exacte qui sera déployée, sans reconstruction.
- Identifier le commit construit et contrôler la publication par un smoke test HTTP.
- Corriger les guides et compléter le parcours avec les limites et la feuille de route.
- Rendre les références utilisables depuis le lecteur sandboxé : onglets dédiés et
  navigation principale uniquement après activation utilisateur.

## Capabilities

### New Capabilities

- `software-delivery`: construction, validation, publication et traçabilité du site.

### Modified Capabilities

- `parcours`: ouvrir les références depuis les slides du lecteur sans navigation
  principale automatique. Aucune modification des règles des jeux ou du SDK.

## Impact

Workflows CI/UI/Pages, scripts de build et smoke test, configuration Playwright,
documentation contributeur, lecteur et parcours `hello-playlab42`. Les audits de sécurité
existants restent séparés ; les protections de branche et autres évolutions sont
documentées, pas annoncées comme configurées.
