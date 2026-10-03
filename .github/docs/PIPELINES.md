# Pipelines CI/CD

Sources de vérité : fichiers sous `.github/workflows/`, `package.json` et
`Makefile`. Node **26**, installation par `npm ci`. Les commandes locales
s'exécutent dans Docker ; les runners GitHub sont des environnements CI isolés.

## Déclencheurs et dépendances

| Workflow | Déclenchement | Rôle |
|----------|---------------|------|
| `ci.yml` | PR toute base, manuel, appel réutilisable | Validation et archive publique |
| `deploy.yml` | Push `main`, manuel | Appelle CI, puis publie et contrôle le site |
| `ui-e2e.yml` | Appel depuis CI, manuel | Interactions Chromium |
| `security-audit.yml` | Push `main`, PR toute base, quotidien 6 h UTC, manuel | Audits et rapport séparés |
| `trivy-scan.yml` | Appel depuis CI et Security Audit | Même scan bloquant et rapports nommés par appelant |

Une PR ne déploie pas de site. Un push `main` appelle CI **via Deploy**, sans
second déclenchement indépendant de CI. Le lancement manuel de Deploy hors
`main` échoue.

Les PR empilées sur une branche de contribution reçoivent les mêmes contrôles
automatiques ; elles ne déploient pas non plus. Les protections GitHub de `main`
restent distinctes du déclenchement des workflows.

## CI

| Job | Commande / dépendance | Échec |
|-----|----------------------|-------|
| Lint | `npm run lint` : ESLint JS/scripts HTML puis Biome `.ts` | Erreurs et avertissements bloquants ; tsc reste distinct |
| Security lint | `npm run lint:security`, rapport JSON | Règles JS/scripts HTML ciblées, pas TS ; sans installation à la volée |
| Trivy Security Scan | Appelle `trivy-scan.yml` | Vulnérabilités/secrets HIGH/CRITICAL, dépendances de développement incluses ; erreur d'outil bloquante |
| Tests | `npm run test:coverage`, puis Codecov | Tests ou seuils ciblés échoués ; upload Codecov non bloquant |
| Dependency audit | `npm run audit:dependencies` | CVE modérée ou plus ; panne d'audit également bloquante |
| TypeScript | `npm run typecheck` | Erreurs de types ; la transpilation appartient à Build |
| OpenSpec | `npm run openspec:validate` | Validation stricte des specs/changes |
| Build | Attend Security lint et Trivy, refuse tout statut différent de `success`, puis `npm run build`, archive `site/` | Gate sécurité, build ou upload de l'archive |
| Browser | Attend Build, appelle `ui-e2e.yml` avec `prebuilt: true` | Test navigateur échoué |

Les analyses, tests, types et OpenSpec peuvent commencer en parallèle. Build
attend seulement Security lint et Trivy ; Browser attend l'archive Build.
Build utilise `if: always()` et un premier guard Bash : `failure`, `skipped`,
`cancelled` ou un statut absent/inconnu donnent un **échec explicite avant checkout,
installation, fabrication ou archive**, pas un job Build ignoré. Un simple
`needs` laisserait Build ignoré après échec, état accepté par une protection
GitHub de check requis. Un succès de Build ne signifie pas que toute la CI est verte.
OpenSpec valide la structure des spécifications, pas la conformité du code.

## Navigateur

Le job installe Chromium compatible avec Playwright, extrait `github-pages`
dans `site/` et lance `npm run test:e2e` avec `PLAYWRIGHT_PREBUILT=1`.
Le serveur Playwright sert ce dossier **sans build supplémentaire**.

Un lancement manuel de UI browser utilise la préparation locale habituelle
`build:local` : il est utile au diagnostic, mais ne valide pas une ancienne
archive de release. Les commandes locales sont détaillées dans la
[stratégie de tests](../../docs/TESTING_STRATEGY.md).

En cas d'échec : rapport, captures et traces dans `ui-e2e-failure`, conservés
14 jours. La rétention de l'archive Pages est de 7 jours.

## Publication

```text
check-ref → validate (CI complète) → deploy → smoke
```

Le job de publication reçoit seul les permissions Pages et OIDC.
L'artefact `github-pages` provient du même run et n'est pas reconstruit.
Le smoke test contrôle le SHA publié et neuf ressources HTTP avec cinq
tentatives bornées. Il ne réalise ni rollback ni archivage OpenSpec.

Voir le [guide de déploiement](../../docs/DEPLOYMENT.md) pour le contenu public,
les limites, les réglages GitHub et la récupération après incident.

## Audits de sécurité : politique réelle

Le workflow de sécurité complémentaire reste indépendant. L'audit npm,
Security lint et le scan Trivy partagé sont aussi bloquants dans la CI appelée
avant publication et sur PR. Les noms de rapports Trivy sont distincts
(`ci-trivy-results`, `audit-trivy-results`) pour éviter une collision si les deux
appelants utilisent un même run.
Il faut distinguer les codes de sortie des outils de leur caractère obligatoire
avant un merge, qui dépend des règles GitHub.
Les permissions par défaut sont `contents: read` ; seuls Docker/SARIF et le
rapport/commentaire PR reçoivent les droits d'écriture nécessaires.

| Contrôle | Politique versionnée |
|----------|----------------------|
| npm audit | Échec au niveau modéré et au-dessus |
| Gitleaks | Analyse de l'historique ; détection = échec |
| ESLint Security | Gate ciblé avec configuration flat, plugins verrouillés ; diagnostics JSON, pas d'erreur masquée |
| Trivy | Workflow réutilisable commun ; un scan JSON par invocation, vulnérabilités/secrets HIGH/CRITICAL incluant devDependencies ; outil versionné/checksum vérifié, échec bloquant |
| Packages obsolètes | Informatif |
| Hadolint | Push/manuel seulement, deux Dockerfiles, `no-fail: true` ; consultatif |
| Rapport | Attend les six analyses, `if: always()`, états réels des jobs y compris Trivy réutilisé ; artefact et summary sur les forks aussi ; commentaire uniquement PR du même dépôt |

Le rapport ne déduit pas un succès d'un fichier absent et distingue échec,
annulation, analyse ignorée et succès consultatif. Les logs et artefacts conservent
les diagnostics détaillés ; ce résumé ne certifie pas l'absence de problème.
Le commentaire attend l'appel API : une erreur est explicite. Sur une PR de fork,
le token public est en lecture seule ; aucun commentaire n'est tenté, mais le
rapport reste archivé et ajouté au résumé du run. Aucun `pull_request_target`,
secret supplémentaire ou élévation globale n'est introduit.

Gitleaks 8.30.1 et Trivy 0.75.0 sont téléchargés par version puis vérifiés par
checksum avant extraction. Les actions sont épinglées par SHA ; images Node et
Playwright par digest. Les paquets OS installés et bases CVE restent évolutifs.
Ce n'est ni une build hermétique ni une signature/provenance SLSA.
Le scan de secrets utilise la redaction ; ne pas publier les valeurs détectées.
Les heuristiques de lint consultatives sont accessibles par
`npm run lint:security:advisory`, distinct du gate de publication.

## Dépendances et couverture

- Dependabot : npm, GitHub Actions et Docker, chaque lundi à 6 h Europe/Paris.
  La configuration regroupe les mises à jour npm mineures/patch et limite les PR.
  Les Dockerfiles de `/docker` sont aussi suivis.
- Codecov : cible projet automatique avec tolérance 1 %, cible patch 80 % avec
  tolérance 5 %, plage d'affichage 60–100 %.
- Les seuils Jest sont bloquants pour SeededRandom (100 %) et packaging/smoke
  (80 % lignes/statements/branches, 100 % fonctions). Aucun seuil global.
  Voir la [politique qualité](../../docs/guides/software-quality.md).
- Une protection classique de `main` a été activée sur autorisation et relue
  via l'API le 3 octobre 2026 : PR, neuf checks natifs après observation de la PR #135, branche à jour,
  discussions résolues et historique linéaire, y compris pour l'admin.
  Aucun force-push ni suppression. Zéro approbation externe obligatoire tant
  qu'un seul reviewer habilité est disponible. Voir le
  [réglage et la transition des noms de checks](../../docs/DEPLOYMENT.md#protection-de-main--activée-sur-github).
- La correction locale `close-ci-review-gaps` ne modifie **aucun réglage distant** :
  les neuf checks exacts restent `Lint`, `Tests`, `TypeScript`, `Build`,
  `Audit dépendances npm`, `Détection de secrets`, `Browser / Chromium interactions`,
  `OpenSpec` et `Dependency audit`. `Security lint` et Trivy ne deviennent pas
  des checks distants requis supplémentaires ; le check déjà requis **Build**
  agrège leur succès et ferme le trou de merge de Security lint.
  Cette couverture effective dépend de l'intégration des workflows corrigés ;
  les tests locaux ne suffisent pas à attester une CI native, fusion ou publication.
  La [preuve native datée de la PR](../../docs/guides/software-factory.md#livraison-constatée-et-correctifs-locaux)
  est désormais disponible ; elle ne constitue pas une livraison.

## Vérifier avant une PR

```bash
make lint
make security-eslint
make test
make npm CMD="run test:coverage"
make npm CMD="run audit:dependencies"
make typecheck
make openspec-validate
make npm CMD="run build:local"
make test-e2e
```

Pour un périmètre réduit, commencer par les sélecteurs pertinents de la
[matrice de validation](../skills/playlab-release/references/release.md),
sans les présenter comme une CI complète. Le build normal lit le snapshot OG ;
`build:local` omet cet enrichissement. Seul `refresh:bookmarks` autorise la collecte.

## Performance : mesurer avant de modifier les gates

La baseline native du lot 2 (run `37132029357`) prend 5 min 40 s dans Build.
Les métadonnées OG sont terminées à 15:06:46, mais le processus ne rend la main
qu'à 15:11:28 : environ 282 s sans travail utile. Le fetcher borne désormais
en-têtes **et corps** et libère les réponses abandonnées, notamment sur HTTP
en erreur. Les fixtures HTTP réelles terminent naturellement sous trois secondes,
sans `process.exit()` ni suppression d'analyse.

La fabrication de production locale corrigée a pris 35 s, avec 115 pages
enrichies, zéro entrée de cache et dix échecs explicitement signalés. Ce n'est
pas à elle seule une mesure native avant/après.
Le run natif `37134037265` confirme ensuite un job Build de **1 min 03 s**
contre **5 min 40 s** (environ 81 % de réduction) ; la commande de fabrication
passe de 315 s à 39 s. Tous les checks exécutés réussissent, navigateur inclus.
Les variations de réseau et de charge runner restent possibles.
Les installations isolées, le cache de téléchargement npm, les jobs parallèles,
tous les gates et le test de la même archive restent inchangés. Ne pas partager
`node_modules` entre Alpine et Ubuntu ; les modules natifs peuvent différer.
Ces mesures décrivent le build réseau historique. Le lot 5 sépare désormais
le refresh éditorial : la CI fixe SOURCE_DATE_EPOCH, compare deux manifestes,
vérifie les fichiers et exerce une restauration tar locale. Le navigateur
revérifie l'archive reçue sans la reconstruire. Mesurer le nouveau run, sans
présenter ces anciens timings comme ceux du pipeline changé.

La correction `close-ci-review-gaps` ajoute Trivy sur le chemin critique :
Build et Browser attendent le plus lent des deux gates de sécurité.
L'audit complémentaire conserve son invocation indépendante du même workflow ;
cela partage la logique, pas l'exécution ni la base téléchargée entre runs.
Installation et mise à jour CVE peuvent rallonger la CI ou échouer avec le réseau.
Les tests locaux de contrat ne mesurent pas cette durée native. Sur la première
CI de la PR #145 (head `a5598b2`, run `37148235271`), les jobs ont pris 14 s
pour Trivy, 21 s pour Build et 101 s pour Browser, soit 149 s entre le premier
départ et la dernière fin. C'est une seule observation, pas une comparaison
contrôlée ou un budget garanti ; suivre les prochains runs sans réduire les
seuils ni rendre le scanner consultatif.

## Évolution

Une nouvelle garantie de livraison se décrit avec le workflow
[OPSX](../../docs/guides/openspec-workflow.md), les tests de contrat des workflows
et une observation de la CI native après PR. Ne pas inventer un check réussi
sur la seule présence d'une étape YAML.

La [feuille de route de l'usine](../../docs/guides/software-factory.md#aller-plus-loin--ce-qui-manque-encore)
sépare les améliorations proposées des garanties automatisées.

Actualisé le 3 octobre 2026.
