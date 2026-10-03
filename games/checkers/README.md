# Jeu de Dames (Checkers)

Implémentation du jeu de dames françaises (10×10) pour Playlab42.

## 🎮 Règles du jeu

Le jeu de dames françaises se joue sur un plateau de 10×10 cases avec 20 pions par joueur.

### Objectif

Éliminer toutes les pièces adverses ou les bloquer pour qu'elles ne puissent plus bouger.

### Mouvements

- **Pions** : Se déplacent en diagonale vers l'avant d'une case
- **Dames** : Se déplacent en diagonale sur plusieurs cases (obtenues en atteignant la dernière rangée)

### Captures

- Les captures se font par saut diagonal au-dessus d'une pièce adverse
- **La prise est obligatoire** : si une capture est possible, vous devez la jouer
- **Prises multiples** : Vous pouvez capturer plusieurs pièces en chaîne dans le même tour
- Les pions peuvent capturer vers l'arrière

### Promotion

Un pion qui atteint la dernière rangée adverse est promu en **dame** (♛).

## 🏗️ Architecture

```
games/checkers/
├── engine.js          # Moteur de jeu isomorphe
├── engine.test.js     # Tests unitaires
├── index.html         # Interface utilisateur
├── game.json          # Manifest du jeu
├── README.md          # Cette documentation
└── bots/
    ├── random.js      # Bot jouant au hasard
    └── smart.js       # Bot avec algorithme Minimax
```

## 🤖 Bots disponibles

### Random Bot (Facile)

Joue des coups aléatoires parmi les coups valides.

### Smart Bot (Moyen)

Utilise l'algorithme Minimax avec alpha-beta pruning pour jouer stratégiquement :

- Profondeur de recherche : 4 coups
- Fonction d'évaluation basée sur :
  - Nombre et type de pièces (pions = 100 points, dames = 300 points)
  - Position des pièces (bonus pour centre et avancement)
  - Contrôle du plateau

## 🧪 Tests

Les tests unitaires couvrent :

- ✅ Initialisation du plateau (20 pions par joueur)
- ✅ Mouvements simples (pions et dames)
- ✅ Captures simples et multiples
- ✅ Prise obligatoire
- ✅ Promotion en dame
- ✅ Détection de fin de partie (élimination et blocage)
- ✅ Déterminisme (replay)

Exécuter les tests :

```bash
npm test games/checkers/engine.test.js
```

## 🎨 Interface utilisateur

L'interface est responsive et supporte :

- Sélection visuelle des pièces
- Affichage des coups possibles (points verts)
- Animations de déplacement
- Indicateur de joueur actif
- Détection automatique de fin de partie

### Couleurs

- Cases claires : `#F5DEB3` (beige)
- Cases foncées : `#8B4513` (marron)
- Pions blancs : Dégradé blanc avec ombre
- Pions noirs : Dégradé noir avec ombre
- Dames : Symbole couronne (♛) doré

## 🔧 Développement

### Ajouter un nouveau bot

1. Créer un fichier dans `bots/`
2. Implémenter la méthode `chooseAction(state, validActions, rng)`
3. Ajouter le bot dans `game.json`

Exemple :

```javascript
export class MonBot {
  name = 'Mon Bot';
  description = 'Description';
  difficulty = 'easy';

  chooseAction(state, validActions, rng) {
    // Logique du bot
    return validActions[0];
  }
}
```

### Modifier les règles

Le moteur de jeu (`engine.js`) implémente toutes les règles. Principales méthodes :

- `init(config)` : Initialise une partie
- `applyAction(state, action, playerId)` : Applique une action
- `getValidActions(state, playerId)` : Retourne les coups valides
- `getPlayerView(state, playerId)` : Vue du joueur (pas de fog of war)
- `isGameOver(state)` : Vrai si le statut n'est plus `playing`
- `getWinners(state)` : IDs du gagnant dans un tableau, ou `null` (en cours/nul)
- `getCurrentPlayer(state)` : ID du joueur actif, ou `null` après la fin

Ces accesseurs sont additifs : `status`, `winner` (index 0/1), `currentPlayer`
et le format JSON ne changent pas. Les actions sans type `move` ou sans
extrémités sont refusées explicitement. Les trajets de capture et les règles
géométriques existants restent inchangés.

## 📚 Références

- [Spec OpenSpec](../../openspec/changes/add-checkers-game/)
- [Game Engine Spec](../../openspec/specs/game-engine/spec.md)
- [Bot Spec](../../openspec/specs/bot/spec.md)

## 📝 Licence

MIT - Playlab42
