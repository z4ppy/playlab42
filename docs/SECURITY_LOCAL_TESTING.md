# Tests de sécurité en local

Les outils du projet s'exécutent dans le conteneur de développement Node.js 26,
pas sur l'hôte. Les plugins ESLint sont des dépendances épinglées et présentes
dans le lockfile : aucun target de sécurité ne les installe temporairement.

## Installation reproductible

```bash
make up
docker compose exec -T dev npm ci
```

Dans un worktree, utiliser les commandes depuis sa racine ; `make up` sélectionne
son projet Compose. Un nouveau volume `node_modules` nécessite cette installation.
Ne pas utiliser `--force` ou `--legacy-peer-deps` pour contourner une incompatibilité.

## Contrôles bloquants

```bash
make security-npm       # npm audit, seuil moderate (développement compris)
make security-eslint    # npm run lint:security, JS et scripts HTML
make security-yaml      # syntaxe et clés uniques des quatre YAML de sécurité/CI
make security-audit     # ces contrôles, packages obsolètes, puis npm ls
```

`security-audit` s'arrête sur un contrôle bloquant en échec ; il ne transforme
plus une vulnérabilité ou une erreur ESLint en succès. `npm outdated` est
informatif dans cet agrégat : son statut 1 signifie « mises à jour disponibles » ;
ses autres erreurs restent bloquantes. `make security-deps` conserve son statut
natif pour une consultation individuelle.

Le gate ESLint possède une flat config dédiée, `eslint.security.config.js`,
indépendante du lint de qualité (`make lint`). Il bloque :

- `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url` ;
- `security/detect-buffer-noassert`, `security/detect-new-buffer` ;
- `security/detect-disable-mustache-escape`, `security/detect-bidi-characters` ;
- `no-unsanitized/method` : par exemple `document.write(input)` ou
  `element.insertAdjacentHTML('beforeend', input)`.

Les diagnostics de niveau erreur et les erreurs d'analyse donnent un statut
non nul. Le gate utilise `--max-warnings=0`.

## Diagnostics advisory explicites

```bash
make security-eslint-advisory
# ou dans le conteneur
docker compose exec -T dev npm run lint:security:advisory
```

Cette commande conserve les erreurs bloquantes du gate et ajoute des warnings :
`no-unsanitized/property`, `security/detect-unsafe-regex`,
`security/detect-non-literal-regexp`, `security/detect-object-injection`,
`security/detect-non-literal-fs-filename`, `security/detect-child-process` et
`security/detect-possible-timing-attacks`.

Les accès calculés, chemins de build, regex et assemblages HTML nécessitent une
revue contextualisée : ces heuristiques ne prouvent pas une exploitabilité.
En particulier, le contrôle des propriétés HTML ne suit pas les fonctions
d'échappement locales ; le dépôt contient déjà de nombreux sinks à examiner.
Les warnings restent visibles, sans règle de suppression globale ni nouvelle
liste de fonctions déclarées sûres. Un statut 0 de l'advisory ne signifie donc
pas « aucun diagnostic ». Une erreur du gate reste bloquante dans l'advisory.

## Rapports et tests

```bash
docker compose exec -T dev npm run lint:security -- \
  --format json --output-file eslint-security-results.json
docker compose exec -T dev npm run lint:security:advisory -- \
  --format json --output-file eslint-security-advisory-results.json
docker compose exec -T dev npm test -- --runInBand scripts/security-lint.test.js
make security-report
```

Le JSON ESLint contient les diagnostics par fichier, avec sévérité, règle,
ligne et colonne. L'écriture du rapport ne change pas le statut de sortie.
Les tests prouvent les règles bloquantes, un cas DOM sûr, les warnings séparés,
le statut npm et l'export JSON sur une sonde dangereuse et une sonde sûre.
Ces sondes sont analysées, jamais exécutées.

`security-report` publie l'audit npm JSON, écrit le rapport ESLint puis affiche
les packages obsolètes. C'est une séquence de contrôles, pas un agrégateur
best-effort : un échec est propagé et les étapes suivantes ne sont pas exécutées.
Les rapports générés sont des artefacts locaux, pas des fichiers à commiter.

## Limites connues

- Périmètre : JavaScript et scripts HTML du dépôt, configs et tests compris.
  Dépendances, bibliothèques tierces et sorties générées (`dist`, `coverage`,
  `data`, `site`, `docs/site`, `assets/vendor`) sont exclues.
- Les scripts HTML sont analysés ; le markup et les attributs inline ne le sont
  pas. Les attributs événementiels sont migrés vers des listeners lintés et
  interdits par `scripts/source-lint.test.js`. Le contenu pédagogique n'est
  pas certifié sûr par cette analyse.
- Le lint `.ts` utilise **Biome 2.5.15**, séparément du gate sécurité ESLint.
  `typescript-eslint` 8.71.0 annonce
  TypeScript `>=4.8.4 <6.1.0`, incompatible avec le compilateur 7.0.2 du projet.
  Aucun parser incompatible n'est ajouté, le compilateur n'est pas rétrogradé.
  `make typecheck` et les tests TS restent requis ; Biome ne reproduit pas les
  plugins de sécurité ESLint ni l'analyse utilisant le compilateur.
- Le lint ne valide ni la provenance des données, ni les protocoles d'URL, ni
  les origines `postMessage`, ni les autorisations. Il ne remplace pas les
  tests, la revue de code, l'audit de dépendances ou les scanners de secrets.
- Les directives inutilisées du lint de qualité ne sont pas signalées par la
  configuration sécurité isolée ; leur contrôle reste celui du lint de qualité.
  Cela n'ajoute aucune exception aux règles bloquantes.

En cas d'échec, corriger la cause puis relancer le contrôle concerné. Ne pas
masquer les erreurs, forcer l'installation ou appliquer `npm audit fix --force`
sans analyser l'impact. Pour changer les versions, suivre
[SECURITY_SETUP.md](./SECURITY_SETUP.md).
