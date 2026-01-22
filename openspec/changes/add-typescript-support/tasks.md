# Tasks: Support TypeScript

## Phase 1 : Infrastructure TypeScript

### 1.1 Configuration de base
- [x] Installer les dépendances TypeScript (`typescript`, `@types/node`)
- [x] Créer `tsconfig.json` avec configuration stricte
- [x] Créer `tsconfig.build.json` pour la production
- [x] Ajouter `"typecheck"` au `package.json`
- [x] Ajouter `make typecheck` au Makefile
- [x] Tester : `make typecheck` passe sans erreur

### 1.2 Build TypeScript
- [x] Installer `esbuild` pour la transpilation
- [x] Créer `scripts/build-typescript.js`
- [x] Supporter le mode watch (`--watch`)
- [x] Ajouter `"build:ts"` au `package.json`
- [x] Ajouter `make build-ts` au Makefile
- [x] Tester : transpilation d'un fichier `.ts` → `.js`

### 1.3 Intégration Jest
- [x] Installer `ts-jest` pour gérer les imports ESM TypeScript
- [x] Créer `jest.resolver.cjs` pour mapper `.js` → `.ts`
- [x] Mettre à jour `jest.config.js` pour supporter `.ts`
- [x] Tester : un test `.test.ts` s'exécute correctement

## Phase 2 : Support navigateur (dev)

### 2.1 Transpilation navigateur
- [x] Décision : utiliser pré-transpilation avec `make build-ts` (plus simple que es-module-shims)
- [x] Les fichiers HTML importent depuis `dist/` les fichiers `.js` transpilés
- [x] Workflow : `make build-ts:watch` pour le développement

### 2.2 Hot reload (optionnel)
- [x] `make build-ts:watch` via esbuild context (implémenté dans scripts/build-typescript.js)

## Phase 3 : Types pour les APIs existantes

### 3.1 Types GameEngine
- [x] Créer `lib/types/game-engine.ts` avec types complets
- [x] Définir `GameEngine<State, Action, PlayerView, Config>`
- [x] Définir `Bot<PlayerView, Action>`
- [x] Définir `RealTimeGameEngine` pour les jeux temps réel
- [x] Exporter depuis `lib/types/index.ts`

### 3.2 Types de base
- [x] `PlayerId`, `Seed` dans `lib/types/index.ts`
- [x] `Vector2D`, `Color` pour les outils graphiques
- [x] `BaseGameConfig`, `BaseGameState`

### 3.3 Types GameKit (reporté)
- [ ] Créer `lib/gamekit.d.ts` ou convertir `lib/gamekit.js` → `.ts`
- [ ] Typer toutes les méthodes publiques

### 3.4 Types utilitaires (reporté)
- [ ] Typer `lib/seeded-random.js` (ou convertir en `.ts`)
- [ ] Typer `lib/theme.js` (ou convertir en `.ts`)

## Phase 4 : Tool de validation "Particle Life"

### 4.1 Structure du tool
- [x] Créer `tools/particle-life/tool.json`
- [x] Créer `tools/particle-life/index.html`
- [x] Créer structure `src/` avec fichiers `.ts`

### 4.2 Implémentation
- [x] `src/types.ts` : Interfaces et types
- [x] `src/Simulation.ts` : Logique de simulation avec physique
- [x] `src/Renderer.ts` : Rendu Canvas 2D avec traînées
- [x] `src/main.ts` : Point d'entrée, UI et contrôles

### 4.3 Tests
- [x] `__tests__/Simulation.test.ts` : 21 tests unitaires
- [x] Vérifier que `make test` passe (371 tests au total)

### 4.4 Validation
- [x] `make build-ts` transpile vers `dist/`
- [x] `make typecheck` passe sans erreur
- [x] `make lint` passe sans erreur

## Phase 5 : CI/CD

### 5.1 Intégration Continue
- [x] Ajouter job `typecheck` dans `.github/workflows/ci.yml`
- [x] Ajouter step `build:ts` pour vérifier la transpilation
- [ ] Tester le workflow sur une PR

## Phase 6 : Migration optionnelle des jeux existants

### 6.1 Migration TicTacToe (reporté - optionnel)
- [ ] Convertir `games/tictactoe/engine.js` → `engine.ts`
- [ ] Convertir les bots en TypeScript
- [ ] Mettre à jour `index.html` pour importer depuis `dist/`
- [ ] Vérifier que tout fonctionne

## Phase 7 : Rétrospective et mise à jour de la documentation

### 7.1 Rétrospective technique
- [x] Documenté : Jest + ESM TypeScript nécessite un resolver personnalisé
- [x] Documenté : ts-jest mieux que esbuild-jest pour les imports `.js` → `.ts`
- [x] Documenté : Les fichiers `dist/` doivent être exclus du lint

### 7.2 Mise à jour de la documentation existante
- [x] Mettre à jour `AGENTS.md` avec les conventions TypeScript
- [ ] Mettre à jour `openspec/project.md` si nécessaire
- [ ] Enrichir les specs existantes avec les exemples TypeScript

### 7.3 Documentation des contenus (reporté)
- [ ] Trouver un terme approprié pour désigner tools/games/epics
- [ ] Mettre à jour la terminologie dans toute la documentation
- [ ] Enrichir les specs `manifests/spec.md` et `platform/spec.md`
- [ ] Supprimer le fichier temporaire `docs/PLUGINS-GUIDE.md` après intégration

### 7.4 Archivage OpenSpec (à faire après merge)
- [ ] Fusionner les deltas dans les specs principales
- [ ] Archiver cette proposal dans `openspec/changes/archive/`

---

## Définition de "Done"

La feature est considérée terminée quand :

1. ✅ Un tool TypeScript ("Particle Life") fonctionne en production
2. ✅ `make typecheck` vérifie tous les fichiers `.ts`
3. ✅ `make build-ts` transpile vers `.js`
4. ✅ Les tests `.test.ts` s'exécutent avec Jest
5. ✅ Le CI vérifie les types sur chaque PR
6. ✅ Les fichiers JavaScript existants continuent de fonctionner
7. ⏳ La documentation existante est enrichie (en cours)
8. ✅ La rétrospective est documentée
9. ⏳ La terminologie est cohérente (reporté)
