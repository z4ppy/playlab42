# Build des catalogues

Ce document décrit le workflow de génération des catalogues du projet Playlab42.

## Principe "as-code"

Les catalogues (`data/*.json`) sont **générés à partir des manifests sources** et ne doivent **jamais être modifiés manuellement**. Ils sont listés dans `.gitignore` et régénérés :
- En local lors du développement
- En CI/CD avant le déploiement

## Fichiers générés

| Fichier | Source | Script |
|---------|--------|--------|
| `data/catalogue.json` | `tools/*.json`, `games/*/game.json` | `build-catalogue.js` |
| `data/parcours.json` | `parcours/epics/*/epic.json` | `build-parcours.js` |
| `data/bookmarks.json` | `bookmarks/*.json`, manifests, `metadata/bookmarks-og.json` | `build-bookmarks.js` |

## Scripts de build

Tous les scripts sont dans `scripts/` et partagent des utilitaires via `scripts/lib/build-utils.js`.

### Commandes

```bash
# Build complet, dans Docker (make build construit l'image)
make npm CMD="run build"

# Builds individuels
docker compose exec dev npm run build:catalogue
docker compose exec dev npm run build:parcours
docker compose exec dev npm run build:bookmarks
make npm CMD="run refresh:bookmarks" # actualisation éditoriale, réseau autorisé
```

Le build normal lit le snapshot OG revu, sans réseau. Le refresh explicite
respecte la TTL du cache technique (sept jours), signale les échecs et réécrit
le snapshot à relire. `--skip-og` omet l'enrichissement, il n'est pas un refresh.
Une nouvelle URL sans métadonnées conserve ses champs manuels avec un warning.
Ne pas modifier les catalogues générés pour corriger une métadonnée :
modifier les sources/snapshot puis reconstruire. Voir
[fabrication et reprise](guides/artifact-operations.md).
Le build normal ne consulte pas les images du cache en repli. Le refresh
conserve une URL OG distante pour un nouveau téléchargement ignoré par Git,
ou l'image locale éditoriale déjà revue ; un échec conserve les métadonnées
précédentes. Le packaging refuse les images locales référencées absentes et
exclut les images non référencées du cache.

### Structure des scripts

```
scripts/
├── build-catalogue.js    # Génère le catalogue tools/games
├── build-parcours.js     # Génère le catalogue parcours
├── build-bookmarks.js    # Génère le catalogue bookmarks
├── parcours-utils.js     # Utilitaires spécifiques parcours
├── og-fetcher.js         # Fetch métadonnées OpenGraph
└── lib/
    └── build-utils.js    # Utilitaires partagés
```

## Workflow de développement

### Ajouter un outil

1. Créer `tools/mon-outil.json` (manifest)
2. Créer `tools/mon-outil.html` (contenu)
3. Lancer `npm run build:catalogue`

### Ajouter un jeu

1. Créer `games/mon-jeu/game.json` (manifest)
2. Créer `games/mon-jeu/index.html` (point d'entrée)
3. Lancer `npm run build:catalogue`

### Ajouter un parcours

1. Créer `parcours/epics/mon-parcours/epic.json` (manifest)
2. Créer les slides dans `parcours/epics/mon-parcours/slides/`
3. Lancer `npm run build:parcours`

## Validation

Les scripts valident les manifests au build :
- Champs requis présents
- Formats corrects (IDs en kebab-case, etc.)
- Fichiers référencés existants

En cas d'erreur, le build échoue avec un message explicite.

## CI/CD

Le workflow GitHub Actions (`deploy.yml`) :
1. Réutilise la CI : installation, gates, build complet depuis le snapshot revu.
2. Compare deux fabrications avec la même epoch et vérifie l'archive.
3. Teste cette même archive dans Chromium, puis la publie sur GitHub Pages.

Les fichiers `data/*.json` sont générés par la CI ; la publication ne les
reconstruit pas et réutilise l'artefact testé.

## Module partagé

`scripts/lib/build-utils.js` fournit :

| Fonction | Description |
|----------|-------------|
| `getRootDir(url)` | Chemin racine du projet |
| `fileExistsAsync(path)` | Vérifie existence fichier (async) |
| `fileExistsSync(path)` | Vérifie existence fichier (sync) |
| `readJSONAsync(path)` | Lit JSON (async) |
| `readJSONSync(path, stats)` | Lit JSON (sync) |
| `isValidId(id)` | Valide format kebab-case |
| `extractDomain(url)` | Extrait domaine d'URL |
| `colors` | Couleurs ANSI console |
| `createStats()` | Crée objet stats standard |
| `printReport(stats)` | Affiche rapport de build |
