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
| Manifeste tool/game | `make build-catalogue` |
| Epic/slides | `make build-parcours` puis parcours dans le viewer |
| Logique de parcours | `make npm CMD="test -- --runTestsByPath scripts/parcours-utils.test.js"` |
| TypeScript | `make typecheck` et `make build-ts` |
| Interaction navigateur | `make test-e2e` |
| Préparation locale sans collecte OpenGraph | `make npm CMD="run build:local"` |
| Livraison complète | `make lint`, `make npm CMD="run test:coverage"`, `make typecheck`, `make npm CMD="run audit:dependencies"`, OpenSpec et build selon AGENTS/CI |

Ne pas supposer qu'un test existe : vérifier son chemin avant de le cibler.
La CI complète peut effectuer un build des bookmarks avec accès réseau ;
`build:local` n'est pas la preuve de réussite de ce build de production.
Le build complet prépare `site/`. La CI navigateur teste l'archive publique
extraite avec `PLAYWRIGHT_PREBUILT=1` ; ne pas reconstruire cette archive avant
de la déclarer validée. La publication réutilise la CI et cette même archive.
Le smoke HTTP vérifie ensuite le SHA publié, sans rollback automatique.
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

## Inspection Git et branche

L'inspection `git status --short`, `git branch --show-current` et `git diff`
ne lance pas le runtime applicatif. Les opérations distantes et mutations Git
restent soumises aux permissions du rôle.
Dans un clone classique, une nouvelle contribution peut utiliser
`git switch -c feat/mon-contenu` depuis la base correcte ; ne pas le faire dans
un dépôt bare. Lire les consignes workspace pour les chemins de worktrees et
ne jamais exposer un jeton dans une URL de remote.
