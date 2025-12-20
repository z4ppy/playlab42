# SeededRandom Spec - Delta

> Modifications à apporter à `openspec/specs/seeded-random/spec.md`

## Changements dans l'interface

### Avant (spec actuelle)

```typescript
class SeededRandom {
  // ...

  /**
   * Retourne la seed actuelle (pour sérialisation).
   */
  getSeed(): number;

  /**
   * Clone le générateur dans son état actuel.
   */
  clone(): SeededRandom;
}
```

### Après (aligné avec le code)

```typescript
class SeededRandom {
  // ...

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

## Justification du renommage

Le nom `getState()` est plus précis que `getSeed()` car :

1. **Clarté sémantique** : La valeur retournée n'est pas la seed initiale, mais l'état interne après N appels à `random()`
2. **Cohérence avec `fromState()`** : Symétrie get/from
3. **Évite la confusion** : `getSeed()` pourrait laisser penser qu'on récupère la seed originale

## Exemple d'utilisation mis à jour

### Sérialisation/Restauration

```typescript
// Créer et utiliser un générateur
const rng = new SeededRandom(12345);
rng.random(); // Avance l'état
rng.random();

// Sauvegarder l'état
const savedState = rng.getState();

// Plus tard, restaurer
const restoredRng = SeededRandom.fromState(savedState);

// Les deux produisent la même séquence à partir de maintenant
console.log(rng.random() === restoredRng.random()); // true
```

### Dans un GameEngine

```typescript
interface GameState {
  board: number[][];
  rngState: number; // Utiliser getState(), pas getSeed()
}

class MyGameEngine {
  private rng: SeededRandom;

  init(config: Config): GameState {
    this.rng = new SeededRandom(config.seed);
    return {
      board: this.generateBoard(),
      rngState: this.rng.getState(), // ← Mis à jour
    };
  }

  // Restaurer depuis un état sauvegardé
  restore(state: GameState): void {
    this.rng = SeededRandom.fromState(state.rngState); // ← Nouveau
  }
}
```

## Sections à modifier dans la spec

1. **Interface** (lignes 48-103) : Remplacer `getSeed()` par `getState()` et ajouter `fromState()`
2. **Algorithme** (lignes 152-154) : Renommer la méthode
3. **Exemples** (ligne 235) : Mettre à jour l'exemple GameEngine
