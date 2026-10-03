# PlayLab42 — Guide et usine logicielle

Parcours débutant actualisé le **3 octobre 2026**, depuis `main` (`407dd25`), puis
complété avec les corrections de livraison de ce worktree. Il distingue code
préparé, livraison réelle et améliorations proposées, sans inventer de backend.

## Organisation

Les **11 étapes**, pour environ **60 minutes**, couvrent :

| Section | Contenu |
|---------|---------|
| Utiliser et comprendre | Portail, démarche OPSX et architecture de l'application statique |
| Contribuer | Outils, jeux et bots avec les conventions actuelles |
| L'usine logicielle | Specs et skills, kit de contribution, contrôles de qualité et CI, publication |
| Aller plus loin | Synthèse, exercice, limites et feuille de route documentée |

Les sept identifiants historiques sont conservés. Les nouvelles étapes se placent avant la conclusion `07-aller-plus-loin` ; les liens profonds et les slides déjà visitées restent identifiables.

## Sources et limites

- [Conventions du dépôt](../../../AGENTS.md), source commune des agents et skills.
- [Workflow OpenSpec](../../../docs/guides/openspec-workflow.md), version locale épinglée **1.14.0**, profil `core` en skills seuls.
- [Skills de projet](../../../docs/guides/project-skills.md) et [kit de contribution](../../../docs/guides/contribution-kit.md).
- [CI](../../../.github/workflows/ci.yml), [tests navigateur](../../../.github/workflows/ui-e2e.yml), [audit](../../../.github/workflows/security-audit.yml) et [publication](../../../.github/workflows/deploy.yml).
- [Documentation officielle OpenSpec 1.14.0](https://github.com/Fission-AI/OpenSpec/tree/v1.14.0/docs).
- [Guide de l'usine logicielle](../../../docs/guides/software-factory.md), sources DORA, CNCF, SLSA et GitHub.
- [Qualité logicielle](../../../docs/guides/software-quality.md), contrôles bloquants et procédure de revue.

Les slides décrivent les workflows versionnés, pas des règles de protection de branche supposées. Les commandes génériques d'OpenSpec sont distinguées des skills effectivement disponibles dans Playlab42. La synchronisation et l'archivage attendent la livraison et une décision explicite ; aucune intégration n'est régénérée par ce parcours.

Le fil rouge `hello-usine` est un exemple pédagogique : ce parcours ne crée pas cet outil et ne présente pas son code comme livré.

Le change actif `harden-software-factory-delivery` décrit la CI réutilisable,
l'archive publique testée puis publiée et le smoke HTTP.
`enforce-software-quality-baseline` ajoute l'audit npm requis, les seuils ciblés
et le skill de revue. Une protection classique de `main` a ensuite été activée
sur autorisation : PR et neuf checks requis après observation de la PR #135, sans bypass admin. La revue
indépendante attend un second reviewer. L'extension des seuils, prévisualisations,
provenance signée et surveillance périodique restent proposées.

## Présentation et validation

Les styles sont locaux (`playlab-guide.css`) et utilisent le thème et les primitives partagés. Les exercices utilisent des éléments `<details>` natifs, sans JavaScript ni CDN supplémentaire. Le contenu se lit en thème clair, sombre ou système, sur desktop et mobile.

Depuis ce worktree, dans Docker :

```bash
make up
make npm CMD="run build:local"
make npm CMD="test -- --runInBand --runTestsByPath scripts/playlab-guide.test.js scripts/parcours-utils.test.js"
make npm CMD="run test:e2e -- e2e/learning.spec.js e2e/playlab-guide.spec.js"
make lint
make typecheck
```
