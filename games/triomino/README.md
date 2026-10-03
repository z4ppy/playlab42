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
Chaque joueur prend la première tuile de son rack. Celui dont la **somme des 3 valeurs est la plus élevée** commence. En cas d'égalité, on recommence.

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

**Hexagone** : 6 tuiles forment un anneau fermé (3 triangles ? et 3 triangles ? alternés autour d'un centre vide).

**Double hexagone** : Deux hexagones adjacents partageant un côté (12 tuiles).

### Fin de partie

- **Un joueur pose sa dernière tuile** ? +25 pts + somme des tuiles restantes des autres joueurs ? il gagne
- **Partie bloquée** (plus personne ne peut jouer) ? chaque joueur soustrait la somme de ses tuiles restantes. Le meilleur score gagne.

### Variantes

| Mode | Description |
|------|-------------|
| Standard | Règles complètes décrites ci-dessus |
| Score cible | Jouer plusieurs manches jusqu'à atteindre un score (ex: 400 pts) |
| Simplifié | Pose=1pt, Pont=1pt, Hexagone=1pt, Double hexagone=2pts, Fin=5pts |
| Enfants | Pas de points, le premier à poser toutes ses tuiles gagne |

---

## Architecture technique

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

Voisinage d'un triangle **UP** :
- Gauche : `(col-1, row, UP)`
- Droite : `(col+1, row, UP)`
- Bas : `(col, row, DOWN)`

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
