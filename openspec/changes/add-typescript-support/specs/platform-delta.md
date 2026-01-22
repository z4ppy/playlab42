# Platform Specification - Delta

## ADDED Requirements

### Requirement: TypeScript Support

The system SHALL support TypeScript files for tools, games, and epics.

#### Scenario: TypeScript in development
- **WHEN** a developer creates a `.ts` file in a tool or game
- **THEN** it can be imported and executed in the browser during development

#### Scenario: TypeScript in production
- **WHEN** the build script runs
- **THEN** all `.ts` files are transpiled to `.js` in a `dist/` folder

#### Scenario: Type checking
- **WHEN** `make typecheck` is executed
- **THEN** all TypeScript files are validated without transpilation

### Requirement: Mixed JS/TS Support

The system SHALL allow mixing JavaScript and TypeScript files.

#### Scenario: JS imports TS
- **WHEN** a JavaScript file imports a TypeScript module
- **THEN** the import resolves correctly (via import map or build)

#### Scenario: TS imports JS
- **WHEN** a TypeScript file imports a JavaScript module
- **THEN** the import resolves correctly (with optional `.d.ts` declarations)

## MODIFIED Stack Technique

| Composant | Choix | Justification |
|-----------|-------|---------------|
| **Langage** | JavaScript + TypeScript | TypeScript optionnel pour les moteurs et modules |
| **Type checking** | `tsc --noEmit` | Vérification sans transpilation |
| **Transpilation** | esbuild | Rapide, support ESM natif |
| **Dev runtime** | es-module-shims | Transpilation navigateur pour dev |

## ADDED Build Commands

### Commandes Make

```bash
# TypeScript
make typecheck         # Vérifier les types sans transpiler
make build-ts          # Transpiler *.ts → *.js
make build-ts-watch    # Mode watch pour le développement
```

### Scripts npm

```json
{
  "typecheck": "tsc --noEmit",
  "build:ts": "node scripts/build-typescript.js",
  "build:ts:watch": "node scripts/build-typescript.js --watch"
}
```

## MODIFIED Structure des Dossiers

```
playlab42/
├── tsconfig.json             # Configuration TypeScript
├── tsconfig.build.json       # Configuration pour le build
├── lib/
│   ├── types/                # Types partagés
│   │   └── game-engine.d.ts  # Interface GameEngine
│   ├── gamekit.ts            # SDK (optionnel: conversion)
│   └── seeded-random.ts      # PRNG (optionnel: conversion)
├── tools/
│   └── [tool-id]/
│       ├── src/
│       │   ├── main.ts       # Point d'entrée TypeScript
│       │   └── *.ts
│       ├── dist/             # Fichiers transpilés (gitignore)
│       │   └── *.js
│       └── index.html
├── games/
│   └── [game-id]/
│       ├── engine.ts         # Moteur en TypeScript
│       ├── dist/
│       │   └── engine.js     # Version transpilée
│       └── bots/
│           ├── smart.ts
│           └── dist/
│               └── smart.js
└── scripts/
    └── build-typescript.js   # Script de build TS
```

## ADDED Configuration TypeScript

### tsconfig.json (développement)

```json
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
    "**/dist/**"
  ]
}
```

### tsconfig.build.json (production)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

## ADDED Workflow Développement

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW TYPESCRIPT                           │
│                                                                  │
│  1. Édition                                                      │
│     └── IDE avec TypeScript Language Server                     │
│         ├── Autocomplétion                                       │
│         ├── Navigation (Go to Definition)                        │
│         └── Refactoring sûr                                      │
│                                                                  │
│  2. Vérification                                                 │
│     └── make typecheck                                           │
│         └── tsc --noEmit                                         │
│                                                                  │
│  3. Dev Runtime (navigateur)                                     │
│     └── es-module-shims + importmap                             │
│         └── Transpilation à la volée                            │
│                                                                  │
│  4. Build Production                                             │
│     └── make build-ts                                            │
│         └── esbuild → dist/*.js                                 │
│                                                                  │
│  5. CI/CD                                                        │
│     └── typecheck + build:ts + tests                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## ADDED Conventions TypeScript

### Nommage des types

| Élément | Convention | Exemple |
|---------|------------|---------|
| Interface | PascalCase + suffixe descriptif | `GameState`, `PlayerAction` |
| Type alias | PascalCase | `PlayerId`, `CellValue` |
| Generics | Lettre majuscule | `T`, `S`, `A` |
| Enum | PascalCase | `GamePhase`, `BotDifficulty` |

### Organisation des fichiers

```typescript
// types.ts - Types partagés du module
export interface State { /* ... */ }
export interface Action { /* ... */ }
export type PlayerId = string;

// Module.ts - Classes et fonctions
import type { State, Action } from './types.js';

export class Engine {
  // ...
}
```

### Imports

```typescript
// Toujours utiliser l'extension .js dans les imports (même pour .ts)
// esbuild et le navigateur résolvent correctement
import { Engine } from './engine.js';
import type { State } from './types.js';
```
