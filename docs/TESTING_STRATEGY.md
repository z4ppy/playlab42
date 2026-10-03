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
| **4** | Code UI/DOM | Contrats DOM Jest + interactions réelles Playwright en CI |

### Ce qu'on teste

✅ **Toujours tester** :
- Fonctions pures (ex: moteurs de jeux, utilitaires)
- Logique métier
- Algorithmes (ex: bots IA)
- Validations et transformations de données
- Scripts de build
- Interactions UI critiques : clavier natif, focus, dialogues, thèmes et petits écrans

❓ **À évaluer** :
- Intégrations externes (fixtures versionnées, périmètre explicitement documenté)
- Régression visuelle exhaustive et performances (hors suite navigateur minimale)

❌ **Ne pas tester** :
- Fichiers de configuration (jest.config.js, eslint.config.js)
- Code tiers (node_modules)
- Fichiers générés

---

## Types de tests

### 1. Tests unitaires

**Objectif** : Tester une unité de code isolément (fonction, classe, module)

**Scope** : Majorité des tests, notamment règles des jeux et calculs des simulations

**Exemples** :
- `lib/seeded-random.test.js` : Tests de SeededRandom
- `games/tic-tac-toe/engine.test.js` : Tests du moteur de jeu

**Caractéristiques** :
- Rapides (< 100ms par test)
- Isolés (pas d'I/O, pas de réseau)
- Déterministes (même input = même output)

### 2. Tests d'intégration

**Objectif** : Tester l'interaction entre plusieurs modules

**Scope** : Contrats entre modules et DOM, en complément des tests navigateur

**Exemples** :
- Tester le chargement d'un game via GameKit
- Tester la génération du catalogue complet

**Caractéristiques** :
- Plus lents que les unitaires
- Peuvent nécessiter des mocks
- Testent les contrats entre modules

### 3. Tests E2E (End-to-End)

**Statut** : Suite Playwright obligatoire en CI (`.github/workflows/ui-e2e.yml`).

La CI appelle ce workflow après le build et lui transmet l'archive publique.
Avec `PLAYWRIGHT_PREBUILT=1`, le serveur sert `site/` sans reconstruire :
les fichiers testés sont ceux qui seront publiés. Les commandes locales et le
lancement manuel du workflow navigateur gardent la préparation `build:local`.
Le serveur réutilise `serve.json` de la racine pour conserver les URL `.html`
et ne pas casser les chemins relatifs des modules.

**Objectif** : Un petit socle de contrats utilisateur dans Chromium réel, sans ferme de captures.
Les tests vivent dans `e2e/`, séparés de la découverte Jest.

| Contrat | Couverture navigateur |
|---------|------------------------|
| Portail | Chargement des catalogues, quatre onglets aux flèches/Home/End, `/` dans la recherche et le pseudo, filtres secondaires fermés initialement, résumé du filtre replié, compteur et remise à zéro, outil JSON en iframe |
| Liens | Ressources versionnées, descriptions et domaines lisibles sans survol, recherche normalisée, filtres à la demande, états sans résultat/erreur et lecture mobile |
| Guides | Index HTML statique depuis les Markdown canoniques, navigation interne et ancres, références source identifiées, thèmes locaux et code/tableaux sans débordement |
| Parcours | Activation d'une carte par Entrée, vraie slide chargée, navigation Précédent/Suivant, Échap ferme le plan avant le viewer, retour du focus, largeur du plan conservée |
| Thèmes | Choix clavier, état accessible, persistance, préférence système, thème transmis à l'iframe outil, tokens calculés clair/sombre au seuil AA 4,5:1 |
| Jeux | Dames : déplacement légal ; Go hot-seat : deux pierres et fin par passes ; Triomino seed 42 : sélection, rotation et placement exacts, dialogue piégé et retour du focus |
| Commandes natives | Mastermind : palette/pions et tentative ; TicTacToe : victoire hot-seat ; Diese : filtre, piano pressé/relâché et fermeture du dialogue |
| Outils | JSON courant/falsy/erreur et récupération ; Particle Life : rendu, pause et matrice ; Neural Style : sélecteurs de fichiers au clavier et aperçus, sans inférence |
| Relativity | Vrais scripts Three.js/lil-gui, initialisation 3D, impulsion qui consomme de la masse, moteur pressé/relâché, focus déplacé et événement `window.blur` |
| Mobile | Portail et viewer à 320/390 px et paysage 844×390 ; Relativity après redimensionnement, cible moteur visible/non recouverte et activation réelle |
| Galerie UI | Formulaire et carte réels, texte échappé, dialogue natif au clavier avec retour du focus, thèmes et tokens à 320 px |

**Déterminisme** : contextes navigateur neufs, date fixe pour les seeds `Date.now()` fournies par les clients,
seed explicite de Triomino et générateur aléatoire fixe pour Particle Life. Les catalogues
sont construits à partir des manifests actuels : aucun nombre global de cartes n'est figé.
Les bookmarks proviennent de `bookmarks/` et des images versionnées, avec `--skip-og`.
Les fichiers `data/catalogue.json`, `data/parcours.json` et `data/bookmarks.json`
sont générés et ignorés par Git : un checkout neuf les reconstruit avant de servir.
Les assertions attendent les locators/états ; aucun sommeil fixe ni retry qui masque un échec.
Relativity dispose de 60 secondes par scénario pour le rendu 3D logiciel et
la fermeture du contexte ; les assertions gardent leur délai de 10 secondes.
Les exceptions navigateur, scripts externes non déclarés et erreurs HTTP des ressources
locales nécessaires font échouer le test.
Le test `window.blur` envoie cet événement au vrai handler après une pression clavier ;
il ne prétend pas tester le gestionnaire de fenêtres de l'OS headless.

**Réseau et dépendances réelles** : Three **0.186.1** et lil-gui **0.21.0**
sont construits dans `assets/vendor/` par `build:runtime`, avec le core,
les addons et dépendances internes utilisés par Relativity. Son rendu réel
exige WebGL2 ; Particle Life conserve son Canvas2D. `e2e/three-runtime.spec.js`
vérifie les versions, les imports locaux, les contrôles et les erreurs de rendu.
`e2e/fixtures.js` intercepte encore les URL CDN publiques déclarées pour les
supports qui en ont besoin. Tone 15.1.22,
VexFlow 5.0.0 et MathJax 4.1.3 sont construits dans `assets/vendor/` par
`build:runtime`, également lancé par `build:local`. Le navigateur charge
les bundles et les fontes locales de production, sans substitution CDN.
Ce ne sont pas les mocks Jest : le navigateur exécute réellement les bibliothèques,
le rendu, les contrôles et les moteurs de production. Les images/fontes externes et
les poids ML sont bloqués. Le script Magenta reste explicitement indisponible. Dièse
utilise la vraie bibliothèque Tone ; les assertions headless ne constituent pas une
mesure de la restitution sonore ni de sa qualité perceptive. Neural Style
doit afficher l'erreur de chargement du modèle quand sa bibliothèque est absente,
puis accepter les imports locaux ; aucune inférence ni exactitude ML n'est revendiquée.
Le laboratoire Deep Learning/Chart.js n'est pas couvert par ce socle.
La vieille arborescence TensorFlow de Magenta n'est pas ajoutée aux dépendances npm du projet.

`e2e/local-data.spec.js` couvre le téléchargement natif et les octets du Blob
réel, une restauration par choix de fichier au clavier, les exclusions,
le rejet sans mutation et la réinitialisation confirmée dans les réglages.
Le cas mobile contrôle aussi l'absence de débordement à 320 px.
Le portail transmet sa préférence sonore à une nouvelle session GameKit
sur `ready` ; ce contrat est exercé dans `e2e/portal.spec.js`.

### Lancer la suite navigateur

Toutes les commandes suivantes s'exécutent **dans l'environnement Docker isolé**,
jamais sur l'hôte. Le runner navigateur doit utiliser une distribution supportée
par Playwright (Debian/Ubuntu), pas le container Alpine de développement :

```bash
# Depuis la racine du worktree : aucun npm/node sur l'hote.
docker build -f docker/e2e.Dockerfile -t playlab42-e2e .
docker run --rm --init --ipc=host \
  --user "$(id -u):$(id -g)" \
  --mount type=bind,source="$PWD",target=/workspace \
  --mount type=volume,target=/workspace/node_modules \
  playlab42-e2e
```

`docker/e2e.Dockerfile` utilise les navigateurs et dépendances système de l'image
officielle `mcr.microsoft.com/playwright:v1.63.0-noble`. Node 26 et npm sont copiés
depuis `node:26-bookworm-slim` ; le build vérifie explicitement Node 26, compatible
avec le contrat `engines.node >=24`. `npm ci` installe le lockfile **dans l'image**,
pas dans le volume Alpine ni sur l'hôte. Le volume anonyme `node_modules` est
initialisé depuis cette image et supprimé avec le container ; il masque les
dépendances éventuellement présentes dans le bind du worktree. Reconstruire
l'image après toute modification du lockfile. Les builds et rapports sont écrits
dans le worktree monté avec l'UID/GID de l'utilisateur qui lance le runner, pas
avec root. Le cache npm du runtime et son HOME sont sous `/tmp`.
Les cibles Make `test-e2e`/`test-e2e-ui` doivent utiliser ce runner dédié, jamais
`docker compose exec dev` pour lancer le navigateur natif.

Pour ouvrir l'interface Playwright avec le même runner :

```bash
docker run --rm --init --ipc=host -p 8080:8080 \
  --user "$(id -u):$(id -g)" \
  --mount type=bind,source="$PWD",target=/workspace \
  --mount type=volume,target=/workspace/node_modules \
  playlab42-e2e npm run test:e2e:ui -- --ui-host=0.0.0.0 --ui-port=8080
```

En CI Ubuntu, après `npm ci`, l'installation reste
`npx playwright install --with-deps chromium`. Ne pas tenter cette installation
dans Alpine : le Chromium fourni par Playwright est lié à glibc.

Sans `PLAYWRIGHT_BASE_URL`, Playwright lance `npm run build:local`, qui construit
TS, catalogue, parcours et bookmarks avec `--skip-og`, puis lance et arrête son
serveur local. CI et Docker utilisent ce même serveur géré et donc ce même build
hors réseau, sans dépendre de catalogues préexistants.
Le port par défaut est 4173 ; `PLAYWRIGHT_PORT` permet d'isoler plusieurs
exécutions simultanées. Un serveur existant n'est jamais réutilisé implicitement.
Ne pas utiliser `npm run build` pour cette suite : il lance les fetches Open Graph.

Pour un serveur **déjà lancé** (accessible depuis le container du runner), préparer
les mêmes artefacts avant de servir, puis :

```bash
npm run build:local
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5242 npm run test:e2e
```

Avec cette variable, aucun serveur n'est créé ni arrêté par Playwright.
`playwright-report/` et `test-results/` sont des sorties non versionnées. En cas
d'échec, le rapport HTML, la trace et la capture du test permettent le diagnostic ;
il n'y a pas de captures de référence à maintenir.

### Repli de validation vers un Chromium existant

Si le téléchargement de l'image navigateur est indisponible, le runner peut
recevoir `PLAYLAB_CDP_ENDPOINT` (URL HTTP du navigateur ou WebSocket CDP) pour
utiliser un **vrai Chromium déjà lancé** via `connectOverCDP`. Aucun navigateur
local n'est alors lancé ; les tests créent leurs propres contextes isolés, gardent
les mêmes fixtures CDN réelles et ferment leurs contextes/connexion à la fin.
Une erreur de connexion fait échouer la suite, sans repli silencieux.
Ce mode utilise un seul worker : un navigateur CDP partagé ne peut pas conserver
simultanément le focus de plusieurs pages. La CI native garde deux workers.

Les deux valeurs viennent de l'environnement, pas du dépôt :

```bash
# Dans le container du runner, dependances npm deja installees pour ce container.
PLAYLAB_CDP_ENDPOINT="$CHROMIUM_CDP_URL" \
  PLAYWRIGHT_BASE_URL="$APP_BASE_URL" npm run test:e2e
```

`APP_BASE_URL` doit être accessible **depuis Chromium** et depuis le runner.
Un serveur sur `127.0.0.1` dans le container du runner ne convient pas à un
navigateur situé dans un autre container. Exécuter `npm run build:local`
dans l'environnement isolé qui sert le worktree. CDP est un repli de validation
Chromium, moins complet que la connexion Playwright native ; la CI reste sur le
navigateur officiel installé pour la version exacte du runner.

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

| Module | Repère historique, à remesurer | Target | Justification |
|--------|-----------------|--------|---------------|
| `lib/seeded-random.js` | 100% | 100% | Bibliothèque critique, déterministe |
| `lib/gamekit.js` | N/A | 90%+ | SDK utilisé par tous les jeux |
| `lib/assets.js` | N/A | 80%+ | Utilitaire |
| Moteurs de jeux | 70%+ | 90%+ | Logique métier critique |
| Bots IA | 50%+ | 80%+ | Algorithmes complexes |
| Scripts build | 60%+ | 80%+ | Génération catalogue/parcours |
| UI/DOM | Contrats Jest + E2E | Interactions critiques obligatoires | Une métrique de lignes ne prouve pas le focus, le clavier natif ou le layout |

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
        target: 80%       # Cible du code modifié
        threshold: 5%     # Tolérance configurée
```

**Interprétation** :

- **Project target: auto** : Codecov ajuste le target automatiquement en fonction de l'historique
- **Threshold: 1%** : Autoriser une baisse de 1% maximum
- **Patch target: 80%** : Cible sur le code modifié, avec tolérance de 5%
- Les seuils Jest sont bloquants sur SeededRandom et les scripts packaging/smoke,
  pas sur tout le code. Voir la [politique qualité](guides/software-quality.md).
- L'envoi Codecov est non bloquant. Un statut Codecov et son caractère obligatoire
  dépendent aussi de l'intégration et des règles GitHub, pas de ce guide.

**Statut dans les PRs** :

- ✅ : Coverage maintenu ou amélioré
- ❌ : Statut selon les cibles et tolérances de `codecov.yml`

---

## Stack de test

### Framework : Jest

**Version** : 30.2.0+

**Configuration** : `jest.config.js` (source de vérité ; Node/jsdom selon le test,
transformation esbuild pour TypeScript).

### Navigateur : Playwright

**Configuration** : `playwright.config.js`, tests `e2e/*.spec.js`. Chromium est le
socle CI actuel, pas une promesse de couverture Firefox/WebKit ou appareils physiques.
Le contrat de contraste des tokens complète `lib/theme-contrast.test.js` ; il ne
remplace pas un audit WCAG complet de toutes les combinaisons de composants.

### Exemple de configuration unitaire

```javascript
export default {
  testEnvironment: 'node',        // jsdom declare par les tests DOM
  transform: {},                  // Exemple JS pur ; voir la config pour TypeScript
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

**Fichiers** : `.github/workflows/ci.yml` (lint qualité/sécurité JS, Jest, types, audit npm, OpenSpec, build et appel
navigateur), `.github/workflows/ui-e2e.yml` (workflow réutilisé) et
`.github/workflows/deploy.yml` (publication après cette CI).

Le job navigateur suit Node 26 et `npm ci`, installe Chromium avec la commande
supportée `npx playwright install --with-deps chromium`, puis lance `test:e2e`.
Il ne dépend d'aucun DNS de laboratoire, serveur partagé ou accès CDN au runtime.
En CI, il extrait l'archive `github-pages` et sert `site/` avec
`PLAYWRIGHT_PREBUILT=1`, sans second build. La préparation locale habituelle
reste `build:local`. Le build de production conserve sa collecte Open Graph ;
les fixtures isolent les requêtes externes du navigateur, pas cette collecte.
Le rapport et les
traces sont publiés comme artefact pendant 14 jours uniquement en cas d'échec.
Tout échec UI doit être corrigé avant fusion ; ne pas le rendre optionnel ni
remplacer les vraies bibliothèques par des globals factices pour verdir la CI.

Le gate JS de sécurité utilise les plugins verrouillés et une configuration flat.
Les tests de cette politique incluent entrées interdites/sûres et sortie JSON
avec le véritable code d'échec. Les heuristiques consultatives ne sont pas
présentées comme bloquantes ; le parser actuel ne supporte pas TS 7.
Voir la [politique de qualité](guides/software-quality.md).

### Statut dans les PRs

Une intégration Codecov configurée et un upload réussi peuvent ajouter un
commentaire sur la PR, par exemple :

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
- Si échec : corriger avant merge ; le blocage automatique nécessite les règles GitHub

Le [guide de l'usine](guides/software-factory.md) distingue ces recommandations,
les garanties automatisées et les améliorations restantes.

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
- [x] Socle E2E avec Playwright en CI
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
*Dernière mise à jour : 2026-10-02*
