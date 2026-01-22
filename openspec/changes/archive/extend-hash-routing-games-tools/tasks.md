# Tasks: Étendre le Hash Routing aux Jeux et Outils

**Change ID:** extend-hash-routing-games-tools  
**Status:** Draft  
**Estimated effort:** 2-3 jours  

## Overview

Tâches pour implémenter le hash routing pour les jeux et outils, permettant les liens partageables directs.

---

## Phase 1: Fondation - Router (T1)

### T1.1 Ajouter routes jeux/outils au router

**Acceptance Criteria:**
- Route `#/games/:id` parsée correctement
- Route `#/tools/:id` parsée correctement
- Route invalide (ex: `#/games/xxx`) loggée et ignorée
- Tests unitaires pour chaque route

**Implementation notes:**
- Modifier `app/router.js` : ajouter patterns regex pour jeux/outils
- Pattern jeu : `/#\/games\/([a-z0-9-]+)(?:\/(.+))?/`
- Pattern outil : `/#\/tools\/([a-z0-9-]+)(?:\/(.+))?/`
- Extraire ID, valider contre catalogue
- Call `openEpic()` pour parcours, nouveau `openGame()` pour jeux, `openTool()` pour outils

**Validation:**
```bash
npm run test -- app/router.js  # Tests passent
```

---

## Phase 2: Loader - Synchronisation (T2)

### T2.1 Synchroniser hash quand on charge un jeu/outil

**Acceptance Criteria:**
- Clic sur game card → hash change et jeu se charge
- Clic sur tool card → hash change et outil se charge
- Refresh page en view game → reload le même jeu (pas retour au catalogue)
- Escape/back button → hash revient à `#/` ou previous

**Implementation notes:**
- Modifier `app/game-loader.js` : ajouter appel `window.location.hash = '#/games/:id'` après valider existence
- Modifier `app/catalogue.js` : les clics cards mettent à jour hash au lieu d'appeler directement `loadGame()`
- Ajouter handler `window.addEventListener('hashchange', ...)` pour réagir aux changements

**Validation:**
```bash
# Test manuel :
# 1. Ouvrir portail
# 2. Cliquer sur un jeu → hash devient #/games/xxx
# 3. Copier URL (ex: http://localhost:8080/#/games/tictactoe)
# 4. Ouvrir dans nouvel onglet → jeu charge directement
# 5. Refresh → jeu reste
# 6. ESC → retour à catalogue
```

---

## Phase 3: Catalogue - Links (T3)

### T3.1 Générer des links au lieu de direct calls

**Acceptance Criteria:**
- Toutes les cards jeux/outils cliquables via href hash
- No JavaScript event handlers pour chaque card (délégation)
- Fallback graceful si JS désactivé (rare, mais bon à avoir)

**Implementation notes:**
- Cards jeux : `<a href="#/games/xxx">Card</a>` au lieu de `onclick="loadGame()"`
- Cards outils : `<a href="#/tools/xxx">Card</a>`
- Ajouter event delegation : un listener global pour tous les clics
- Handler valide ID, appelle `loadGame()` si OK
- Si ID invalide, logger et ignorer

**Validation:**
```bash
# Test manuel :
# 1. Cliquer cards dans catalogue → jeux chargent
# 2. Ouvrir DevTools, Network tab → pas d'erreurs 404
# 3. DevTools Console → pas d'erreurs JS
```

---

## Phase 4: Initial Load (T4)

### T4.1 Parser hash au démarrage et charger le contenu

**Acceptance Criteria:**
- Si hash `#/games/xxx` au démarrage, le jeu se charge directement (pas le catalogue)
- Si hash `#/tools/xxx` au démarrage, l'outil se charge directement
- Si hash `#/parcours/xxx` au démarrage, le parcours s'ouvre
- Si hash vide ou invalide, catalogue par défaut

**Implementation notes:**
- Modifier `app.js` : appeler `handleHashRoute()` après initialiser l'app
- Le router détecte la route et appelle le handler approprié
- Utiliser les états existants de state.js (currentView, currentGame)

**Validation:**
```bash
# Test manuel :
# 1. URL: http://localhost:8080/#/games/tictactoe → jeu charge directement
# 2. URL: http://localhost:8080/#/tools/json-formatter → outil charge directement
# 3. URL: http://localhost:8080/#/parcours/epic-id → parcours charge
# 4. URL: http://localhost:8080/ ou vide → catalogue
```

---

## Phase 5: Tests et Documentation (T5)

### T5.1 Ajouter tests unitaires

**Acceptance Criteria:**
- Tests router : parsing game/tool routes
- Tests game-loader : synchronisation hash
- Tests catalogue : génération links
- Couverture ≥ 80% pour les fichiers modifiés

**Implementation notes:**
- Fichiers test : `app/router.test.js`, `app/game-loader.test.js`, `app/catalogue.test.js`
- Mocker window.location.hash, postMessage, fetch
- Tests de happy path et erreurs

**Validation:**
```bash
npm run test -- app/  # Tous les tests passent
npm run test -- --coverage  # Vérifier couverture
```

### T5.2 Mettre à jour spec portal

**Acceptance Criteria:**
- Section "Hash Router" dans `openspec/specs/portal/spec.md` inclut routes jeux/outils
- Examples concrets avec games et tools
- Comportement au refresh / historique navigateur documenté

**Implementation notes:**
- Ajouter table de routes complète
- Ajouter scenario de partage d'URL
- Ajouter diagram du flux

**Validation:**
```bash
grep -n "#/games\|#/tools" openspec/specs/portal/spec.md  # Présent
```

---

## Dépendances et ordre

```
T1 (router) ← préalable pour tout
  ├→ T2 (game-loader) ← peut être parallèle avec T3
  ├→ T3 (catalogue)
  └→ T4 (initial load) ← dépend de T1 + T2 + T3

T5 (tests) ← après T1-T4
```

**Exécution recommandée :**
1. T1 en premier (fondation)
2. T2 et T3 en parallèle
3. T4 (intègre les précédentes)
4. T5 (finalisation)

---

## Validation finale

```bash
# Avant de clôturer :
make lint          # ESLint passe
make test          # Tous les tests passent
make test-watch    # Pas de regressions
```

**Checklist final:**
- [ ] Routes jeux/outils fonctionnent
- [ ] Hash sync au chargement
- [ ] Refresh préserve le contexte
- [ ] Partage URL fonctionne
- [ ] Tests ≥ 80% couverture
- [ ] Spec portal mise à jour
- [ ] Pas de regressions existantes
