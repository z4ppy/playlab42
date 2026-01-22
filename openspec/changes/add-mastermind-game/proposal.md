# Proposal: Add Mastermind Game

**Change ID**: `add-mastermind-game`  
**Status**: Draft  
**Created**: 2026-01-22  
**Author**: AI Assistant

## Context

Mastermind est un jeu de déduction classique où un joueur (le décodeur) doit deviner une combinaison secrète de couleurs choisie par l'ordinateur (le codeur). Après chaque tentative, des indices sont fournis pour guider le joueur.

Ce jeu est idéal pour Playlab42 car :
- **Pédagogique** : Excellente introduction aux algorithmes de recherche et à l'élimination de possibilités
- **Déterministe** : Génération de code secret basée sur un seed
- **Simple à implémenter** : Logique de jeu claire et état minimal
- **Accessible** : L'humain décode, l'ordinateur génère et valide automatiquement

## Objective

Ajouter un jeu Mastermind fonctionnel dans Playlab42 avec :
- Moteur isomorphe respectant les règles officielles
- Interface utilisateur intuitive
- Au moins 2 bots de difficulté différente
- Tests unitaires complets

## Scope

### In Scope

- **Moteur de jeu** (`games/mastermind/engine.js`) :
  - Génération de code secret seedé (ordinateur = codeur)
  - Validation des tentatives du joueur humain
  - Calcul des indices (pions noirs/blancs)
  - Détection de victoire/défaite
  
- **Interface** (`games/mastermind/index.html`) :
  - Affichage de la grille de tentatives
  - Sélection des couleurs par l'humain (décodeur)
  - Affichage automatique des feedbacks
  - Historique des coups
  - Révélation du code secret en fin de partie

- **Manifest** (`games/mastermind/game.json`) :
  - Configuration du jeu (1 joueur humain uniquement)
  - Métadonnées

- **Tests** (`games/mastermind/engine.test.js`) :
  - Tests unitaires du moteur
  - Tests des scénarios de jeu
  - Tests de l'algorithme de feedback

### Out of Scope

- Mode multijoueur (humain vs humain)
- Bot "Expert" utilisant l'algorithme de Knuth (peut être ajouté plus tard)
- Variantes du jeu (SuperMastermind avec 5 pions, autres règles)
- Statistiques avancées (temps moyen, graphiques)

## Rules (Official Mastermind)

### Setup
- **Code secret** : 4 pions parmi 6 couleurs possibles (doublons autorisés)
- **Codeur** : L'ordinateur génère le code secret
- **Décodeur** : L'humain tente de deviner

### Gameplay
1. Le décodeur propose une combinaison de 4 couleurs
2. Le codeur donne un feedback :
   - **Pion noir** : Une couleur est correcte ET bien placée
   - **Pion blanc** : Une couleur est correcte MAIS mal placée
   - **Rien** : Aucune correspondance
3. Les feedbacks ne révèlent pas quelle couleur correspond à quel indice
4. Le décodeur a **10 tentatives maximum**

### Victory Conditions
- **Victoire** : Le décodeur trouve le code exact (4 pions noirs)
- **Défaite** : 10 tentatives échouées

### Important Notes
- Les feedbacks sont triés (noirs d'abord, puis blancs)
- Un pion ne peut générer qu'un seul feedback (pas de double comptage)
- Les couleurs : Rouge, Bleu, Vert, Jaune, Orange, Violet

## Impact Analysis

### Specs Modified

- **game-engine** : Aucune modification requise (Mastermind est single-player, utilise l'interface existante)
- **manifests** : Aucune modification requise (format existant suffit)
- **catalogue** : Automatiquement mis à jour par le build

### New Capabilities

- **mastermind** : Nouvelle spec pour les règles spécifiques du Mastermind

### Dependencies

- `lib/seeded-random.js` : Pour la génération déterministe du code secret
- `lib/gamekit.js` : Utilitaires pour l'interface (si applicable)

## Technical Approach

### Architecture

```
games/mastermind/
├── game.json           # Manifest
├── engine.js           # Moteur isomorphe
├── engine.test.js      # Tests unitaires
├── index.html          # Interface joueur
└── thumb.png           # Miniature pour le catalogue
```

### State Design

```typescript
interface MastermindState {
  secretCode: Color[];           // [4] - Code à deviner (caché côté client)
  attempts: Attempt[];           // Historique des tentatives (max 10)
  currentAttempt: Color[];       // Tentative en cours de construction
  gameOver: boolean;
  winner: string | null;         // playerId du gagnant, null si défaite
  maxAttempts: number;           // 10
  rngState: number;              // Pour le RNG
  playerId: string;              // ID du joueur unique
}

interface Attempt {
  code: Color[];                 // [4] - Combinaison proposée
  feedback: Feedback;            // Résultat
}

interface Feedback {
  black: number;                 // 0-4 : Correct position + couleur
  white: number;                 // 0-4 : Couleur correcte mais mauvaise position
}

type Color = 'R' | 'B' | 'G' | 'Y' | 'O' | 'V'; // Rouge, Bleu, Vert, Jaune, Orange, Violet
```

### Actions

```typescript
type MastermindAction = 
  | { type: 'submit', code: Color[] }  // Soumettre une tentative
  | { type: 'reset' };                  // Recommencer (nouvelle partie)
```

### Key Algorithms

**Feedback Calculation** (algorithmically complex part):
1. Compter les pions noirs : positions exactes identiques
2. Pour les positions restantes :
   - Compter les occurrences de chaque couleur dans le code et la tentative
   - Les blancs = min(occurrences) pour chaque couleur

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Algorithme de feedback incorrect | High | Tests unitaires exhaustifs avec cas limites |
| Génération non-seedée | Medium | Utiliser SeededRandom dès l'init |
| Interface confuse | Medium | UX simple inspirée du jeu physique |
| Joueur ne comprend pas les feedbacks | Medium | Légende claire, exemples, tooltips |

## Success Criteria

- [ ] Le jeu apparaît dans le catalogue
- [ ] Une partie complète est jouable du début à la fin (humain décodeur)
- [ ] Les feedbacks sont toujours corrects (calculés par l'ordinateur)
- [ ] Le code secret est différent à chaque nouvelle partie
- [ ] Le replay avec même seed donne les mêmes résultats
- [ ] Couverture de tests > 90%
- [ ] Documentation claire dans le code
- [ ] L'interface est intuitive (aucune confusion sur les rôles)

## Future Enhancements (Not in Scope)

- **Bots IA** : Random (easy), Smart (medium), Expert (Knuth algorithm)
- **Mode inversé** : Humain codeur, ordinateur décodeur (observer l'IA jouer)
- Mode multijoueur (humain codeur vs humain décodeur)
- Variante SuperMastermind (5 pions, 8 couleurs)
- Statistiques : distribution du nombre de coups, courbes d'apprentissage
- Mode "practice" avec indices progressifs

## References

- [Mastermind (Wikipedia)](https://fr.wikipedia.org/wiki/Mastermind)
- [Knuth's Algorithm (1977)](https://en.wikipedia.org/wiki/Mastermind_(board_game)#Worst_case:_Five-guess_algorithm) - Pour futures implémentations de bots
- Existing games: `games/tictactoe/`, `games/go-9x9/`
- Specs: `openspec/specs/game-engine/spec.md`
