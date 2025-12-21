# SeededRandom Specification

## Overview

SeededRandom est un générateur de nombres pseudo-aléatoires déterministe. Avec la même seed, il produit toujours la même séquence de nombres. C'est essentiel pour :

- **Replay** : Rejouer une partie exactement
- **Déterminisme** : Même seed + mêmes actions = même résultat
- **ML/IA** : Entraînement reproductible
- **Debug** : Reproduire un bug précis

## Requirements

### Requirement: Determinism

The system SHALL produce identical sequences for identical seeds.

#### Scenario: Same seed
- **WHEN** two SeededRandom instances are created with the same seed
- **THEN** they produce identical sequences of numbers

#### Scenario: Different seeds
- **WHEN** two SeededRandom instances are created with different seeds
- **THEN** they produce different sequences

### Requirement: Isomorphism

The system SHALL work identically on client and server.

#### Scenario: Client execution
- **WHEN** SeededRandom runs in a browser
- **THEN** it produces the expected sequence

#### Scenario: Server execution
- **WHEN** SeededRandom runs in Node.js
- **THEN** it produces the same sequence as in browser

### Requirement: No External Dependencies

The system SHALL not depend on `Math.random()` or crypto APIs.

#### Scenario: Pure implementation
- **WHEN** SeededRandom is instantiated
- **THEN** it uses only its internal algorithm

## Interface

```typescript
/**
 * Générateur de nombres pseudo-aléatoires déterministe.
 * Utilise l'algorithme Mulberry32.
 */
class SeededRandom {
  /**
   * Crée un générateur avec une seed donnée.
   * @param seed - Nombre entier pour initialiser le générateur
   */
  constructor(seed: number);

  /**
   * Retourne un nombre flottant dans [0, 1[
   * Équivalent de Math.random() mais déterministe.
   */
  random(): number;

  /**
   * Retourne un entier dans [min, max] (inclus).
   * @param min - Borne inférieure (incluse)
   * @param max - Borne supérieure (incluse)
   */
  int(min: number, max: number): number;

  /**
   * Retourne un élément aléatoire d'un tableau.
   * @param array - Tableau non vide
   * @throws Error si le tableau est vide
   */
  pick<T>(array: T[]): T;

  /**
   * Mélange un tableau en place (Fisher-Yates).
   * @param array - Tableau à mélanger
   * @returns Le même tableau, mélangé
   */
  shuffle<T>(array: T[]): T[];

  /**
   * Retourne true avec une probabilité donnée.
   * @param probability - Probabilité entre 0 et 1
   */
  chance(probability: number): boolean;

  /**
   * Retourne l'état interne actuel (pour sérialisation/restauration).
   * Note : Ce n'est pas la seed initiale, mais l'état après N appels.
   */
  getState(): number;

  /**
   * Clone le générateur dans son état actuel.
   */
  clone(): SeededRandom;

  /**
   * Crée un générateur à partir d'un état sauvegardé.
   * Utile pour restaurer un générateur après désérialisation.
   * @param state - État obtenu via getState()
   */
  static fromState(state: number): SeededRandom;
}
```

## Algorithme

### Mulberry32

Mulberry32 est un PRNG (Pseudo-Random Number Generator) simple, rapide et de bonne qualité statistique.

```typescript
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    // S'assurer que la seed est un entier 32 bits
    this.state = seed >>> 0;
  }

  random(): number {
    // Algorithme Mulberry32
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    return array[this.int(0, array.length - 1)];
  }

  shuffle<T>(array: T[]): T[] {
    // Fisher-Yates shuffle
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  chance(probability: number): boolean {
    return this.random() < probability;
  }

  getState(): number {
    return this.state;
  }

  clone(): SeededRandom {
    const clone = new SeededRandom(0);
    clone.state = this.state;
    return clone;
  }

  static fromState(state: number): SeededRandom {
    const rng = new SeededRandom(0);
    rng.state = state;
    return rng;
  }
}
```

### Pourquoi Mulberry32 ?

| Critère | Mulberry32 | Math.random() | Mersenne Twister |
|---------|------------|---------------|------------------|
| Déterministe | ✅ Oui | ❌ Non | ✅ Oui |
| Taille code | ~10 lignes | N/A | ~100 lignes |
| Performance | Très rapide | Rapide | Rapide |
| Qualité | Bonne | Variable | Excellente |
| Isomorphe | ✅ Oui | ❌ Non | ✅ Oui |

Mulberry32 est le meilleur compromis simplicité/qualité pour notre usage.

## Examples

### Création et utilisation basique

```typescript
const rng = new SeededRandom(12345);

// Toujours les mêmes valeurs avec seed 12345
console.log(rng.random());  // 0.1847...
console.log(rng.random());  // 0.7234...
console.log(rng.int(1, 6)); // 4 (dé à 6 faces)
```

### Distribution de cartes

```typescript
function createDeck(): string[] {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: string[] = [];

  for (const suit of suits) {
    for (const value of values) {
      deck.push(value + suit);
    }
  }
  return deck;
}

function dealCards(seed: number, handSize: number): string[] {
  const rng = new SeededRandom(seed);
  const deck = createDeck();
  rng.shuffle(deck);
  return deck.slice(0, handSize);
}

// Même seed = même main
const hand1 = dealCards(42, 5); // ["7♦", "K♠", "3♥", "9♣", "A♦"]
const hand2 = dealCards(42, 5); // ["7♦", "K♠", "3♥", "9♣", "A♦"] (identique)
const hand3 = dealCards(99, 5); // ["2♣", "J♥", "5♠", "Q♦", "8♣"] (différent)
```

### Utilisation dans un GameEngine

```typescript
interface GameState {
  board: number[][];
  rngState: number; // Sauvegarder l'état du RNG
}

class MyGameEngine implements GameEngine<GameState, Action, View, Config> {
  private rng: SeededRandom;

  init(config: Config): GameState {
    // Créer le RNG avec la seed de la config
    this.rng = new SeededRandom(config.seed);

    return {
      board: this.generateBoard(),
      rngState: this.rng.getState(),
    };
  }

  private generateBoard(): number[][] {
    // Utiliser this.rng pour toute génération aléatoire
    const board: number[][] = [];
    for (let i = 0; i < 10; i++) {
      const row: number[] = [];
      for (let j = 0; j < 10; j++) {
        row.push(this.rng.int(0, 9));
      }
      board.push(row);
    }
    return board;
  }

  // Restaurer l'état du RNG depuis un état sauvegardé
  restore(state: GameState): void {
    this.rng = SeededRandom.fromState(state.rngState);
  }
}
```

### Tests unitaires

```typescript
describe('SeededRandom', () => {
  it('should be deterministic', () => {
    const rng1 = new SeededRandom(12345);
    const rng2 = new SeededRandom(12345);

    for (let i = 0; i < 100; i++) {
      expect(rng1.random()).toBe(rng2.random());
    }
  });

  it('should produce values in [0, 1[', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 1000; i++) {
      const value = rng.random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('should produce integers in range', () => {
    const rng = new SeededRandom(42);

    for (let i = 0; i < 1000; i++) {
      const value = rng.int(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it('should shuffle deterministically', () => {
    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [1, 2, 3, 4, 5];

    new SeededRandom(42).shuffle(arr1);
    new SeededRandom(42).shuffle(arr2);

    expect(arr1).toEqual(arr2);
  });
});
```

## Bonnes Pratiques

### ✅ À faire

- Toujours utiliser `SeededRandom` dans les moteurs de jeu
- Sauvegarder `rngState` dans l'état du jeu pour le replay
- Documenter la seed utilisée pour les tests

### ❌ À éviter

- Ne jamais utiliser `Math.random()` dans un moteur
- Ne pas créer plusieurs instances avec des seeds dérivées (corrélation)
- Ne pas utiliser pour la cryptographie (pas sécurisé)
