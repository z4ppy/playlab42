# Go 9x9 Specification

## Overview

Go 9x9 est une implémentation du jeu de Go sur un plateau 9x9, conçue pour Playlab42 avec :

- **Règles standard** : Ko simple, suicide interdit, scoring chinois avec komi 6.5
- **Moteur isomorphe** : Fonctionne client ET serveur
- **Déterminisme** : Rejouable avec seed
- **Bots IA** : Random et Greedy pour le mode solo

**Voir aussi** : [GameEngine Specification](../game-engine/spec.md), [Bot Specification](../bot/spec.md)

## Requirements

### Requirement: Board and Actions (Go 9x9)
The system SHALL provide a 9x9 Go game with legal actions place/pass/resign for two players.

#### Scenario: Board initialization
- **WHEN** a Go 9x9 game is started
- **THEN** a 9x9 empty board is created, Black plays first, and komi is set to 6.5.

#### Scenario: Legal placement
- **WHEN** a player places a stone on an empty intersection
- **THEN** the move is accepted only if it is not suicide (unless it captures) and respects ko simple.

#### Scenario: Pass and resign
- **WHEN** a player chooses `pass`
- **THEN** the turn ends and `passesInARow` increments; two consecutive passes end the game.
- **WHEN** a player chooses `resign`
- **THEN** the game ends immediately with the opponent as winner.

### Requirement: Captures and Ko Simple
The system SHALL enforce capture rules and prevent immediate repetition via simple ko.

#### Scenario: Capture resolution
- **WHEN** a stone is placed
- **THEN** all adjacent opponent groups without liberties are removed and counted as captures.

#### Scenario: Ko simple prevention
- **WHEN** a move would recreate the previous board state after a single-stone capture
- **THEN** that move is rejected as illegal.

### Requirement: Scoring (Chinese, Komi 6.5)
The system SHALL score using Chinese rules with komi 6.5 awarded to White.

#### Scenario: Territory scoring
- **WHEN** the game ends by double pass
- **THEN** the final score is stones on board plus controlled empty territory per color plus komi for White.

#### Scenario: Winner determination
- **WHEN** scoring is computed
- **THEN** the winner is the color with the higher score; a tie yields no winner.

### Requirement: Determinism and Serialization
The Go 9x9 engine SHALL remain deterministic and fully serializable.

#### Scenario: Seeded determinism
- **WHEN** the same sequence of actions and seed are replayed
- **THEN** the resulting state and score are identical.

#### Scenario: JSON state
- **WHEN** the game state is serialized with JSON
- **THEN** it can be restored and continue without loss.

### Requirement: Bots Availability
The Go 9x9 manifest SHALL expose default and available bots (Random, Greedy) for solo play.

#### Scenario: Default bot
- **WHEN** the game is launched with a missing second human player
- **THEN** the default Random bot fills the slot.

#### Scenario: Bot registry
- **WHEN** the manifest is read
- **THEN** `bots.available` lists Random and Greedy with their files and difficulties.

### Requirement: Manifest and Catalogue Entry
The Go 9x9 game SHALL provide a valid manifest and appear in the catalogue.

#### Scenario: Manifest validity
- **WHEN** `game.json` is validated
- **THEN** it contains id `go-9x9`, players {min:2,max:2}, type `turn-based`, tags, orientation `desktop`, icon/emoji, and bots config.

#### Scenario: Catalogue generation
- **WHEN** the catalogue build runs
- **THEN** the Go 9x9 entry is included with path to its index.html and metadata.

## Implementation

### Game State

```typescript
interface Go9x9State extends BaseGameState {
  boardSize: 9;
  board: number[][]; // 9x9 array: 0=empty, 1=black, 2=white
  currentPlayerId: string | null;
  playerIds: [string, string];
  komi: 6.5;
  captures: Record<string, number>;
  passesInARow: number;
  previousBoard: number[][] | null;
  lastMove: Go9x9Action | null;
  scores: { black: number; white: number } | null;
}

interface Go9x9Action {
  type: 'place' | 'pass' | 'resign';
  x?: number; // for place
  y?: number; // for place
}
```

### Rules Implementation

**Ko Simple** : Le moteur mémorise le plateau précédent et interdit tout coup qui recréerait ce plateau exactement.

**Suicide** : Un coup est suicide si après placement, le groupe joué n'a aucune liberté ET n'a capturé aucune pierre adverse.

**Scoring Chinois** : 
- Score = pierres sur plateau + territoires contrôlés + komi (blanc uniquement)
- Territoire : cases vides entourées exclusivement par une couleur
- Komi fixe : 6.5 points pour blanc

**Fin de partie** :
- Double passe consécutif : scoring automatique
- Résignation : victoire immédiate de l'adversaire

## Files

```
games/go-9x9/
├── engine.js           # Moteur isomorphe
├── engine.test.js      # Tests unitaires
├── index.html          # UI standalone
├── game.json           # Manifest
└── bots/
    ├── random.js       # Bot aléatoire (défaut)
    └── greedy.js       # Bot heuristique (captures)
```

## Testing

Tests couverts :
- Initialisation plateau 9x9 vide
- Placement et alternance joueurs
- Détection et interdiction suicide
- Capture de pierres sans libertés
- Prévention ko simple (répétition immédiate)
- Double passe et scoring chinois avec komi
- Résignation
- Sérialisation JSON round-trip

## See Also

- [GameEngine Specification](../game-engine/spec.md) - Interface moteur isomorphe
- [Bot Specification](../bot/spec.md) - Interface bots IA
- [Manifests Specification](../manifests/spec.md) - Format game.json
- [Catalogue Specification](../catalogue/spec.md) - Intégration catalogue
