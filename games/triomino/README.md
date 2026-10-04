# Triomino ??

Jeu de tuiles triangulaires — 1 à 4 joueurs — Dès 6 ans

## Règles du jeu

### Matériel
- 56 tuiles triangulaires (valeurs 0-5 sur chaque sommet)
- 4 réglettes joueurs
- Pioche centrale

### Préparation
- **2 joueurs** : 9 tuiles chacun
- **3-4 joueurs** : 7 tuiles chacun
- Le reste constitue la pioche

### Déterminer le premier joueur
Le moteur compare la première tuile de chaque rack. Celui dont la **somme des 3 valeurs est la plus élevée** commence. En cas d'égalité, le RNG de la partie choisit parmi les ex-aequo, sans redistribution.

### Déroulement

À chaque tour, le joueur doit **placer une tuile** adjacente à une tuile existante. Les **2 chiffres des sommets en contact doivent être identiques**.

```
    [1]          [1]
   / 2 \        / 3 \
  [3]–[2]  ?  [2]–[1]
              côté partagé : [1,2] = [1,2] ?
```

Si le joueur **ne peut pas ou ne veut pas** poser :
1. Il pioche une tuile **(-5 pts)**
2. Il peut la jouer, sinon il pioche à nouveau **(-5 pts)**
3. Troisième pioche possible **(-5 pts + -10 pts bonus malus = -25 pts au total)**
4. Après 3 piochages sans pouvoir jouer ? il passe son tour

### Calcul du score

| Événement | Points |
|-----------|--------|
| Poser une tuile | Somme des 3 valeurs |
| Pont formé | +40 pts |
| Hexagone formé | +50 pts |
| Double hexagone | +60 pts |
| Piocher une tuile | -5 pts |
| 3ème piochage (malus supplémentaire) | -10 pts |
| Poser sa dernière tuile | +25 pts |
| Points restants des adversaires (si vous finissez) | +total |

### Formes spéciales

**Pont** : La tuile posée crée un "pont" en ayant 2 voisins non adjacents entre eux.

**Hexagone** : 6 triangles partagent un même sommet géométrique.

**Double hexagone** : La pose ferme au moins deux anneaux autour des sommets de la tuile. Deux anneaux partageant un côté occupent dix cellules. Les bonus ne se cumulent pas : double hexagone > hexagone > pont.

### Fin de partie

- **Un joueur pose sa dernière tuile** ? +25 pts + somme des tuiles restantes des autres joueurs ? il gagne
- **Partie bloquée** (plus personne ne peut jouer) ? chaque joueur soustrait la somme de ses tuiles restantes. Le meilleur score gagne.

### Variantes

| Mode | Description |
|------|-------------|
| Standard | Règles complètes décrites ci-dessus |
| Score cible | `targetScore` est conservé dans la configuration ; le moteur actuel ne gère pas les manches multiples |
| Simplifié | Pose=1pt, Pont=1pt, Hexagone=1pt, Double hexagone=2pts, Fin=5pts |
| Enfants | Pas de points, le premier à poser toutes ses tuiles gagne |

---

## Architecture technique

Le moteur utilise directement `lib/seeded-random.js` (Mulberry32 partagé),
avec son contrat TypeScript adjacent. La fabrication recale cet import depuis
`dist/engine.js` vers `../../../lib/seeded-random.js`, sans embarquer une copie.
Les futurs modules source `engine/*.ts` sont émis dans `dist/engine/*.js` ;
les bots gardent leur chemin historique `bots/dist/`.

`engine.ts` garde l'API publique et l'orchestration des transitions :
- `engine/models.ts` définit une seule fois les états, commandes et vues typés ;
- `engine/placement.ts` regroupe tuiles, voisinage, rotations, placements et anneaux ;
- `engine/scoring.ts` calcule les bonus exclusifs, pénalités et bilans de fin de partie.

Les types et les fonctions `generateAllTiles`, `isValidPlacement`, `detectBonus`
restent réexportés depuis `engine.ts`. Les tests de responsabilités passent
par ce moteur réel dans les trois modes, sans contourner son orchestration.

Le corpus `fixtures/rng-legacy.json`, figé avant extraction sur `205ece9`,
protège les seeds négatives et supérieures à 32 bits, les racks, la pile,
le premier joueur et les replays `PLACE`/`DRAW`/`PASS` avec reprise JSON.
Pour compatibilité des sauvegardes, `rngState` reste la seed de configuration
historique ; ce champ n'est pas converti en état RNG après mélange.

```
games/triomino/
??? engine.ts         # Moteur isomorphe TypeScript
??? engine.test.ts    # Tests unitaires
??? game.json         # Manifest
??? index.html        # Interface web
??? README.md         # Ce fichier
??? bots/
    ??? random.ts     # Bot aléatoire (easy)
    ??? greedy.ts     # Bot score maximal (medium)
```

### Types principaux

```typescript
interface Triomino {
  id: number;
  values: [number, number, number]; // normalisé : a ? b ? c
}

interface Position {
  col: number;
  row: number;
  orientation: 'UP' | 'DOWN'; // ? ou ?
}
```

### Système de coordonnées

Le plateau utilise un repère triangulaire `(col, row, orientation)` :

```
(0,0,UP)?  (1,0,UP)?  (2,0,UP)?
  (0,0,DOWN)?  (1,0,DOWN)?
```

Le voisinage dépend de l'orientation **visuelle** :
`seqX = 2 * col + (orientation === 'DOWN' ? 1 : 0)`.
Le triangle pointe vers le haut si `seqX + row` est pair, y compris en
coordonnées négatives. Ses voisins gauche/droit sont à `seqX - 1` et
`seqX + 1` sur la même rangée ; le voisin de base est à `row + 1`
s'il pointe vers le haut, sinon à `row - 1`, sans changer `seqX`.

### Interface du moteur

```typescript
const engine = new TriominoEngine();

const state = engine.init({ mode: 'standard', playerIds: ['alice', 'bob'], seed: 42 });
const newState = engine.applyAction(state, action, playerId);
const view = engine.getPlayerView(state, playerId);
const actions = engine.getLegalActions(state, playerId);
```

`getValidActions(state, playerId)` est le nom canonique du même contrat :
il délègue à `getLegalActions`, conservé pour les interfaces et bots existants,
sans changer l'ordre des coups ni le format des états JSON. Les placements
incomplets ou aux coordonnées non entières sont refusés explicitement.

La vue contient le rack du joueur, les tailles des racks adverses et de la
pioche, jamais leurs valeurs. `lastDrawnTile` est visible uniquement au joueur
qui vient de piocher, pas à ses adversaires. Les tests de contrat communs
exercent le moteur réel, la reprise JSON, les refus et cette confidentialité.

### Rendu du plateau

`index.html` garde l'état, les bots et les placements ; `ui/board-view.js`
dessine zones de dépôt légales et tuiles posées, et `ui/board-geometry.js`
convertit les positions du moteur en triangles SVG. Les placements légaux
viennent du moteur via la page. `board-render.test.js` exécute le script réel
de la page puis le rendu extrait contre les mêmes empreintes DOM de référence.
