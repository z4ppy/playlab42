# Design: Triomino Game

**Change ID**: `add-triomino-game`

## Overview

Ce document détaille les décisions de conception pour l'implémentation du jeu Triomino dans Playlab42.

---

## Architecture Decisions

### 1. Représentation des tuiles triangulaires

**Décision** : Chaque tuile est un triangle avec 3 valeurs (a, b, c) dans l'ordre horaire depuis le sommet supérieur (triangle pointe en haut) ou depuis le sommet inférieur (triangle pointe en bas).

```typescript
interface Triomino {
  id: number;        // Identifiant unique (0-55)
  values: [number, number, number]; // [sommet, coin-gauche, coin-droit] normalisé
}
```

**Normalisation** : Les valeurs sont stockées dans leur forme canonique minimale (rotation qui produit le plus petit tuple lexicographique). Cela garantit l'unicité et facilite la déduplication.

**Alternatives considérées** :
- Stocker toutes les rotations : redondant, complexifie la recherche d'unicité
- Identifiant alphanumérique `"a-b-c"` : moins efficace pour les comparaisons

---

### 2. Coordonnées du plateau

**Décision** : Utiliser un système de coordonnées triangulaires `(col, row, orientation)` où `orientation` vaut `UP` (?) ou `DOWN` (?).

```
     (0,0,UP)
   (0,0,DOWN) (1,0,UP)
  (1,0,DOWN) (2,0,UP)
```

**Propriétés de voisinage** :
- Un triangle `UP` a 3 voisins :
  - Gauche : `(col-1, row, UP)` — côté gauche partagé
  - Droite : `(col+1, row, UP)` — côté droit partagé  
  - Bas : `(col, row, DOWN)` — côté bas partagé (voisin `DOWN` adjacent)
- Un triangle `DOWN` a 3 voisins symétriques

**Règle de correspondance** : Quand deux triangles partagent un côté, les **2 chiffres des 2 sommets communs** de ce côté doivent être identiques.

**Rationale** : Ce système est direct, simple à sérialiser en JSON, et permet un calcul efficace des voisins.

---

### 3. Génération et unicité des 56 tuiles

**Décision** : Les 56 tuiles correspondent à toutes les combinaisons `(a, b, c)` avec `0 ? a ? b ? c ? 5`, normalisées (rotation minimale).

```
Nombre de tuiles = C(6+3-1, 3) = C(8,3) = 56 ?
```

Générées à l'initialisation, mélangées avec `SeededRandom` pour le déterminisme.

---

### 4. Détection des formes spéciales

**Pont (+40 pts)**  
Une tuile est posée de façon à avoir des voisins des **deux côtés** sans être elle-même encerclée, créant un "pont" au-dessus d'une case vide.  
? Détecté quand la tuile posée a exactement 2 voisins qui ne sont pas adjacents entre eux.

**Hexagone (+50 pts)**  
6 tuiles forment un hexagone complet (anneau fermé de 6 triangles alternant UP/DOWN autour d'un centre vide).  
? Détecté en vérifiant que les 6 positions autour du centre nouvellement formé sont toutes occupées.

**Double hexagone (+60 pts)**  
Deux hexagones partageant un côté, formant une structure de 12 triangles.  
? Détecté après validation d'hexagone, en cherchant un second anneau adjacent.

**Algorithme général** :
```typescript
function detectBonus(board: Board, lastPlaced: Position): Bonus | null {
  if (isDoubleHexagon(board, lastPlaced)) return { type: 'double-hexagon', points: 60 };
  if (isHexagon(board, lastPlaced)) return { type: 'hexagon', points: 50 };
  if (isBridge(board, lastPlaced)) return { type: 'bridge', points: 40 };
  return null;
}
```

---

### 5. Gestion de la pioche et des pénalités

**Décision** : La logique de pioche est dans le moteur, pas dans l'UI.

```typescript
type DrawResult = {
  tile: Triomino;
  penalty: number;       // -5 par tirage
  extraPenalty: number;  // -10 si 3ème tirage du tour
  canPlay: boolean;      // true si la tuile peut être posée
  drawCount: number;     // nombre de tirages ce tour (max 3)
};
```

Si la pioche est vide : `tile: null`, pas de pénalité, tour passé.

---

### 6. Variantes de règles

**Décision** : Un objet `GameConfig` configure les variantes au démarrage.

```typescript
interface TriominoConfig {
  mode: 'standard' | 'simplified' | 'kids';
  targetScore?: number;   // Mode score cible (ex: 400)
  players: number;        // 1-4
}
```

La logique de score est centralisée dans `calculateScore(config, event)` pour faciliter les variantes.

---

### 7. Visibilité (Fog of War)

**Décision** : Les tuiles des autres joueurs sur leur réglette sont **cachées** dans la vue de chaque joueur (implémentation `getPlayerView`).

Seuls le nombre de tuiles restantes des adversaires est visible, pas leurs valeurs.


## Contexte déplacé depuis le delta `specs/triomino-rules/spec.md`

Ce contexte figurait dans le delta de spec ; OpenSpec 1.16 refuse en validation stricte le texte qu'un archivage ne reporterait pas dans la spec principale. Il est conservé ici sans modification.

## Spec Delta: Triomino Game Rules

**Change ID**: `add-triomino-game`
**Capability**: `game-engine`
