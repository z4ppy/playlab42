# L'usine logicielle Playlab42

Une usine logicielle n'est pas une liste d'outils. C'est un **chemin cohérent de
la demande jusqu'à une livraison vérifiée**, avec des conventions partagées,
des contrôles fiables et un retour sur ce qui fonctionne ou reste difficile.

Playlab42 en fournit une version pédagogique : une application 100 % statique,
Docker pour développer, OpenSpec pour clarifier les besoins, skills et kit pour
contribuer, GitHub Actions pour vérifier, GitHub Pages pour publier.
Il n'est pas nécessaire d'ajouter Kubernetes, un backend ou une plateforme
d'orchestration pour bénéficier de ces pratiques.

Ce guide décrit le code versionné et les réglages observés le **4 octobre 2026**.
Une correction préparée dans une branche n'est disponible en production qu'après
livraison ; un fichier de workflow ne constitue pas une preuve d'exécution réussie.

### Livraison constatée et correctifs locaux

Les lots 3 à 5 sont **intégrés à `main` et publiés** : la
[PR #144](https://github.com/z4ppy/playlab42/pull/144) a été fusionnée le
3 octobre 2026 à 18:24:44 UTC, au commit
`283b1cb359ef3363c7f70ef7fa0aef57a93ddc11`. Le
[run de publication 37144090802](https://github.com/z4ppy/playlab42/actions/runs/37144090802)
et le [run de sécurité 37144090475](https://github.com/z4ppy/playlab42/actions/runs/37144090475)
ont réussi sur ce commit. Cette preuve concerne cette livraison, pas les
modifications ultérieures du worktree `fix/review-software-factory`.

Les correctifs de revue des builders, de préservation des images OG et du mode
d'écriture atomique sont **intégrés à `main` et publiés** via la
[PR #145](https://github.com/z4ppy/playlab42/pull/145), fusionnée le 3 octobre
2026 au commit `8a643e8adf051d2ed92aee4ed40dd6ae0f574611`. Elle ajoute aussi un gate
sur **Build, déjà requis**, exigeant le succès de Security lint et de Trivy
HIGH/CRITICAL via un workflow réutilisable partagé ; un gate ignoré ne doit
pas autoriser la suite. La
[publication 37148586787](https://github.com/z4ppy/playlab42/actions/runs/37148586787)
et l'[audit 37148586535](https://github.com/z4ppy/playlab42/actions/runs/37148586535)
ont réussi sur ce commit. Les neuf checks GitHub requis restent le réglage
actuellement observé ; aucune mutation distante n'est impliquée.

**Validation native constatée le 3 octobre 2026, head `a5598b2` :**
[CI 37148235271](https://github.com/z4ppy/playlab42/actions/runs/37148235271)
et [Security Audit 37148235235](https://github.com/z4ppy/playlab42/actions/runs/37148235235)
réussis : 100 suites / 2 124 tests, seuils ciblés, lint, types, Trivy,
double fabrication/reprise et 64 interactions Chromium. L'upload Codecov
a réussi, mais il reste non bloquant. Cette preuve datée concerne ce head
fusionné ; chaque PR suivante doit vérifier les checks de sa propre tête.

La [suite qualité proposée](software-quality.md#suite-proposée--qualité-du-code-par-étapes)
part de cette branche de revue. Après sa fusion squash, sa branche de plan
a été réalignée sur main après vérification d'égalité des sources, pour ne pas
réintroduire les correctifs dans une nouvelle pile. La PR #146 décrivait la proposition, reprise dans `quality/tests-first`
avec tests de comportement avant refactoring. La
[PR #147](https://github.com/z4ppy/playlab42/pull/147) est maintenant
**intégrée à `main` et publiée**, au commit
`611a29bebe6409f5fb0e59413ff35f3d03751f92`. La
[publication 37153902594](https://github.com/z4ppy/playlab42/actions/runs/37153902594)
et l'[audit 37153902484](https://github.com/z4ppy/playlab42/actions/runs/37153902484)
ont réussi. Le plan #146 est fermé comme remplacé ; les preuves de la
dernière tête et de la livraison sont détaillées dans le guide qualité.

La suite `quality/core-refactors` a livré les corrections du cœur par priorité :
contrats moteurs et déterminisme, puis refactorings et mutualisations ciblées.
La PR #148 est intégrée à main `ef0a2aa` et publiée
([run 37162681481](https://github.com/z4ppy/playlab42/actions/runs/37162681481)).
La continuation `quality/duplication-complexity` est livrée via la PR #149,
au commit `72a8f5d` : refactorings mesurés et rapport explicite de
duplication/complexité. La [publication 37199116572](https://github.com/z4ppy/playlab42/actions/runs/37199116572)
et l'[audit 37199116386](https://github.com/z4ppy/playlab42/actions/runs/37199116386)
sont réussis. Le rapport de ce main contient encore six fonctions de production
JS/HTML > 20. La suite `quality/rendering-audio` est maintenant livrée via
la PR #150 au commit `d4c55d2` :
[publication 37205096915](https://github.com/z4ppy/playlab42/actions/runs/37205096915)
et [audit 37205096724](https://github.com/z4ppy/playlab42/actions/runs/37205096724)
réussis. Il reste 53 fonctions JS/HTML > 10, aucune > 20, et 58 clones.
`quality/artifact-pipeline` a livré cette simplification via la PR #151
sur main `a54954c` : [publication 37209561127](https://github.com/z4ppy/playlab42/actions/runs/37209561127)
et [audit 37209560905](https://github.com/z4ppy/playlab42/actions/runs/37209560905)
réussis, 49 fonctions > 10 et 58 clones.
`quality/application-contracts` poursuit ensuite les contrats d'orchestration
et protections applicatives en scopes parallèles ; cette continuation n'est
pas encore livrée et ne promet pas une base « parfaite ». Elle ajoute des budgets
de production bloquants pour Build et un smoke Chromium/Firefox/WebKit dans le
check Browser existant ; les détails et limites restent dans le
[bilan applicatif](software-quality.md#contrats-et-qualité-applicative).

## Carte de l'usine

| Étape | Brique Playlab42 | Preuve / décision |
|-------|-----------------|-------------------|
| Comprendre | Demande, specs existantes, exploration | Périmètre et contraintes explicites |
| Spécifier | OpenSpec/OPSX : proposal, specs, design, tasks | Scénarios observables et autorisation d'implémenter |
| Préparer | `AGENTS.md`, skills et `scaffold` | Conventions communes, module et manifests valides |
| Réaliser | HTML/CSS/JS, TS optionnel, composants partagés | Diff ciblé et tests du comportement |
| Vérifier | Docker, Jest, types, lint, navigateur, OpenSpec | Résultats réels, pas cases cochées par anticipation |
| Relire | PR, CI et humain | Décision de merge distincte du succès des tests |
| Publier | CI réutilisée, archive testée et Pages | Même commit et même artefact |
| Contrôler | `build-info.json`, smoke HTTP | Identité et ressources effectivement accessibles |
| Capitaliser | Docs, retour d'expérience, sync/archive | Livraison constatée et décision explicite |

## OpenSpec et agents : les bonnes frontières

OpenSpec 1.14.0 est un CLI local épinglé, exécuté dans Docker. Le schéma
`spec-driven` organise quatre artefacts ; les tâches dépendent des specs et du
design, mais les travaux indépendants peuvent avancer en parallèle.

Les six skills `openspec-*` et cinq skills métier `playlab-*` vivent dans
`.github/skills/`. Le lien `.claude/skills` expose la même source à Claude.
Il ne crée pas de commandes `/opsx:*`. Le skill officiel `openspec-propose`
s'arrête à la planification ; l'implémentation demande l'autorisation prévue.
Ne pas régénérer les intégrations avec `init --force` ou `update` dans le dépôt.

Un skill est une procédure de travail, **pas un droit d'accès ni un moteur
d'exécution**. Il ne donne pas l'autorisation de pousser, merger, publier ou
archiver. Il ne remplace ni une revue humaine ni une observation navigateur.
Lire le [workflow OPSX](openspec-workflow.md) et les
[skills de projet](project-skills.md) pour les procédures détaillées.

## Le chemin recommandé pour contribuer

Le kit est un chemin de démarrage réutilisable (« golden path »), pas une
obligation de produire un module complexe. Exemple **illustratif** :

```bash
make info
make openspec-list
make scaffold TYPE=tool ID=hello-usine TITLE="Hello usine"
make npm CMD="run build:local"
make serve
```

`hello-usine` n'est pas livré par ce guide. Avant de générer un module qui change
le comportement, préparer le change OpenSpec et consigner le périmètre autorisé.
Puis personnaliser le code, les manifests et les tests, observer le résultat,
ouvrir une PR et suivre les décisions humaines.

### Quand peut-on dire « terminé » ?

- Le code et les contenus répondent aux scénarios demandés.
- Les tests pertinents passent ; les validations non exécutées sont signalées.
- Les erreurs restent visibles, les thèmes et contrôles clavier sont utilisables.
- Les guides et sources de référence sont cohérents avec le changement.
- La PR indique les résultats, risques et limites ; un succès local n'est pas
  annoncé comme une CI GitHub réussie.
- « Préparé », « commité », « PR ouverte », « mergé » et « publié » sont des états
  différents. L'archive OpenSpec attend la livraison et une décision explicite.

## Les garanties automatisées

### CI et publication livrées

Sur une PR, `ci.yml` exécute lint qualité et sécurité JS ciblée, rapport Code quality
(duplication et complexité), Jest/coverage, types, audit npm requis, validation OpenSpec stricte,
build et navigateur. Sur push `main`, `deploy.yml` appelle cette même CI dans
son run et attend son succès avant publication. Un lancement manuel hors `main`
échoue explicitement.

Le build inclut TypeScript, les bibliothèques runtime, les catalogues, les guides
et le packaging public `site/`. L'archive `github-pages` est testée dans Chromium
**sans reconstruction**, puis publiée telle quelle. La sortie publique exclut
les dépendances npm, tests, caches et configurations d'agents. Les fichiers
réservés au dépôt sont accessibles par les liens GitHub du lecteur documentaire.

### Identité et contrôle après publication

`build-info.json` indique la version et le SHA CI. Le smoke test HTTP compare
ce SHA et contrôle **dix ressources HTTP**, distinctes des **neuf checks GitHub
requis**. Le manifeste est la dixième ressource ajoutée au contrat de smoke :
il vérifie l'identité et les empreintes lockfile/snapshot attendues, pas tous
les hashes des fichiers distants.

| Ressource contrôlée | Rôle |
|---------------------|------|
| `build-info.json` | Version et commit publiés |
| `build-manifest.json` | Identité et empreintes des entrées attendues |
| `index.html` | Portail |
| `docs/site/index.html` | Lecteur documentaire |
| `data/catalogue.json` | Catalogue des outils et jeux |
| `data/parcours.json` | Catalogue des parcours |
| `data/bookmarks.json` | Catalogue des bookmarks |
| `catalogue.tools[0].path` | Point d'entrée du premier outil |
| `catalogue.games[0].path` | Point d'entrée du premier jeu |
| `${epic.path}/slides/${slide.id}/index.html` | Première slide du premier parcours |

Une erreur finale rend le workflow rouge, mais ne retire pas le site déjà publié.
Cette identité n'est pas une provenance signée ni une attestation SLSA.

### Ce qui reste distinct

- La validation OpenSpec vérifie la **structure des exigences**, pas le code.
- Les tests navigateur couvrent un socle d'interactions dans Chromium, pas tous
  les navigateurs, contenus, inférences ML ou qualités audio.
- Le build normal utilise le snapshot OG versionné ; le refresh éditorial est
  explicite. Deux fabrications et les empreintes sont comparées en CI.
  Le manifeste/SBOM et la reprise locale sont décrits dans le
  [runbook](artifact-operations.md), sans signature ni garantie hermétique.
- L'audit npm au seuil modéré et le lint sécurité JS ciblé sont requis par la CI
  de livraison. Le workflow complémentaire reste séparé : Gitleaks et Trivy
  HIGH/CRITICAL peuvent échouer, Hadolint et les heuristiques lint restent
  consultatifs. Le rapport distingue les états des jobs, pas « aucun problème »
  lorsqu'un résultat manque. Aucun rapport ne garantit l'absence de défaut.
- Les seuils Jest ciblent SeededRandom, packaging, smoke, portail, moteurs et Simulation ; il n'y a pas de
  seuil global ni de contrôle bloquant universel du code modifié. L'envoi Codecov
  est non bloquant. Voir le [guide qualité et son plan](software-quality.md).
- Sur autorisation ultérieure, une protection classique de `main` a été activée
  et relue via l'API : PR et neuf checks natifs requis, y compris pour l'admin.
  Il n'y a pas encore d'approbation indépendante obligatoire, faute de second
  reviewer habilité. Voir le [réglage précis](../DEPLOYMENT.md#protection-de-main--activée-sur-github).

Voir [les pipelines](../../.github/docs/PIPELINES.md),
[les tests](../TESTING_STRATEGY.md) et [le déploiement](../DEPLOYMENT.md).

## Aller plus loin : ce qui manque encore

Cette liste est une **feuille de route**, pas une promesse de fonctionnalités
déjà livrées. Les priorités sont adaptées à un support de formation.

| Priorité | État / point restant | Évolution utile et critère observable |
|----------|----------------------|----------------------------------------|
| Haute | `main` protégée : PR et neuf checks requis ; noms constatés sur la PR #135 | Ajouter un second reviewer, exiger une approbation et vérifier les noms après évolution du pipeline |
| Haute | npm et lint sécurité JS ciblé requis ; Trivy et Gitleaks séparés ; heuristiques consultatives | Trier les diagnostics, étendre les gates justifiés et revoir les exceptions datées ; pas de faux succès |
| Moyenne | Seuils ciblés et complexité critique, pas sur tout le code | Étendre progressivement aux moteurs et modules partagés, puis contrôler le code modifié avec des tests de comportement |
| Moyenne | Actions SHA, images digest et binaires scanners vérifiés dans le lot 2 ; bases/paquets OS évolutifs | Maintenir ces références avec Dependabot ; isoler ensuite les sources de variabilité du build |
| Moyenne | Snapshot OG séparé du build ; refresh éditorial explicite | Relire ses changements, suivre les métadonnées absentes et conserver les preuves de reproductibilité |
| Moyenne | Pas de prévisualisation de PR publiée | Donner aux reviewers une URL temporaire, sur une origine adaptée, sans secrets ni privilèges de production |
| Moyenne | Smoke de publication réussi, workflow de monitoring quotidien intégré et reprise locale exercée | Constater séparément un run planifié, vérifier les notifications et définir responsable/cadence ; décider humainement d'une reprise en production |
| Progressive | SBOM de fabrication et manifeste hashé non signé | Ajouter une attestation signée de l'archive sur autorisation ; ne pas annoncer de niveau SLSA sans conformité vérifiée |
| Progressive | Retour d'expérience peu instrumenté | Mesurer durée des checks, délai de première contribution, erreurs récurrentes et livraison ; choisir peu d'indicateurs utiles |
| Progressive | Scénarios d'évaluation des skills partiels | Comparer des demandes identiques sur environnements isolés, conserver les preuves, compléter les cas non testés sans revendiquer un gain statistique |

Les premiers chantiers ne nécessitent aucun nouvel outil lourd : des réglages
GitHub, des tests, une documentation fiable et un runbook peuvent suffire.
Les évaluations légères de skills existent déjà ; il s'agit de les compléter,
pas de prétendre qu'elles sont absentes.

### Mesurer sans transformer les métriques en objectifs

DORA décrit aujourd'hui **cinq métriques** : délai du changement jusqu'en
production, fréquence des déploiements, temps de récupération d'un déploiement
échoué, taux d'échec des changements et taux de déploiements de reprise.
Elles servent à améliorer une même application au fil du temps, pas à classer
des personnes ou à exiger plusieurs publications quotidiennes d'un laboratoire.

Pour Playlab42, commencer par les frictions d'atelier : démarrage Docker,
premier module catalogué, erreurs de manifests, temps d'attente des checks.
Ajouter uniquement les mesures qui guident une amélioration concrète, sans
collecter les données personnelles des apprenants par défaut.

## Fondements et sources

Recherches consultées le 3 octobre 2026 :

- [DORA — Continuous delivery](https://dora.dev/capabilities/continuous-delivery/) :
  livrabilité continue, retours rapides, tests et déploiements fiables.
- [DORA — Five software delivery metrics](https://dora.dev/guides/dora-metrics/) :
  mesurer les résultats et éviter les objectifs détournés.
- [CNCF — Platform Engineering Maturity Model](https://tag-app-delivery.cncf.io/whitepapers/platform-eng-maturity-model/) :
  capacités partagées, parcours utilisateur et amélioration comme produit.
- [SLSA 1.2 — Build track](https://slsa.dev/spec/v1.2/build-track-basics) :
  identité/provenance, puis garanties croissantes de chaîne de construction.
- [GitHub — Secure use](https://docs.github.com/en/actions/reference/security/secure-use) :
  permissions minimales, références immuables et maintenance des workflows.
- [GitHub — Artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations) :
  établir et vérifier l'origine d'un artefact.

La source commune des conventions reste [AGENTS.md](../../AGENTS.md).
Ce guide n'est ni un audit de vulnérabilités, ni une certification, ni une
preuve de CI native ou de publication de la branche en cours.
