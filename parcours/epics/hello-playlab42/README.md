# PlayLab42 — Guide et usine logicielle

Parcours débutant actualisé le **3 octobre 2026**. Sa première révision partait
de `main` (`407dd25`, référence historique) ; les lots 3 à 5 ont depuis été
intégrés à `main` et publiés via la PR #144. Il distingue code
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
provenance signée restent proposées. Le workflow de surveillance périodique
est intégré ; son exécution planifiée et ses notifications demandent des preuves distinctes.

Le lot 1 est intégré à `main` via la [PR #135](https://github.com/z4ppy/playlab42/pull/135)
(`b20c1e1`). Le change actif `pin-and-modernize-quality-toolchain`
décrit le lot 2 intégré via la PR #136 (`b55ecb9`) : lint de sécurité JS ciblé, références
immuables, scanners vérifiés, corrections du glossaire et du formateur JSON.
Les fusions précédentes sont des jalons historiques ; le déploiement et
l'archivage restent des décisions et observations distinctes.
Le lot 3 livré (`complete-source-lint-coverage`) fournit Biome 2.5.15 pour
les `.ts` et eslint-plugin-html 8.2.1 pour les scripts, corrige les sources
et migre les attributs événementiels. Le lot 4 livre les contrats de fabrication
et la persistance atomique ; le lot 5 livre le snapshot OG, l'inventaire/SBOM
non signé, le workflow de monitoring et la reprise locale.
La [preuve datée de livraison](../../../docs/guides/software-factory.md#livraison-constatée-et-correctifs-locaux)
référence la PR #144 et les runs de publication et sécurité réussis sur le
commit main livré. Les règles de sécurité ESLint restent limitées à JS/HTML
et le contrôle strict tsc demeure séparé. Les heuristiques consultatives
restent une dette de triage explicite.

Les correctifs de revue des builders, des images OG et du mode d'écriture
atomique issus de `fix/review-software-factory` sont intégrés à main et publiés
via la PR #145 ; la preuve datée distingue CI de PR et publication.
Le gate sur Build, déjà requis, exige le succès de Security lint et
Trivy HIGH/CRITICAL via un workflow réutilisable partagé, sans accepter un
gate ignoré. Le [plan qualité suivant](../../../docs/guides/software-quality.md#suite-proposée--qualité-du-code-par-étapes)
est proposé dans la PR #146. Son [application tests-first](../../../docs/guides/software-quality.md#application-tests-first)
est autorisée dans `quality/tests-first` : caractériser avant refactoring,
mesurer puis verrouiller les acquis. Ces nouveaux travaux ne sont pas encore livrés.
Les neuf checks GitHub requis ne sont pas les dix ressources HTTP
du smoke, qui incluent désormais le manifeste.
Aucun run cron réussi, rollback de production ou archivage OpenSpec n'est
déduit de la publication ; l'archivage nécessite une autorisation distincte.

## Présentation et validation

Les styles sont locaux (`playlab-guide.css`) et utilisent le thème et les primitives partagés. Les exercices utilisent des éléments `<details>` natifs, sans JavaScript ni CDN supplémentaire. Le contenu se lit en thème clair, sombre ou système, sur desktop et mobile.

Depuis ce worktree, dans Docker :

```bash
make up
make npm CMD="run build:local"
make npm CMD="test -- --runInBand --runTestsByPath scripts/playlab-guide.test.js scripts/parcours-utils.test.js"
make npm CMD="run test:e2e -- e2e/learning.spec.js e2e/playlab-guide.spec.js"
make lint
make security-eslint
make typecheck
```
