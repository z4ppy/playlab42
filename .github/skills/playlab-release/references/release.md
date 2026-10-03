# Matrice de validation

Les chemins sont relatifs à la racine du dépôt. Lire les scripts et cibles
actuels avant d'utiliser ces exemples ; remplacer les chemins de module.
Exécuter uniquement dans un rôle autorisé à utiliser Docker.

| Périmètre | Première validation pertinente |
|---|---|
| Documentation/skills seuls | Relire liens, frontmatter, exemples et JSON ; pas de build applicatif inutile |
| Moteur d'un jeu | `make npm CMD="test -- --runTestsByPath games/mon-jeu/engine.test.js"` |
| Helpers DOM/thème | `make npm CMD="test -- --runTestsByPath lib/dom.test.js lib/theme.test.js"` |
| JS modifié | `make npm CMD="exec -- eslint chemin/du/fichier.js --max-warnings=0"` |
| Scripts HTML | ESLint ciblé sur le HTML, test de politique `scripts/source-lint.test.js`, puis interaction navigateur ; le markup n'est pas linté |
| Sécurité JS et scripts HTML | `make npm CMD="run lint:security"` ; diagnostics consultatifs séparés, pas de verdict global |
| Manifeste tool/game | `make build-catalogue` |
| Epic/slides | `make build-parcours` puis parcours dans le viewer |
| Logique de parcours | `make npm CMD="test -- --runTestsByPath scripts/parcours-utils.test.js"` |
| TypeScript | `make npm CMD="run lint:ts"`, `make typecheck`, tests affectés et `make build-ts` |
| Interaction navigateur | `make test-e2e` |
| Préparation locale sans enrichissement OG | `make npm CMD="run build:local"` ; production utilise un snapshot revu sans collecte |
| Transport/refresh éditorial OG | Tests `scripts/og-fetcher.test.js`, `scripts/og-fetcher-process.test.js`, `scripts/build-bookmarks-offline.test.js` ; refresh réseau uniquement s'il est autorisé, puis relire snapshot/images |
| Artefact/provenance/reprise | `scripts/artifact-integrity.test.js`, `make npm CMD="run verify:site"`, `make npm CMD="run check:recovery"` ; comparer deux builds avec mêmes sources/outils/epoch |
| Gates CI/sécurité/forks | `scripts/ci-security-gates.test.js`, `scripts/quality-policy.test.js`, `scripts/pinned-chain.test.js`, `scripts/software-delivery.test.js`, `scripts/build-security-report.test.js` ; puis lint des tests et OpenSpec |
| Helpers/builders/cache JSON | Tests `scripts/build-utils.test.js`, `scripts/build-input-errors.test.js`, `scripts/og-quality.test.js`, `scripts/quality-lint.test.js`, puis couverture ciblée requise ; pas de baisse de seuil |
| Livraison complète | `make lint`, `make npm CMD="run test:coverage"`, `make typecheck`, `make npm CMD="run audit:dependencies"`, OpenSpec et build selon AGENTS/CI |

Ne pas supposer qu'un test existe : vérifier son chemin avant de le cibler.
La CI normale utilise le snapshot OG ; `build:local` omet cet enrichissement.
Ne pas exécuter un refresh éditorial juste pour verdir une fabrication.
Le build complet prépare `site/`. La CI navigateur teste l'archive publique
extraite avec `PLAYWRIGHT_PREBUILT=1` ; ne pas reconstruire cette archive avant
de la déclarer validée. La publication réutilise la CI et cette même archive.
Le check distant déjà requis `Build` exige les succès Security lint et Trivy :
son guard s'exécute même après un échec et refuse aussi skipped/cancelled, avant
fabrication. Ne pas remplacer ce refus explicite par un simple `needs`, ni
annoncer des checks distants supplémentaires : les neuf checks de main sont
inchangés. Trivy est partagé entre CI et audit ; vérifier les noms de rapports
distincts et le maintien du scan vuln/secret HIGH/CRITICAL avec devDependencies.
Pour un fork, artefact et summary restent produits, mais pas de commentaire PR
avec un token public en lecture seule. Les contrats locaux ne prouvent ni une
CI native ni une durée sur runner ; mesurer le nouveau chemin critique après
autorisation de livraison.
Vérifier les images locales réellement référencées, pas seulement les hashes :
le cache OG ignoré ne doit pas entrer dans l'archive. Une nouvelle image OG
utilise son URL distante, sauf revue et versionnement local explicites.
Le smoke HTTP vérifie ensuite le SHA publié et les empreintes lockfile/snapshot
du manifeste, sans rollback automatique. `MERGED` dans une branche intermédiaire
ne signifie pas livré à main. Avant chaque merge empilé, vérifier la base
effective et recibler l'enfant vers main après livraison du parent.
Après squash, vérifier le contenu attendu plutôt que la seule ancestralité :
diff main, contrôles du commit publié, manifeste et identité HTTP.
La SBOM npm décrit la fabrication, pas tout le runtime du navigateur.
L'inventaire est hashé mais non signé ; consulter le
[runbook](../../../../docs/guides/artifact-operations.md) avant récupération.
Tester une reprise locale n'autorise aucun redéploiement en production.
Si le travail est terminé mais que le processus reste vivant, examiner minuteurs
et corps HTTP abandonnés ; ne pas ajouter de sortie forcée. Un test de transport
doit couvrir la lecture du corps et la sortie naturelle, pas seulement un mock
qui résout les en-têtes. Comparer la durée native sans retirer de gate.
Pour une vérification manuelle, `make serve` lance le serveur et `make info`
affiche le port du worktree. Ne pas coder un port local fixe.

## Sources de vérité

- `AGENTS.md` : Docker-first, français, branches, code et TypeScript.
- `Makefile`, `package.json` : commandes réellement disponibles.
- `.github/workflows/ci.yml` : exigences CI ; lire aussi le workflow navigateur
  présent dans `.github/workflows/` plutôt que supposer le nom de son job.
- `.github/workflows/deploy.yml` : déclencheurs et build GitHub Pages.
- `docs/guides/software-factory.md` : garanties réelles et améliorations restantes.
- `docs/guides/software-quality.md` : conception, revue et seuils ciblés.
- `.github/PULL_REQUEST_TEMPLATE.md` : forme de la PR.
- `docs/guides/contributing.md`, `docs/guides/contribution-kit.md` :
  workflow contributeur et fichiers attendus.
- `openspec/AGENTS.md` : proposition, implémentation, archivage après déploiement.

Pour une référence d'action/image/scanner, vérifier la valeur officielle puis
les contrats d'épinglage et l'exécution de l'outil. Un SHA/digest/checksum n'est
pas une preuve de conformité SLSA. Ne pas exécuter un téléchargement avant sa
vérification. Biome fournit le lint `.ts` sans peer du compilateur ; les peers
typescript-eslint restent incompatibles. `make typecheck` est complémentaire,
pas un substitut. Aucun plugin de sécurité ESLint n'est exécuté sur TS.

## Inspection Git et branche

L'inspection `git status --short`, `git branch --show-current` et `git diff`
ne lance pas le runtime applicatif. Les opérations distantes et mutations Git
restent soumises aux permissions du rôle.
Dans un clone classique, une nouvelle contribution peut utiliser
`git switch -c feat/mon-contenu` depuis la base correcte ; ne pas le faire dans
un dépôt bare. Lire les consignes workspace pour les chemins de worktrees et
ne jamais exposer un jeton dans une URL de remote.
