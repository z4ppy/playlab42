# Design: Mastermind Game

**Change ID**: `add-mastermind-game`

## Overview

Ce document détaille les décisions de conception pour l'implémentation du jeu Mastermind dans Playlab42.

## Architecture Decisions

### 1. Single-Player Only (Initial Version)

**Decision**: Le jeu ne supporte qu'un seul joueur humain (décodeur) contre l'ordinateur (codeur).

**Rationale**:
- Le Mastermind classique a une asymétrie forte : le codeur n'a presque rien à faire
- Mode humain vs humain apporterait peu de valeur ludique
- Simplifie l'implémentation initiale
- Concentre l'effort sur les bots intelligents

**Alternatives considérées**:
- Mode 2 joueurs : Rejeté car le codeur s'ennuie (juste donner des feedbacks)
- Mode inversé (humain code, bot devine) : Intéressant mais complexe (affichage des tentatives du bot)

**Future**: Le mode inversé pourrait être ajouté pour observer l'algorithme du bot en action (pédagogique).

---

### 2. Feedback Calculation Algorithm

**Decision**: Utiliser un algorithme en deux passes pour calculer les feedbacks.

**Algorithm**:
```javascript
function calculateFeedback(secret, guess) {
  const black = countExactMatches(secret, guess);
  const white = countColorMatches(secret, guess) - black;
  return { black, white };
}

function countExactMatches(secret, guess) {
  let count = 0;
  for (let i = 0; i < 4; i++) {
    if (secret[i] === guess[i]) count++;
  }
  return count;
}

function countColorMatches(secret, guess) {
  const secretCounts = countColors(secret);
  const guessCounts = countColors(guess);
  let total = 0;
  for (const color of COLORS) {
    total += Math.min(secretCounts[color] || 0, guessCounts[color] || 0);
  }
  return total;
}
```

**Rationale**:
- Simple et lisible (pédagogique)
- Évite les erreurs de double comptage
- Complexité O(n) où n=4 (négligeable)

**Alternatives considérées**:
- Algorithme en une passe avec marquage : Plus compact mais moins lisible
- Utilisation de Sets : Ne gère pas bien les doublons

**Edge Cases Handled**:
- Doublons dans le code secret: [R,R,B,B]
- Doublons dans la tentative: [Y,Y,Y,Y]
- Aucune correspondance: [R,B,G,Y] vs [O,V,O,V]
- Tout correct: 4 noirs, 0 blanc

---

### 3. Secret Code Generation

**Decision**: Générer le code secret dans `init()` en utilisant SeededRandom.

**Implementation**:
```javascript
init(config) {
  const rng = new SeededRandom(config.seed);
  const secretCode = Array.from({ length: 4 }, () => {
    const idx = Math.floor(rng.next() * COLORS.length);
    return COLORS[idx];
  });
  
  return {
    secretCode,
    attempts: [],
    currentAttempt: [],
    gameOver: false,
    // ...
  };
}
```

**Rationale**:
- Déterminisme garanti (replay possible)
- Code simple et clair
- Distribution uniforme des couleurs

**Alternatives considérées**:
- Code secret passé en config : Rejeté (l'utilisateur ne devrait pas voir le code)
- Génération côté client avec Math.random() : Rejeté (non-déterministe)

---

### 4. State Design: Hide Secret from Player View

**Decision**: `getPlayerView()` retourne l'état complet SAUF le `secretCode`.

**Implementation**:
```javascript
getPlayerView(state, playerId) {
  if (state.gameOver) {
    return state; // Montrer le code secret après la partie
  }
  
  return {
    ...state,
    secretCode: null, // Caché pendant le jeu
  };
}
```

**Rationale**:
- Évite la triche (inspection du state dans DevTools)
- Révèle le code à la fin (apprentissage)
- Respecte le principe de fog-of-war du GameEngine

**Alternatives considérées**:
- Ne jamais montrer le code : Rejeté (frustrant pour le joueur)
- Chiffrer le code : Over-engineering pour un jeu standalone

---

### 5. Bot Strategy: Smart Bot with Elimination

**Decision**: Le Smart Bot maintient une liste de codes possibles et élimine les incompatibles.

**Algorithm**:
```javascript
class SmartBot {
  constructor() {
    this.possibleCodes = generateAllCombinations(); // 6^4 = 1296
  }
  
  chooseAction(view, validActions, rng) {
    if (view.attempts.length > 0) {
      const lastAttempt = view.attempts[view.attempts.length - 1];
      this.possibleCodes = this.possibleCodes.filter(code => {
        const feedback = calculateFeedback(code, lastAttempt.code);
        return feedback.black === lastAttempt.feedback.black &&
               feedback.white === lastAttempt.feedback.white;
      });
    }
    
    // Choisir aléatoirement parmi les possibles
    const idx = Math.floor(rng.next() * this.possibleCodes.length);
    return { type: 'submit', code: this.possibleCodes[idx] };
  }
}
```

**Rationale**:
- Stratégie simple mais efficace (résout en ~6 coups en moyenne)
- Déterministe (utilise rng passé en paramètre)
- Pédagogique (montre l'élimination de possibilités)

**Performance**:
- Itération initiale: 1296 codes
- Après 1er coup: ~256 codes en moyenne
- Après 2ème coup: ~20-50 codes
- Converge rapidement

**Alternatives considérées**:
- Algorithme de Knuth (minimax) : Plus complexe, résout en ~5 coups, gardé pour future "Expert" bot
- Génétique/ML : Overkill pour ce jeu

---

### 6. UI Design: Grid-Based Layout

**Decision**: Interface classique en grille avec 10 lignes et sélecteur de couleurs.

**Layout**:
```
┌─────────────────────────────────┐
│  MASTERMIND                     │
├─────────────────────────────────┤
│  Attempt 10: [ ][ ][ ][ ]  ⚫⚪  │
│  Attempt  9: [R][B][G][Y]  ⚫⚫  │
│  Attempt  8: [O][O][V][V]  ⚪⚪  │
│     ...                          │
│  Attempt  1: [R][R][R][R]  ⚫    │
├─────────────────────────────────┤
│  Current: [R][B][?][?]          │
│  Colors: [R][B][G][Y][O][V]     │
│  [Submit] [New Game]            │
└─────────────────────────────────┘
```

**Interaction**:
- Click on color in palette → adds to current attempt
- Click on peg in current attempt → cycles through colors
- Submit disabled until 4 colors selected
- Previous attempts are read-only

**Rationale**:
- Familier pour les joueurs du jeu physique
- Toutes les informations visibles d'un coup d'œil
- Pas de scroll nécessaire (10 lignes = hauteur acceptable)

**Alternatives considérées**:
- Modal pour sélection : Rejeté (trop de clics)
- Drag & drop : Rejeté (complexe sur mobile)

---

### 7. Action Design: Submit Only

**Decision**: Une seule action `submit` avec le code complet.

**Actions**:
```typescript
type MastermindAction = 
  | { type: 'submit', code: Color[4] }
  | { type: 'reset' };
```

**Rationale**:
- Simple et atomique
- Une tentative = une action (cohérent avec le jeu physique)
- Facilite les tests et le replay

**Alternatives considérées**:
- Actions par peg (`{ type: 'place', position: 0, color: 'R' }`) : Trop granulaire, complique le state
- Undo/Redo : Pas nécessaire (on reconstruit la tentative avant submit)

---

### 8. Testing Strategy

**Decision**: Tests unitaires exhaustifs sur le moteur, tests manuels sur l'UI.

**Test Coverage**:
- **Engine**: 
  - Feedback calculation (20+ cas de tests avec edge cases)
  - Game flow (init → attempts → victory/defeat)
  - Determinism (même seed → même code secret)
  - Edge cases (10 tentatives, reset, invalid actions)
  - Player view (code caché pendant le jeu)
  
- **UI**:
  - Manuel (checklist dans tasks.md)
  - Pas de tests automatisés (trop de setup pour peu de valeur)
  - Validation de l'UX : clarté des rôles, intuitivité des contrôles

**Rationale**:
- Le moteur est la partie critique (logique métier + feedback algorithm)
- L'UI est simple et visuelle (inspection manuelle suffisante)
- Pas de bots = pas de tests de bots

---

## Data Structures

### State Representation

```typescript
interface MastermindState {
  secretCode: Color[];      // [4] - CACHÉ dans getPlayerView()
  attempts: Attempt[];      // [0-10] - Historique
  currentAttempt: Color[];  // [0-4] - En construction (UI only)
  gameOver: boolean;
  winner: string | null;    // playerId si victoire, null si défaite
  maxAttempts: number;      // 10
  rngState: number;
  playerId: string;
}
```

**Notes**:
- `currentAttempt` est un artefact UI (pas dans le moteur core)
- `attempts` est immuable (ajout uniquement)
- `secretCode` a 4 éléments toujours

---

## Performance Considerations

### Space Complexity
- State: O(1) - taille fixe (max 10 attempts × 4 colors)
- Smart Bot: O(1) - max 1296 codes (6^4)

### Time Complexity
- Feedback calculation: O(n) où n=4 → O(1)
- Smart Bot elimination: O(m × n) où m=codes restants (~256), n=4 → O(1) en pratique
- Worst case: première élimination = 1296 × 4 = 5184 comparaisons (négligeable)

### Optimization Opportunities (Future)
- Précalculer la table de feedbacks (6^4 × 6^4 = ~1.6M entrées) → lookup O(1)
- Web Worker pour le bot Smart (éviter freeze UI)
- Pas nécessaire pour MVP (calculs instantanés)

---

## Security Considerations

### Standalone Mode
- Secret code dans le client : Acceptable (pas de compétition)
- Inspection DevTools : Le joueur peut tricher, mais c'est son choix

### Future Multiplayer
- Secret code doit rester serveur-side
- Validation des feedbacks côté serveur
- Pas de getPlayerView() compromise

---

## Extension Points

### Future Enhancements

1. **Bots IA** (v2):
   - Random bot (easy)
   - Smart bot avec élimination (medium)
   - Expert bot avec Knuth's algorithm (hard)
   - Mode "watch bot play" pour observer les stratégies

2. **Mode inversé** (v2):
   - Humain choisit le code secret
   - Ordinateur/bot essaie de deviner
   - Visualisation de l'algorithme de résolution
   - Pédagogique : comprendre les stratégies optimales

3. **SuperMastermind**: 5 pegs, 8 colors
   - Modifier COLORS array
   - Ajuster UI grid width
   - Même moteur (paramétrable)

4. **Mode Tutorial**:
   - Afficher le nombre de codes possibles restants
   - Suggérer des couleurs
   - Mode "pas à pas" pour comprendre l'élimination

5. **Statistics**:
   - Distribution des victoires (nb de coups)
   - Taux de réussite
   - Comparaison humain vs bots (quand v2)
   - Heatmaps des tentatives

---

## Open Questions

### Q1: Faut-il permettre les combinaisons invalides (moins de 4 couleurs) ?
**Réponse**: Non. Le bouton Submit est désactivé tant que 4 couleurs ne sont pas sélectionnées.

### Q2: Le feedback doit-il être ordonné (noirs d'abord) ?
**Réponse**: Oui, c'est la règle officielle. Les noirs sont toujours affichés avant les blancs.

### Q3: Peut-on utiliser la même couleur 4 fois ?
**Réponse**: Oui, c'est autorisé (ex: [R,R,R,R] est valide).

---

## References

- Knuth, D. (1977). "The Computer as Master Mind". Journal of Recreational Mathematics.
- Playlab42 conventions: `openspec/project.md`
- Game Engine spec: `openspec/specs/game-engine/spec.md`
- Bot spec: `openspec/specs/bot/spec.md`
