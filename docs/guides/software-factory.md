# L'usine logicielle Playlab42

Une usine logicielle n'est pas une liste d'outils. C'est un **chemin cohérent de
la demande jusqu'à une livraison vérifiée**, avec des conventions partagées,
des contrôles fiables et un retour sur ce qui fonctionne ou reste difficile.

Playlab42 en fournit une version pédagogique : une application 100 % statique,
Docker pour développer, OpenSpec pour clarifier les besoins, skills et kit pour
contribuer, GitHub Actions pour vérifier, GitHub Pages pour publier.
Il n'est pas nécessaire d'ajouter Kubernetes, un backend ou une plateforme
d'orchestration pour bénéficier de ces pratiques.

Ce guide décrit le code versionné et les réglages observés le **3 octobre 2026**.
Une correction préparée dans une branche n'est disponible en production qu'après
livraison ; un fichier de workflow ne constitue pas une preuve d'exécution réussie.

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

### CI et publication

Sur une PR, `ci.yml` exécute lint, Jest/coverage, types, audit npm requis, validation OpenSpec stricte,
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
ce SHA et contrôle neuf ressources, dont les catalogues et des points d'entrée.
Une erreur finale rend le workflow rouge, mais ne retire pas le site déjà publié.
Cette identité n'est pas une provenance signée ni une attestation SLSA.

### Ce qui reste distinct

- La validation OpenSpec vérifie la **structure des exigences**, pas le code.
- Les tests navigateur couvrent un socle d'interactions dans Chromium, pas tous
  les navigateurs, contenus, inférences ML ou qualités audio.
- Le build production conserve la collecte Open Graph distante ; `build:local`
  est sans cette collecte, et ne prouve pas son succès.
- L'audit npm au seuil modéré est requis par la CI de livraison. Le workflow
  complémentaire reste séparé : Gitleaks peut échouer, d'autres outils restent
  consultatifs. Le rapport distingue les états des jobs, pas « aucun problème »
  lorsqu'un résultat manque. Aucun rapport ne garantit l'absence de défaut.
- Les seuils Jest ciblent SeededRandom, packaging et smoke ; il n'y a pas de
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
| Haute | npm requis, audits complémentaires encore partiellement consultatifs | Moderniser les analyses, définir les gates et exceptions datées ; ne jamais annoncer une analyse non exécutée comme réussie |
| Moyenne | Seuils ciblés sur trois composants, pas sur tout le code | Étendre progressivement aux moteurs et modules partagés, puis contrôler le code modifié avec des tests de comportement |
| Moyenne | Tags d'actions, image Node et outils d'audit évolutifs | Épingler les références critiques (SHA/digest/version vérifiée), conserver Dependabot et une procédure de mise à jour |
| Moyenne | Collecte OG mêlée au build de production | Séparer actualisation éditoriale et fabrication ; tester qu'un snapshot produit le même contenu sans réseau |
| Moyenne | Pas de prévisualisation de PR publiée | Donner aux reviewers une URL temporaire, sur une origine adaptée, sans secrets ni privilèges de production |
| Moyenne | Contrôle après livraison ponctuel, récupération manuelle | Ajouter vérifications périodiques, notification explicite et exercice de récupération d'une version connue |
| Progressive | Identité simple, pas de SBOM ni provenance signée dans la chaîne | Produire l'inventaire des composants et une attestation vérifiable liée à l'archive ; ne pas annoncer de niveau SLSA sans conformité vérifiée |
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
