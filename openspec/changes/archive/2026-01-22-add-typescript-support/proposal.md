# Proposal: Support TypeScript pour Tools, Games et Epics

**Change ID**: `add-typescript-support`
**Status**: Draft
**Created**: 2026-01-16
**Author**: Cyrille

## Pourquoi

### Contexte

Playlab42 est actuellement 100% JavaScript. Les moteurs de jeux (`engine.js`), bots (`bots/*.js`) et modules de tools complexes (`src/*.js`) utilisent JSDoc pour les types, mais sans vérification statique.

### Problèmes actuels

1. **Pas de vérification de types** : Les erreurs de typage ne sont détectées qu'à l'exécution
2. **Autocomplétion limitée** : Les IDEs ne peuvent pas toujours inférer les types
3. **Documentation incomplète** : JSDoc est verbeux et souvent négligé
4. **Refactoring risqué** : Renommer une propriété peut casser silencieusement le code
5. **Qualité pédagogique** : TypeScript est un skill essentiel à transmettre dans nos formations

### Bénéfices attendus

- **Détection précoce des erreurs** : À la compilation plutôt qu'à l'exécution
- **Meilleure DX** : Autocomplétion, navigation, refactoring sûr
- **Documentation vivante** : Les types servent de documentation
- **Apprentissage** : Les participants découvrent TypeScript progressivement
- **Isomorphisme garanti** : Les moteurs typés sont plus facilement portables

## Quoi

### Principe : TypeScript optionnel avec transpilation à la volée

L'idée est de permettre l'utilisation de fichiers `.ts` dans les plugins tout en gardant la philosophie "standalone first" de Playlab42.

**Approche choisie** : Transpilation à la volée via import maps + Babel/SWC dans le navigateur.

### Architecture proposée

```
┌─────────────────────────────────────────────────────────────────┐
│                     DÉVELOPPEMENT                                │
│                                                                  │
│  tools/my-tool/                 games/my-game/                  │
│  ├── src/                       ├── engine.ts    ◄── TypeScript │
│  │   ├── main.ts  ◄── TS       ├── bots/                        │
│  │   └── utils.ts              │   └── smart.ts  ◄── TypeScript │
│  └── index.html                └── index.html                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BUILD (optionnel)                            │
│                                                                  │
│  esbuild/swc transpile *.ts → *.js                              │
│  (pour production uniquement)                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION                                   │
│                                                                  │
│  tools/my-tool/                 games/my-game/                  │
│  ├── dist/                      ├── dist/                       │
│  │   ├── main.js               │   ├── engine.js                │
│  │   └── utils.js              │   └── bots/smart.js            │
│  └── index.html                └── index.html                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Options d'implémentation

#### Option A : Transpilation dev-time via es-module-shims + babel (Recommandée)

```html
<!-- Polyfill pour import maps + TypeScript -->
<script async src="https://unpkg.com/es-module-shims/dist/es-module-shims.js"></script>
<script type="importmap-shim">
{
  "imports": {
    "./src/": "./src/"
  }
}
</script>
<script type="module-shim" src="./src/main.ts"></script>
```

**Avantages** :
- Zéro config pour les développeurs
- TypeScript fonctionne directement dans le navigateur
- Compatible avec la philosophie "double-click to run"

**Inconvénients** :
- Temps de chargement légèrement plus long en dev
- Nécessite un polyfill JS (~30KB)

#### Option B : Build avec esbuild (Alternative pour production)

```bash
# Transpilation rapide avec esbuild
make build:ts
# ou
npx esbuild src/**/*.ts --outdir=dist --format=esm
```

**Avantages** :
- Performance optimale en production
- Type checking avec `tsc --noEmit`
- Tree shaking et minification

**Inconvénients** :
- Nécessite une étape de build
- Plus de configuration

### Choix recommandé

**Combiner les deux approches** :

1. **Dev** : `es-module-shims` + transpilation navigateur pour l'édition rapide
2. **CI/Production** : Build avec `esbuild` pour la vérification de types et l'optimisation

### Configuration TypeScript proposée

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "baseUrl": ".",
    "paths": {
      "@lib/*": ["lib/*"]
    }
  },
  "include": [
    "lib/**/*.ts",
    "tools/**/*.ts",
    "games/**/*.ts",
    "parcours/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "**/dist/**",
    "**/__tests__/**"
  ]
}
```

### Nouveaux scripts npm

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build:ts": "node scripts/build-typescript.js",
    "build:ts:watch": "node scripts/build-typescript.js --watch"
  }
}
```

### Commandes Make

```makefile
# TypeScript
typecheck:
	docker compose exec dev npm run typecheck

build-ts:
	docker compose exec dev npm run build:ts
```

## Impact

### Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `package.json` | Ajout `typescript`, `esbuild` |
| `tsconfig.json` | Nouvelle configuration |
| `Makefile` | Nouvelles commandes |
| `scripts/build-typescript.js` | Nouveau script de build |
| `.github/workflows/ci.yml` | Ajout `typecheck` |
| `openspec/specs/manifests/spec.md` | Documenter support `.ts` |
| `openspec/specs/platform/spec.md` | Documenter workflow TS |

### Specs impactées

- **manifests** : Ajouter `engine` field pour préciser `.ts` ou `.js`
- **platform** : Documenter le workflow TypeScript
- **game-engine** : Fournir types TypeScript officiels

### Rétrocompatibilité

- ✅ Les fichiers `.js` existants continuent de fonctionner
- ✅ Aucune migration obligatoire
- ✅ Les nouveaux plugins peuvent choisir JS ou TS
- ✅ Les tests Jest continuent de fonctionner (ts-jest)

## Tool de validation proposé

Pour valider cette implémentation, créer un nouveau tool **"Particle Life"** en TypeScript :

### Particle Life

Un simulateur de vie artificielle où des particules colorées interagissent selon des règles d'attraction/répulsion configurables. Effet visuel spectaculaire, code relativement simple, parfait pour démontrer TypeScript.

```
tools/
└── particle-life/
    ├── index.html
    ├── tool.json
    ├── src/
    │   ├── main.ts           # Point d'entrée
    │   ├── Particle.ts       # Classe Particle
    │   ├── Simulation.ts     # Logique de simulation
    │   ├── Renderer.ts       # Rendu Canvas
    │   └── types.ts          # Types partagés
    └── __tests__/
        └── Simulation.test.ts
```

**Caractéristiques** :
- Simulation de N particules avec forces d'interaction
- Canvas 2D performant
- Panneau de contrôle pour ajuster les paramètres
- Code TypeScript idiomatique avec types stricts

## Questions ouvertes

1. **Transpilation navigateur** : Utiliser `es-module-shims` ou un service worker custom ?
2. **Source maps** : Activer en dev pour le debugging ?
3. **Strict mode** : Imposer `strict: true` ou laisser le choix ?
4. **Librairies types** : Inclure `@types/three` etc. ?
5. **Terminologie** : Trouver un terme approprié pour tools/games/epics (pas "plugins")
   - Candidats : "modules", "contenus", "apps", "composants", "ressources"

## Approche documentation

**Important** : Le fichier `docs/PLUGINS-GUIDE.md` créé pendant l'exploration est **temporaire**.

Lors de la phase de rétrospective (Phase 7), les apprentissages seront intégrés dans :
- `AGENTS.md` : Conventions et instructions pour les agents IA
- `openspec/project.md` : Conventions du projet
- `openspec/specs/manifests/spec.md` : Guides de création détaillés
- `openspec/specs/platform/spec.md` : Architecture et structure

Cette approche évite la multiplication de fichiers de documentation et garde l'information là où les développeurs la cherchent naturellement.

## Voir aussi

- [es-module-shims](https://github.com/guybedford/es-module-shims)
- [esbuild](https://esbuild.github.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
