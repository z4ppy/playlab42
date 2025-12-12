# Design : Jeu de Dames

## Architecture

Le jeu de Dames suit la même architecture que Tic-Tac-Toe :

```
games/checkers/
├── engine.js          # Moteur de jeu isomorphe
├── engine.test.js     # Tests unitaires
├── index.html         # Interface utilisateur
├── game.json          # Manifest
└── bots/
    ├── random.js      # Bot basique
    └── smart.js       # Bot avec minimax
```

## Représentation de l'état

### État du jeu

```typescript
type Piece = {
  type: 'pawn' | 'king';  // pion ou dame
  player: 0 | 1;          // joueur blanc (0) ou noir (1)
};

type Position = {
  row: number;    // 0-9
  col: number;    // 0-9
};

type GameState = {
  board: (Piece | null)[][];     // Plateau 10x10
  currentPlayer: 0 | 1;           // Joueur actif
  status: 'playing' | 'won' | 'draw';
  winner: 0 | 1 | null;
  mustCapture: Position[] | null; // Positions qui doivent capturer (si prise obligatoire)
  moveHistory: Move[];            // Historique pour replay
  seed: string;                   // Pour déterminisme
};

type Move = {
  from: Position;
  to: Position;
  captures?: Position[];  // Positions des pièces capturées
};
```

### Actions

```typescript
type Action = {
  type: 'move';
  from: Position;
  to: Position;
};
```

Le moteur calculera automatiquement les captures lors du traitement du mouvement.

## Logique de jeu

### Initialisation

1. Créer plateau 10×10
2. Placer 20 pions blancs (rangées 0-3, cases noires)
3. Placer 20 pions noirs (rangées 6-9, cases noires)
4. Joueur blanc commence

### Tour de jeu

1. **Déterminer les coups légaux**
   - Calculer tous les mouvements possibles
   - Si des captures sont possibles, seules les captures sont légales
   
2. **Valider l'action**
   - Vérifier que le mouvement est légal
   - Vérifier que c'est bien le tour du joueur
   
3. **Exécuter le mouvement**
   - Déplacer la pièce
   - Capturer les pièces sautées
   - Promouvoir en dame si dernière rangée
   - Vérifier les prises multiples possibles
   
4. **Vérifier la fin**
   - Victoire si adversaire n'a plus de pièces
   - Victoire si adversaire ne peut plus bouger
   - Match nul si répétition de position (optionnel)

### Calcul des mouvements

#### Pion
- Avance en diagonale vers l'avant (1 case)
- Capture en sautant une pièce adverse adjacente
- Peut capturer vers l'arrière

#### Dame
- Se déplace en diagonale (multiple cases)
- Capture en sautant une pièce adverse avec atterrissage libre
- Peut capturer plusieurs fois dans un tour

### Algorithme de capture multiple

```
function findAllCaptures(position, captured = []) {
  let moves = [];
  for each direction:
    if canCapture(position, direction):
      newPos = positionAfterCapture(direction);
      newCaptured = [...captured, capturedPiece];
      
      // Récursion pour captures multiples
      furtherCaptures = findAllCaptures(newPos, newCaptured);
      
      if furtherCaptures.length > 0:
        moves.push(...furtherCaptures);
      else:
        moves.push({ to: newPos, captures: newCaptured });
  
  return moves;
}
```

## Interface utilisateur

### Layout

```
┌─────────────────────────┐
│      Jeu de Dames       │
├─────────────────────────┤
│  Joueur Blanc - Tour    │
├─────────────────────────┤
│   ┌───────────────┐     │
│   │               │     │
│   │   Plateau     │     │
│   │     10×10     │     │
│   │               │     │
│   └───────────────┘     │
├─────────────────────────┤
│  [Nouvelle partie]      │
└─────────────────────────┘
```

### Interactions

1. **Sélection de pièce** : Clic sur une pièce du joueur actif
2. **Affichage des coups** : Highlighter les cases de destination possibles
3. **Mouvement** : Clic sur case highlightée
4. **Animation** : Transition CSS pour déplacement et captures

### Rendu visuel

- Cases noires : `#8B4513` (marron)
- Cases blanches : `#F5DEB3` (beige)
- Pion blanc : Cercle blanc avec bordure
- Pion noir : Cercle noir
- Dame : Pion avec couronne/double bordure
- Case sélectionnée : Bordure jaune épaisse
- Coups possibles : Point vert au centre

## Bots

### Bot Random

Sélectionne un coup légal au hasard parmi les coups disponibles.

```javascript
export function computeMove(state, playerId, random) {
  const legalMoves = engine.getLegalMoves(state, playerId);
  const index = random.nextInt(0, legalMoves.length - 1);
  return legalMoves[index];
}
```

### Bot Smart (Minimax)

Implémente minimax avec alpha-beta pruning :

1. **Fonction d'évaluation**
   - +1 point par pion
   - +3 points par dame
   - +0.5 point par pion protégé
   - +0.3 point par pion au centre
   - +Infini si victoire
   - -Infini si défaite

2. **Profondeur** : 4-6 coups selon performance

3. **Optimisations**
   - Alpha-beta pruning
   - Tri des coups (captures en premier)
   - Cache des positions

## Tests

### Tests unitaires moteur

- ✅ Initialisation du plateau
- ✅ Mouvements simples (pion, dame)
- ✅ Captures simples
- ✅ Captures multiples
- ✅ Promotion en dame
- ✅ Détection de victoire
- ✅ Prise obligatoire
- ✅ Déterminisme (replay)

### Tests bots

- ✅ Bot random joue des coups légaux
- ✅ Bot smart gagne contre random (>80%)
- ✅ Bot smart joue en temps raisonnable (<1s)

## Considérations techniques

### Performance

- Plateau 10×10 = 100 cases vs 9 pour Tic-Tac-Toe
- Calcul des coups légaux plus coûteux
- Minimax limité à profondeur 4-6

### Déterminisme

- Utiliser `seeded-random` pour bot random
- Seed stocké dans l'état du jeu
- Permet replay exact

### Accessibilité

- Support clavier (Tab + Enter)
- ARIA labels pour lecteurs d'écran
- Contraste suffisant pour daltoniens

## Migration et compatibilité

Aucun impact sur le code existant. Ajout pur d'un nouveau jeu au catalogue.
