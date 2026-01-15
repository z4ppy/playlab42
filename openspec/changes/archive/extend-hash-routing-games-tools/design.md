# Design: Étendre le Hash Routing aux Jeux et Outils

**Change ID:** extend-hash-routing-games-tools  
**Date:** 2025-01-14

## Overview

Ce document explore les décisions architecturales pour étendre le hash router existant (déjà utilisé par les épics) aux jeux et outils, permettant les liens profonds partageables.

---

## Décisions clés

### 1. Réutiliser le router existant vs créer un nouveau système

**Contexte:**
- `app/router.js` gère déjà les épics via pattern `#/parcours/:epicId/:slideId`
- Les jeux et outils suivent une structure similaire (ID unique)

**Options envisagées:**

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **Réutiliser router** | DRY, une source de vérité, facilement testable | Dépendance circulaire si pas prudent |
| Créer système séparé | Isolation | Duplication de code, difficile à maintenir |

**Décision:** ✅ **Réutiliser router existant**

**Rationale:** Le router existant est minimaliste et extensible. Ajouter des patterns est trivial, et c'est cohérent avec l'approche pédagogique du projet (un seul point de contrôle).

---

### 2. Format des routes : jeux vs outils

**Contexte:**
- Les jeux et outils ont des ID stockés dans `game.json` et `tool.json`
- Les IDs suivent `kebab-case` (ex: `json-formatter`, `tictactoe`)
- Les parcours utilisent `#/parcours/:id/:slideId`

**Options:**

| Route | Format | Exemple |
|-------|--------|---------|
| **Proposée** | `#/games/:id` | `#/games/tictactoe` |
| **Alt 1** | `#/jeux/:id` (français) | `#/jeux/tictactoe` |
| **Alt 2** | `#/:type/:id` | `#/games/tictactoe` ou `#/tools/json-formatter` |

**Décision:** ✅ **`#/games/:id` et `#/tools/:id` (anglais)**

**Rationale:**
- Cohérent avec `#/parcours/:id`
- Pas de parsing supplémentaire (pas besoin de `:type`)
- Lisible et sans ambiguïté
- Anglais pour cohérence avec les noms de fichiers

---

### 3. Synchronisation bidirectionnelle du hash

**Contexte:**
- Quand l'utilisateur clique une card, le jeu doit charger ET le hash doit changer
- Quand l'utilisateur paste une URL avec hash, le jeu doit charger sans clic

**Architecture:**

```
┌─ Utilisateur clique card ─┐
│                            │
│  catalogue.js             │
│  └─ event listener        │
│     └─ window.location.hash = '#/games/xxx'
│
└─ Événement 'hashchange' ──→ router.js ──→ game-loader.js ──→ loadGame()
```

**vs alternative (une source de vérité dans game-loader):**

```
catalogue.js
└─ event listener
   └─ loadGame() (app/game-loader.js)
      └─ window.location.hash = '#/games/xxx'
```

**Décision:** ✅ **Laissez le hash être la source de vérité**

**Rationale:**
- Permet naviguer par hash sans passer par catalogue
- Preserve history navigateur (back/forward)
- Simpler pour partage d'URL
- Teste-amis (injections faciles de hash)

**Implications:**
- `catalogue.js` : clics → met à jour hash (pas d'appel direct à loadGame)
- `app/router.js` : reconnaît le hash → appelle loadGame
- `app/game-loader.js` : synchronise le hash après valider le jeu

---

### 4. Validation des IDs : où et comment

**Contexte:**
- Les IDs proviennent soit du hash, soit des catalogues
- Faut s'assurer qu'un jeu/outil existe avant de le charger

**Options:**

| Étape | Approche |
|-------|----------|
| **Router** | Valider hash format uniquement (ex: kebab-case) |
| **Game-loader** | Faire HEAD request vers `games/:id/index.html` |
| **Catalogue** | Vérifier ID existe dans `catalogue.json` |
| **Combiné** | Router (format) + game-loader (HEAD) + catalogue (reference) |

**Décision:** ✅ **Router (format) + Game-loader (existence)**

**Rationale:**
- Router valide le format (protège contre typos)
- Game-loader valide existence réelle (HEAD request existant)
- Pas besoin de charger catalogue.json pour router
- Erreur gracieuse si jeu inexistant

**Pseudo-code:**

```javascript
// app/router.js
const gameMatch = hash.match(/#\/games\/([a-z0-9-]+)/);
if (gameMatch) {
  const id = gameMatch[1];
  // Valider format seulement
  if (/^[a-z0-9-]+$/.test(id)) {
    openGame(id);  // Appelle game-loader
  } else {
    logError('Invalid game ID format');
  }
}

// app/game-loader.js
async function openGame(id) {
  const path = `games/${id}/index.html`;
  try {
    const response = await fetch(path, { method: 'HEAD' });
    if (response.ok) {
      loadGame(path, name, 'game', id);
    } else {
      showError(`Game not found: ${id}`);
    }
  } catch (e) {
    showError(`Error loading game: ${e.message}`);
  }
}
```

---

### 5. État et rerender : éviter les fuites

**Contexte:**
- `state.js` stocke `currentGame`, `currentView`
- Charger un jeu deux fois doit pas créer doublons

**Architecture:**

```javascript
// Scénario: utilisateur clique jeu → hash change → router appelle openGame → loadGame
// Risque: state.currentGame mis à jour deux fois

// Sol1: Gate dans loadGame (vérifier state.currentGame !== id)
// Sol2: Router appelle closeGame() avant openGame()
// Sol3: game-loader valide lui-même
```

**Décision:** ✅ **Game-loader valide, router abstrait du state**

**Rationale:**
- Isolation du router (il ignore state)
- Game-loader responsable de ses transitions
- Pas de "double load" possible

**Pseudo-code:**

```javascript
// app/game-loader.js
export async function openGame(id, options = {}) {
  // Ne charger que si différent ou forcé
  if (state.currentGame?.id === id && !options.force) {
    return;  // Déjà chargé
  }

  // Nettoyer avant de charger
  if (state.currentGame) {
    await closeGame();
  }

  // Charger le jeu
  await loadGame(path, name, 'game', id);
  window.location.hash = `#/games/${id}`;
}
```

---

### 6. Navigation arrière : cohérence avec épics

**Contexte:**
- Les épics utilisent `window.history.back()` ou retour au catalogue via hash
- Les jeux doivent suivre le même pattern

**Flux:**
```
Catalogue (#/) → Jeu (#/games/xxx) → Escape → back to catalogue (#/)
```

**Implémentation:**

```javascript
// app/game-loader.js
export function closeGame() {
  // Option 1: history.back()
  // window.history.back();

  // Option 2: Forcer le hash (plus prédictible)
  window.location.hash = '#/';

  // Nettoyer l'iframe
  el.gameIframe.src = 'about:blank';
  setState({ currentGame: null, currentView: 'catalogue' });
}
```

**Décision:** ✅ **Forcer hash = '#/' au lieu de `history.back()`**

**Rationale:**
- Plus prédictible que `history.back()` (qui dépend du navigateur)
- Cohérent avec l'architecture hash-driven
- Plus facile à tester

---

### 7. Outils vs Jeux : même traitement?

**Contexte:**
- Les outils et jeux se chargent via iframe similairement
- `app/game-loader.js` traite déjà les deux (paramètre `type`)

**Décision:** ✅ **Traiter jeux et outils de manière identique dans le router**

**Rationale:**
- Réduire la duplication
- Même router, même validation, même pattern
- Les seules différences sont les chemins (`games/` vs `tools/`)

---

### 8. Query params pour config future (optionnel)

**Contexte:**
- L'utilisateur mentionne un bonus : paramètres pré-remplis (`?players=3`)
- Pas inclus dans cette phase, mais architecture doit supporter

**Design futur-proof:**

```javascript
// Router pourrait supporter :
// #/games/tictactoe?players=2&ai=true

const fullHash = window.location.hash;
// '#/games/tictactoe?players=2&ai=true'

const [hashPart, queryPart] = fullHash.split('?');
const params = new URLSearchParams(queryPart);
// params.get('players') → '2'
// params.get('ai') → 'true'
```

**Décision:** ✅ **Ignorer query params pour maintenant (réservé pour future)**

**Rationale:**
- Complique cette phase
- Jeux doivent d'abord supporter la réception de params via postMessage
- Peut être ajouté ultérieurement sans refactoring du router

---

## Architecture globale

### État souhaité après implémentation

```
Window URL: https://example.com/#/games/tictactoe
            ↓
app.js: handleHashRoute()
            ↓
app/router.js: reconnaît #/games/tictactoe
            ↓
app/router.js: appelle openGame('tictactoe')
            ↓
app/game-loader.js: valide existence du jeu
            ↓
app/game-loader.js: loadGame() → crée iframe
            ↓
user voir jeu dans l'interface
            ↓
Utilisateur copie URL → fonctionne directement
```

### Fichiers impactés et interactions

```
                    ┌─────────────────┐
                    │   index.html    │ ← Entry point
                    │                 │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    app.js       │
                    │ - initRouter()  │
                    └────────┬────────┘
                             │
            ┌────────────────▼──────────────────┐
            │                                   │
     ┌──────▼────────┐            ┌────────────▼──┐
     │  app/router   │            │  catalogue.js  │
     │  - parser #   │            │ - user clicks  │
     │  - dispatch   │            │ - set hash     │
     └──────┬────────┘            └────────────────┘
            │                             ▲
            └─────────┬──────────────────┘
                      │
           ┌──────────▼────────────┐
           │ app/game-loader.js    │
           │ - load iframe         │
           │ - validate game       │
           │ - sync hash           │
           └──────────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ games/:id/   │
              │ index.html   │
              └──────────────┘
```

---

## Considérations de performance

### Initial load

**Avant:** Catalogue charge, user clique, jeu charge (~1s)  
**Après:** Si hash fourni, jeu charge directement (~0.5s)

### Validation

- **HEAD request** : ~100ms overhead (acceptable)
- **Parser regex** : negligeable (~1ms)

### Memory

- Pas de changement significatif
- Même nombre d'iframes simultanées

---

## Testing

### Unitaire

```javascript
// router.test.js
describe('router: games/tools routes', () => {
  it('parses #/games/tictactoe', () => {
    const match = parseHashRoute('#/games/tictactoe');
    expect(match.type).toBe('game');
    expect(match.id).toBe('tictactoe');
  });

  it('parses #/tools/json-formatter', () => {
    const match = parseHashRoute('#/tools/json-formatter');
    expect(match.type).toBe('tool');
    expect(match.id).toBe('json-formatter');
  });

  it('rejects invalid IDs', () => {
    const match = parseHashRoute('#/games/TicTacToe');  // Uppercase
    expect(match).toBeNull();
  });
});
```

### Intégration

```javascript
// game-loader.test.js
describe('game-loader: sync with hash', () => {
  it('updates hash when loading game', async () => {
    await openGame('tictactoe');
    expect(window.location.hash).toBe('#/games/tictactoe');
  });

  it('loads game when hash is set directly', async () => {
    window.location.hash = '#/games/tictactoe';
    await handleHashRoute();
    expect(state.currentGame.id).toBe('tictactoe');
  });
});
```

---

## Questions ouvertes et suites possibles

### Q1: Open Graph metadata pour partage Teams/Slack?

**Status:** ⏭ Future (Post-MVP)  
**Challenge:** Nécessite serveur côté-client ou service worker pour générer dynamiquement les métadonnées OG  
**Path forward:** Exploration avec service worker ou serverless function

### Q2: Sauvegarde de config pré-remplie?

**Status:** ⏭ Future  
**Path forward:** Router supports query params, jeux reçoivent via postMessage

### Q3: Deep linking au sein du jeu (ex: #/games/checkers/replay?gameId=123)?

**Status:** ⏭ Future  
**Path forward:** Game-loader pourrait passer params additionnels au jeu via postMessage

---

## Conclusion

L'architecture proposée :
- ✅ Réutilise le router existant (DRY)
- ✅ Maintient separation of concerns (router, loader, catalogue)
- ✅ Scalable pour futures extensions
- ✅ Cohérent avec les épics
- ✅ Pas de regressions
