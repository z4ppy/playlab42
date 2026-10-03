# Pipelines CI/CD

Sources de vérité : fichiers sous `.github/workflows/`, `package.json` et
`Makefile`. Node **26**, installation par `npm ci`. Les commandes locales
s'exécutent dans Docker ; les runners GitHub sont des environnements CI isolés.

## Déclencheurs et dépendances

| Workflow | Déclenchement | Rôle |
|----------|---------------|------|
| `ci.yml` | PR vers `main`, manuel, appel réutilisable | Validation et archive publique |
| `deploy.yml` | Push `main`, manuel | Appelle CI, puis publie et contrôle le site |
| `ui-e2e.yml` | Appel depuis CI, manuel | Interactions Chromium |
| `security-audit.yml` | Push/PR vers `main`, quotidien 6 h UTC, manuel | Audits et rapport séparés |

Une PR ne déploie pas de site. Un push `main` appelle CI **via Deploy**, sans
second déclenchement indépendant de CI. Le lancement manuel de Deploy hors
`main` échoue.

## CI

| Job | Commande / dépendance | Échec |
|-----|----------------------|-------|
| Lint | `npm run lint` | Erreurs et avertissements ESLint |
| Tests | `npm run test:coverage`, puis Codecov | Tests ou seuils ciblés échoués ; upload Codecov non bloquant |
| Dependency audit | `npm run audit:dependencies` | CVE modérée ou plus ; panne d'audit également bloquante |
| TypeScript | `npm run typecheck` | Erreurs de types ; la transpilation appartient à Build |
| OpenSpec | `npm run openspec:validate` | Validation stricte des specs/changes |
| Build | `npm run build`, archive `site/` | Build ou upload de l'archive |
| Browser | Attend Build, appelle `ui-e2e.yml` avec `prebuilt: true` | Test navigateur échoué |

Tous les jobs sauf Browser peuvent commencer en parallèle. Browser attend
l'archive Build. Un succès du job Build seul ne signifie pas que toute la CI est verte.
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

Le workflow de sécurité complémentaire reste indépendant. L'audit npm est aussi
un job requis de la CI appelée avant publication.
Il faut distinguer les codes de sortie des outils de leur caractère obligatoire
avant un merge, qui dépend des règles GitHub.
Les permissions par défaut sont `contents: read` ; seuls Docker/SARIF et le
rapport/commentaire PR reçoivent les droits d'écriture nécessaires.

| Contrôle | Politique versionnée |
|----------|----------------------|
| npm audit | Échec au niveau modéré et au-dessus |
| Gitleaks | Analyse de l'historique ; détection = échec |
| ESLint Security | Erreurs affichées, mais converties en avertissement du job |
| Trivy | Rapports vulnérabilités/secrets/configuration, pas de `--exit-code` dédié |
| Packages obsolètes | Informatif |
| Hadolint | Push/manuel seulement, `no-fail: true` |
| Rapport | Attend les six analyses, `if: always()`, états réels des jobs ; artefact et commentaire PR |

Le rapport ne déduit pas un succès d'un fichier absent et distingue échec,
annulation, analyse ignorée et succès consultatif. Les logs et artefacts conservent
les diagnostics détaillés ; ce résumé ne certifie pas l'absence de problème.

Les versions de scanners ne sont pas toutes épinglées : Gitleaks est téléchargé
depuis la dernière release et les plugins ESLint sont ajoutés sans version.
Ce sont des limites de reproductibilité, pas une preuve d'analyse complète ou
une liste de vulnérabilités confirmées.

## Dépendances et couverture

- Dependabot : npm, GitHub Actions et Docker, chaque lundi à 6 h Europe/Paris.
  La configuration regroupe les mises à jour npm mineures/patch et limite les PR.
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

## Vérifier avant une PR

```bash
make lint
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
sans les présenter comme une CI complète. `build:local` n'exécute pas la
collecte Open Graph du build de production.

## Évolution

Une nouvelle garantie de livraison se décrit avec le workflow
[OPSX](../../docs/guides/openspec-workflow.md), les tests de contrat des workflows
et une observation de la CI native après PR. Ne pas inventer un check réussi
sur la seule présence d'une étape YAML.

La [feuille de route de l'usine](../../docs/guides/software-factory.md#aller-plus-loin--ce-qui-manque-encore)
sépare les améliorations proposées des garanties automatisées.

Actualisé le 3 octobre 2026.
