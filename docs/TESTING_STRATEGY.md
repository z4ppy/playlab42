# Stratégie de Tests

Ce document décrit l'approche de test, les objectifs de coverage, et les bonnes pratiques pour Playlab42.

## Table des matières

1. [Philosophie](#philosophie)
2. [Types de tests](#types-de-tests)
3. [Objectifs de coverage](#objectifs-de-coverage)
4. [Stack de test](#stack-de-test)
5. [Organisation des tests](#organisation-des-tests)
6. [Bonnes pratiques](#bonnes-pratiques)
7. [Exemples](#exemples)
8. [CI/CD](#cicd)

---

## Philosophie

### Principes directeurs

**Playlab42 est un projet pédagogique** : le code doit être exemplaire et bien testé.

**Principes** :

1. **Tests comme documentation** : Les tests documentent le comportement attendu
2. **Confiance dans le refactoring** : Les tests permettent de refactorer sans peur
3. **Détection précoce** : Les tests détectent les régressions avant la production
4. **Pédagogie** : Les tests servent d'exemples pour les participants aux formations

### Priorités

| Priorité | Type | Objectif |
|----------|------|----------|
| **1** | Bibliothèques partagées (`lib/`) | 100% coverage |
| **2** | Moteurs de jeux | 90%+ coverage |
| **3** | Scripts de build | 80%+ coverage |
| **4** | Code UI/DOM | Best effort (difficulté de test) |

### Ce qu'on teste

✅ **Toujours tester** :
- Fonctions pures (ex: moteurs de jeux, utilitaires)
- Logique métier
- Algorithmes (ex: bots IA)
- Validations et transformations de données
- Scripts de build

❓ **À évaluer** :
- Code UI/DOM (difficile, coût/bénéfice)
- Intégrations externes (utiliser mocks)

❌ **Ne pas tester** :
- Fichiers de configuration (jest.config.js, eslint.config.js)
- Code tiers (node_modules)
- Fichiers générés

---

## Types de tests

### 1. Tests unitaires

**Objectif** : Tester une unité de code isolément (fonction, classe, module)

**Scope** : 95% des tests

**Exemples** :
- `lib/seeded-random.test.js` : Tests de SeededRandom
- `games/tic-tac-toe/engine.test.js` : Tests du moteur de jeu

**Caractéristiques** :
- Rapides (< 100ms par test)
- Isolés (pas d'I/O, pas de réseau)
- Déterministes (même input = même output)

### 2. Tests d'intégration

**Objectif** : Tester l'interaction entre plusieurs modules

**Scope** : 5% des tests (pour l'instant)

**Exemples** :
- Tester le chargement d'un game via GameKit
- Tester la génération du catalogue complet

**Caractéristiques** :
- Plus lents que les unitaires
- Peuvent nécessiter des mocks
- Testent les contrats entre modules

### 3. Tests E2E (End-to-End)

**Statut** : Pas encore implémentés (roadmap)

**Objectif** : Tester le système complet dans un navigateur

**Exemples futurs** :
- Ouvrir le portail → Cliquer sur un tool → Vérifier qu'il charge
- Jouer une partie de Tic-Tac-Toe complète

**Stack future** : Playwright ou Cypress

---

## Objectifs de coverage

### Targets globaux

| Métrique | Target actuel | Target MVP final | Long terme |
|----------|---------------|------------------|------------|
| **Global** | 70% | 80% | 85%+ |
| **Branches** | 60% | 70% | 80%+ |
| **Functions** | 70% | 80% | 85%+ |
| **Lines** | 70% | 80% | 85%+ |

### Targets par module

| Module | Coverage actuel | Target | Justification |
|--------|-----------------|--------|---------------|
| `lib/seeded-random.js` | 100% | 100% | Bibliothèque critique, déterministe |
| `lib/gamekit.js` | N/A | 90%+ | SDK utilisé par tous les jeux |
| `lib/assets.js` | N/A | 80%+ | Utilitaire |
| Moteurs de jeux | 70%+ | 90%+ | Logique métier critique |
| Bots IA | 50%+ | 80%+ | Algorithmes complexes |
| Scripts build | 60%+ | 80%+ | Génération catalogue/parcours |
| UI/DOM | Best effort | 50%+ | Difficile à tester, coût élevé |

### Configuration Codecov

**Fichier** : `codecov.yml`

```yaml
coverage:
  status:
    project:
      default:
        target: auto      # Basé sur historique
        threshold: 1%     # Tolérance -1%
    patch:
      default:
        target: 80%       # Nouveau code doit être >= 80%
```

**Interprétation** :

- **Project target: auto** : Codecov ajuste le target automatiquement en fonction de l'historique
- **Threshold: 1%** : Autoriser une baisse de 1% maximum
- **Patch target: 80%** : Tout nouveau code doit avoir au moins 80% de coverage

**Statut dans les PRs** :

- ✅ : Coverage maintenu ou amélioré
- ❌ : Coverage baisse de plus de 1% OU nouveau code < 80%

---

## Stack de test

### Framework : Jest

**Version** : 30.2.0+

**Configuration** : `jest.config.js`

```javascript
export default {
  testEnvironment: 'node',        // Pas de DOM (pour l'instant)
  transform: {},                  // Pas de transpilation (ES modules natifs)
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.test.js',
    '**/*.spec.js'
  ],
  collectCoverageFrom: [
    'lib/**/*.js',
    'src/**/*.js',
    'games/**/*.js',
    '!**/*.test.js',
    '!**/*.spec.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
```

### Assertions

Jest fournit `expect()` avec de nombreux matchers :

```javascript
expect(value).toBe(expected);           // Égalité stricte
expect(value).toEqual(expected);        // Égalité profonde (objets)
expect(value).toBeCloseTo(0.3, 5);      // Nombres flottants
expect(array).toContain(item);          // Tableau contient
expect(fn).toThrow();                   // Fonction lance erreur
expect(mock).toHaveBeenCalledWith(...); // Mock appelé avec args
```

### Mocks

Pour tester du code avec dépendances :

```javascript
// Mock d'une fonction
const mockFn = jest.fn();
mockFn.mockReturnValue(42);

// Mock d'un module
jest.mock('./module.js', () => ({
  functionName: jest.fn()
}));

// Spy sur une méthode
const spy = jest.spyOn(object, 'method');
```

### Coverage

Généré automatiquement avec `--coverage` :

```bash
npm run test:coverage
```

**Outputs** :
- `coverage/lcov.info` : Format LCOV (pour Codecov)
- `coverage/lcov-report/index.html` : Rapport HTML interactif
- Console : Tableau récapitulatif

---

## Organisation des tests

### Structure de fichiers

**Convention** : `<nom-fichier>.test.js` à côté du fichier source

```
lib/
├── seeded-random.js
└── seeded-random.test.js      ← Test à côté

games/tic-tac-toe/
├── engine.js
├── engine.test.js             ← Test à côté
├── bot-minimax.js
└── bot-minimax.test.js        ← Test à côté
```

**Alternative** : Dossier `__tests__/` (pour gros modules)

```
src/scripts/
├── build-catalogue.js
└── __tests__/
    └── build-catalogue.test.js
```

### Structure d'un fichier de test

**Template** :

```javascript
/**
 * Tests pour <nom-du-module>
 *
 * @group <catégorie>
 */

import { functionName } from './module.js';

describe('ModuleName', () => {
  // Setup commun (si nécessaire)
  beforeEach(() => {
    // Initialisation avant chaque test
  });

  afterEach(() => {
    // Nettoyage après chaque test
  });

  describe('functionName', () => {
    test('should do X when Y', () => {
      // Arrange
      const input = 'value';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('expected');
    });

    test('should throw error when invalid input', () => {
      expect(() => functionName(null)).toThrow();
    });
  });

  describe('edge cases', () => {
    test('should handle empty input', () => {
      expect(functionName('')).toBe('');
    });

    test('should handle large numbers', () => {
      expect(functionName(Number.MAX_SAFE_INTEGER)).toBeDefined();
    });
  });
});
```

### Nommage des tests

**Convention** : `test('should <comportement> when <condition>', ...)`

**Exemples** :

```javascript
// ✅ Bon
test('should return 0 when seed is 0', () => { ... });
test('should throw error when seed is negative', () => { ... });
test('should generate same sequence with same seed', () => { ... });

// ❌ Mauvais
test('test 1', () => { ... });
test('works', () => { ... });
test('function returns value', () => { ... });
```

**Pourquoi** : Les noms descriptifs servent de documentation

---

## Bonnes pratiques

### 1. AAA Pattern (Arrange-Act-Assert)

Structurer chaque test en 3 parties :

```javascript
test('should calculate total with tax', () => {
  // Arrange : Préparer les données
  const price = 100;
  const taxRate = 0.2;

  // Act : Exécuter la fonction
  const result = calculateTotal(price, taxRate);

  // Assert : Vérifier le résultat
  expect(result).toBe(120);
});
```

### 2. Test une seule chose par test

```javascript
// ❌ Mauvais : teste plusieurs choses
test('should handle user operations', () => {
  const user = createUser('Alice');
  expect(user.name).toBe('Alice');

  updateUser(user, { age: 30 });
  expect(user.age).toBe(30);

  deleteUser(user);
  expect(getUser(user.id)).toBeUndefined();
});

// ✅ Bon : un test par opération
test('should create user with name', () => {
  const user = createUser('Alice');
  expect(user.name).toBe('Alice');
});

test('should update user age', () => {
  const user = createUser('Alice');
  updateUser(user, { age: 30 });
  expect(user.age).toBe(30);
});

test('should delete user', () => {
  const user = createUser('Alice');
  deleteUser(user);
  expect(getUser(user.id)).toBeUndefined();
});
```

### 3. Tester les edge cases

```javascript
describe('divide', () => {
  test('should divide two positive numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  // Edge cases
  test('should throw error when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  test('should handle negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });

  test('should handle decimals', () => {
    expect(divide(10, 3)).toBeCloseTo(3.333, 3);
  });
});
```

### 4. Utiliser des données de test réalistes

```javascript
// ❌ Mauvais : données trop simples
test('should validate user', () => {
  const user = { name: 'A' };
  expect(validateUser(user)).toBe(true);
});

// ✅ Bon : données réalistes
test('should validate user with all required fields', () => {
  const user = {
    id: '123',
    name: 'Alice Dupont',
    email: 'alice.dupont@example.com',
    createdAt: new Date('2025-01-01')
  };
  expect(validateUser(user)).toBe(true);
});
```

### 5. Tests déterministes

```javascript
// ❌ Mauvais : dépend de l'ordre d'exécution
let counter = 0;
test('test 1', () => {
  counter++;
  expect(counter).toBe(1);
});
test('test 2', () => {
  counter++;
  expect(counter).toBe(2);  // ❌ Échouera si exécuté seul
});

// ✅ Bon : chaque test est isolé
test('should increment counter', () => {
  let counter = 0;
  counter++;
  expect(counter).toBe(1);
});

test('should increment counter independently', () => {
  let counter = 0;
  counter++;
  expect(counter).toBe(1);
});
```

### 6. Éviter les magic numbers

```javascript
// ❌ Mauvais
test('should roll dice', () => {
  const result = rollDice();
  expect(result).toBeGreaterThanOrEqual(1);
  expect(result).toBeLessThanOrEqual(6);
});

// ✅ Bon
test('should roll dice between MIN and MAX', () => {
  const MIN_DICE_VALUE = 1;
  const MAX_DICE_VALUE = 6;

  const result = rollDice();

  expect(result).toBeGreaterThanOrEqual(MIN_DICE_VALUE);
  expect(result).toBeLessThanOrEqual(MAX_DICE_VALUE);
});
```

---

## Exemples

### Exemple 1 : Fonction pure (SeededRandom)

**Fichier** : `lib/seeded-random.test.js`

```javascript
import { SeededRandom } from './seeded-random.js';

describe('SeededRandom', () => {
  describe('constructor', () => {
    test('should create instance with seed', () => {
      const rng = new SeededRandom(42);
      expect(rng).toBeInstanceOf(SeededRandom);
    });

    test('should throw error when seed is missing', () => {
      expect(() => new SeededRandom()).toThrow();
    });
  });

  describe('next', () => {
    test('should generate deterministic sequence', () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);

      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    test('should generate different sequences for different seeds', () => {
      const rng1 = new SeededRandom(111);
      const rng2 = new SeededRandom(222);

      expect(rng1.next()).not.toBe(rng2.next());
    });
  });

  describe('nextInRange', () => {
    test('should generate number in range [min, max)', () => {
      const rng = new SeededRandom(42);
      const min = 10;
      const max = 20;

      for (let i = 0; i < 1000; i++) {
        const value = rng.nextInRange(min, max);
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThan(max);
      }
    });
  });
});
```

**Coverage** : 100%

### Exemple 2 : Moteur de jeu (Tic-Tac-Toe)

**Fichier** : `games/tic-tac-toe/engine.test.js`

```javascript
import { TicTacToeEngine } from './engine.js';

describe('TicTacToeEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new TicTacToeEngine();
  });

  describe('initialization', () => {
    test('should create empty 3x3 board', () => {
      const state = engine.getInitialState();
      expect(state.board).toEqual([
        [null, null, null],
        [null, null, null],
        [null, null, null]
      ]);
    });

    test('should start with player X', () => {
      const state = engine.getInitialState();
      expect(state.currentPlayer).toBe('X');
    });
  });

  describe('applyMove', () => {
    test('should place mark on empty cell', () => {
      let state = engine.getInitialState();
      state = engine.applyMove(state, { row: 0, col: 0 });

      expect(state.board[0][0]).toBe('X');
    });

    test('should throw error when cell is occupied', () => {
      let state = engine.getInitialState();
      state = engine.applyMove(state, { row: 0, col: 0 });

      expect(() => {
        engine.applyMove(state, { row: 0, col: 0 });
      }).toThrow('Cell already occupied');
    });
  });

  describe('checkWinner', () => {
    test('should detect horizontal win', () => {
      const state = {
        board: [
          ['X', 'X', 'X'],
          [null, null, null],
          [null, null, null]
        ],
        currentPlayer: 'X'
      };

      expect(engine.checkWinner(state)).toBe('X');
    });

    test('should return null when no winner', () => {
      const state = engine.getInitialState();
      expect(engine.checkWinner(state)).toBe(null);
    });
  });
});
```

**Coverage target** : 90%+

---

## CI/CD

### Workflow GitHub Actions

**Fichier** : `.github/workflows/ci.yml`

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v5
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
```

### Statut dans les PRs

Codecov ajoute automatiquement un commentaire sur chaque PR :

```markdown
## Codecov Report
Merging #123 will **increase** coverage by `0.42%`.
The diff coverage is `85.71%`.

| Files | Coverage Δ | Complexity Δ |
|-------|------------|--------------|
| lib/seeded-random.js | 100.00% (ø) | 0 (ø) |
```

**Actions requises** :

- Si coverage baisse : Ajouter des tests
- Si patch < 80% : Ajouter des tests pour nouveau code
- Si échec : Bloquer le merge

---

## Roadmap

### Phase actuelle (MVP)

- [x] Configuration Jest
- [x] Tests pour `lib/seeded-random.js` (100%)
- [x] Tests pour `parcours-viewer` (90%+)
- [ ] Tests pour `lib/gamekit.js`
- [ ] Tests pour moteurs de jeux
- [ ] Tests pour scripts de build

### Phase 2

- [ ] Tests d'intégration
- [ ] Tests E2E avec Playwright
- [ ] Visual regression testing
- [ ] Performance testing

### Phase 3

- [ ] Mutation testing (Stryker)
- [ ] Property-based testing (fast-check)
- [ ] Benchmarking automatisé

---

## Ressources

- [Jest Documentation](https://jestjs.io/)
- [Codecov Documentation](https://docs.codecov.com/)
- [Testing Best Practices (testingjavascript.com)](https://testingjavascript.com/)
- [AAA Pattern](https://automationpanda.com/2020/07/07/arrange-act-assert-a-pattern-for-writing-good-tests/)

---

*Document maintenu par l'équipe Docaposte*
*Dernière mise à jour : 2025-12-14*
