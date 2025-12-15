# Design - Go 9x9

## Etat et types
- Plateau : tableau 2D 9x9 d'entiers/enum (`0=vide`, `1=noir`, `2=blanc`).
- Groupes et libertés : calculés à la volée via BFS/DFS à partir du coup joué (limité 9x9, coût acceptable), pas de cache persistant pour simplicité.
- Historique ko : mémoriser la dernière position ko (coord unique) et interdire le retour immédiat sur cette case (ko simple).
- Actions : `place(x,y)`, `pass`, `resign`. Tour actif via `currentPlayerId`. Deux joueurs fixes.
- Scoring chinois : score = pierres posées + territoires contrôlés + komi pour blanc ; prisonniers dérivent des captures.
- Config : seed, playerIds (2), options incluent `komi=6.5` (fixe), `boardSize=9` (fixe), `allowSuicide=false`.

## Algorithmes clés
- Validation coup : case vide, non-suicide (sauf si capture libère), respect ko simple (interdit répéter la forme précédente immédiate).
- Capture : après placement, visiter groupes adverses adjacents et supprimer ceux sans libertés ; ensuite vérifier suicide du groupe joué.
- Fin de partie : `pass` deux fois de suite ou `resign` marque vainqueur direct. `isGameOver` exploite `passesInARow` et `gameOver` flag.
- Scoring : flood fill des territoires vides pour attribuer à une couleur si entouré exclusivement par une couleur ; addition des pierres + territoire + komi.

## Bots
- Random : choisit un coup légal aléatoire via SeededRandom ; passe si aucun coup.
- Greedy : score heuristique simple par coup (captures nettes maximisées, éviter suicide, préférer augmenter libertés) ; en cas d'égalité, SeededRandom.

## UI (desktop-first)
- Grille SVG ou canvas 9x9, placements par clic, boutons Passer/Résigner/Reset.
- Afficher dernier coup (marqueur), compte des captures, et score final après fin.
- Responsive minimal (réduction sur mobile) mais optimisé desktop par défaut ; icône/emoji fourni via manifest.
