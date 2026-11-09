# Sudoku

Grilles 9 × 9 **à solution unique**, classées par un **solveur qui raisonne comme
un humain**, indices **expliqués en français** et IA que l'on peut **regarder
résoudre** coup par coup. Tout tourne dans le navigateur, sans serveur.

## Règles

Remplir la grille pour que chaque ligne, chaque colonne et chaque boîte 3 × 3
contienne une fois chacun des chiffres de 1 à 9. Les chiffres en gras sont
donnés et ne changent pas. Chaque grille n'a qu'une solution, qui se trouve par
déduction, sans jamais deviner.

## Jouer

| Geste | Clavier | Tactile / souris |
|---|---|---|
| Choisir une case | flèches, <kbd>Début</kbd>/<kbd>Fin</kbd> | toucher la case |
| Poser un chiffre | <kbd>1</kbd>…<kbd>9</kbd> (pavé numérique et AZERTY compris) | pavé numérique |
| Effacer | <kbd>Suppr</kbd>, <kbd>⌫</kbd>, <kbd>0</kbd>, ou retaper le même chiffre | « Effacer » |
| Mode notes (crayon) | <kbd>N</kbd> | « Notes » |
| Annuler / refaire | <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | « Annuler » / « Refaire » |
| Indice, pause | <kbd>H</kbd>, <kbd>P</kbd> | « Indice », « Pause » |

Aides : surbrillance de la ligne, de la colonne, de la boîte et des chiffres
identiques ; conflits signalés (option) ; compteur de chiffres restants ;
« Notes auto » remplit les notes avec tous les candidats, et poser un chiffre
retire ce chiffre des notes voisines. « Vérifier » marque les chiffres faux sans
révéler la solution. La pause masque la grille et arrête le chronomètre ; quand
l'onglet est caché, la partie se met en pause et ne reprend que sur demande.

Chaque grille a un **numéro partageable** : le niveau et la seed, dans l'URL
(`index.html#expert-123456`). Le générateur étant déterministe, ce lien redonne
exactement la même grille. La partie en cours et les meilleurs temps par niveau
sont gardés localement (`GameKit.saveProgress`) ; un temps n'est un record que si
l'IA n'a joué aucun coup. Une sauvegarde illisible ou d'une version future n'est
jamais écrasée.

Accessibilité : la grille est un seul arrêt <kbd>Tab</kbd> parcouru aux flèches
(`games/board-navigation.js`) ; chaque case est annoncée, par exemple
« Ligne 3, colonne 5, vide, notes 2 et 7 » ou « Ligne 1, colonne 3, 4, erreur
signalée ». Les erreurs ne reposent pas sur la seule couleur (soulignement
ondulé). Thèmes clair, sombre ou automatique, `prefers-reduced-motion` respecté,
de 320 px de large au bureau.

## Architecture

```
games/sudoku/
├── engine.js                 # Moteur : contrat GameEngine du lab (pur, JSON)
├── engine/
│   ├── grid.js               # Géométrie (unités, pairs), masques de bits, notations
│   ├── exact-solver.js       # Solveur exact : retour sur trace + masques + MRV
│   ├── techniques/           # Une technique humaine par famille
│   │   ├── singles.js        #   singletons caché et nu
│   │   ├── intersections.js  #   pointage, réduction boîte-ligne
│   │   ├── subsets.js        #   paires et triplets nus ou cachés
│   │   ├── fish.js           #   X-Wing, Swordfish
│   │   ├── wings.js          #   XY-Wing
│   │   └── index.js          #   catalogue ordonné et niveaux
│   ├── human-solver.js       # Enchaînement des techniques, contradictions
│   ├── explain.js            # Explications en français (indice en deux temps)
│   ├── difficulty.js         # Niveaux = technique la plus difficile requise
│   ├── generator.js          # Grilles seedées, uniques, symétriques, au bon niveau
│   └── advisor.js            # Prochain coup conseillé, depuis la seule vue
├── bots/                     # Bots « Logique » et « Retour sur trace »
├── ui/                       # Client : vues, clavier, chrono, indice, IA, Worker
├── index.html, style.css     # Page autonome
└── game.json                 # Manifeste
```

Le moteur ne connaît ni DOM, ni stockage, ni horloge : chrono, animation de l'IA
et sauvegarde appartiennent au client. Il s'exécute aussi bien sous Node (tests)
que dans le navigateur et dans un Web Worker.

### Contrat du moteur

- `init({ seed, playerIds: [id], difficulty, puzzle? })` génère la grille à partir
  de la seed (ou charge une grille imposée de 81 caractères, vérifiée et classée).
  Le `SeededRandom` n'est utilisé qu'à la génération ; son état final est dans `rngState`.
- Actions : `place {cell, value}`, `erase {cell}`, `note {cell, value}` (bascule),
  `fillNotes`, `check`, `restart`, `undo`, `redo`. Toute action invalide (case
  donnée, valeur hors 1..9, pile vide, partie finie, autre joueur) lève une erreur
  sans modifier l'état reçu.
- L'historique stocke des **changements de cases** (`before`/`after`) : annuler et
  refaire sont de simples actions du moteur, donc rejouables et sérialisables.
- `getValidActions` énumère un sous-ensemble concret et utile, comme le contrat
  l'autorise pour les entrées paramétrées : les candidats des cases vides et
  l'effacement des chiffres du joueur (au plus 81 × 9 actions), toutes acceptées
  par `isValidAction`.
- `getPlayerView` est construite par **liste blanche** : elle ne contient ni la
  solution, ni l'historique détaillé, ni l'état du RNG. « Vérifier » passe par le
  moteur, qui ne renvoie que la liste des cases fausses à cet instant.

## Comment fonctionne l'IA

### 1. Le solveur exact (référence)

`exact-solver.js` résout par **retour sur trace** : poser un chiffre, continuer,
revenir en arrière en cas d'impasse. Deux idées le rendent rapide :

- des **masques de bits** par ligne, colonne et boîte : les candidats d'une case
  s'obtiennent en une opération, `ALL & ~(ligne | colonne | boîte)` ;
- l'heuristique **MRV** (« minimum remaining values ») : on branche toujours sur
  la case qui a le moins de candidats ; une case à 0 candidat coupe la branche.

`countSolutions(grille, 2)` s'arrête dès la deuxième solution : 0, 1 ou « au moins
2 » suffit pour vérifier l'unicité. La même recherche, avec un ordre des chiffres
mélangé par le `SeededRandom`, tire les grilles complètes aléatoires.

### 2. Le solveur humain

`human-solver.js` ne devine jamais. Il garde, pour chaque case vide, le masque de
ses candidats, et applique à chaque pas la **première technique qui produit une
déduction**, de la plus simple à la plus avancée :

| Technique | Niveau | Mini-exemple |
|---|---|---|
| Singleton caché | Facile | Dans la boîte 4, toutes les cases sauf L5C2 voient déjà un 6 : le 6 de la boîte va en L5C2. |
| Singleton nu | Facile | L5C2 voit 1, 2, 3, 4, 5, 7, 8 et 9 : elle ne peut contenir que 6. |
| Pointage | Moyen | Dans la boîte 1, le 3 n'est possible que sur la ligne 1 : on retire le 3 du reste de la ligne 1. |
| Réduction boîte-ligne | Moyen | Sur la ligne 5, le 3 n'est possible que dans la boîte 4 : on retire le 3 du reste de la boîte 4. |
| Paire / triplet nu | Difficile | Dans la ligne 3, L3C1 et L3C4 = {2, 7} : 2 et 7 leur sont réservés, on les retire ailleurs dans la ligne. |
| Paire / triplet caché | Difficile | Dans la colonne 2, le 4 et le 8 ne vont qu'en L1C2 et L6C2 : ces cases perdent leurs autres candidats. |
| X-Wing | Expert | Le 5 n'est possible qu'en colonnes 3 et 8 sur les lignes 2 et 7 : ces colonnes ont leur 5 sur ces lignes, on le retire ailleurs dans les colonnes 3 et 8. |
| XY-Wing | Expert | Pivot {2, 7}, pinces {2, 5} et {7, 5} : une des pinces vaut 5, toute case qui voit les deux pinces perd le 5. |
| Swordfish | Expert | Le X-Wing étendu à trois lignes et trois colonnes. |

Chaque déduction est un « pas » JSON (`placements`, `eliminations`, `units`,
`cells`, `digits`) qu'`explain.js` transforme en deux textes : **où regarder**
(« Regardez la boîte 4 : où peut aller le 6 ? ») et **le raisonnement complet**
(« Dans la boîte 4, le 6 ne peut aller qu'en ligne 5, colonne 2… (Singleton caché) »).

Propriété utile : chaque déduction vaut pour toute solution ; si le solveur humain
remplit la grille, la solution est forcément unique.

### 3. Le classement de difficulté

Le niveau d'une grille est celui de la **technique la plus difficile que le solveur
humain a dû employer**, pas le nombre de cases vides. Les techniques étant essayées
de la plus simple à la plus avancée, cette mesure reflète l'effort minimal d'un
joueur méthodique. Une grille qui exige une technique absente du catalogue
(chaînes, coloriage…) n'est pas classée et n'est jamais proposée.

### 4. La génération à solution unique

Pour un niveau demandé, un essai se déroule ainsi :

1. tirer une grille complète aléatoire (solveur exact, chiffres mélangés) ;
2. **creuser** : retirer les 41 orbites de la symétrie centrale (la case i va avec
   80 − i) dans un ordre aléatoire, en gardant chaque retrait seulement si la
   solution reste unique (comptage arrêté à 2) — on obtient une grille minimale ;
3. **remonter** : si cette grille exige plus que le niveau visé, ou une technique
   inconnue, remettre des orbites retirées jusqu'à ce que le solveur humain la
   résolve sans dépasser la cible (ajouter des indices conserve l'unicité) ;
4. accepter si la technique la plus difficile requise est exactement celle du niveau.

Le nombre d'essais est borné (`MAX_ATTEMPTS` : 10, 80, 250, 150). **Repli
documenté** : s'il est épuisé, on garde l'essai le plus difficile obtenu, jamais
au-dessus de la cible, et l'interface affiche honnêtement le niveau obtenu. Tout
dépendant de la seed, le repli est lui aussi reproductible.

Mesures dans Chromium (100 seeds par niveau, niveau exact atteint 100 fois sur 100) :

| Niveau | Moyenne | Médiane | 95e centile | Maximum |
|---|---|---|---|---|
| Facile | 4 ms | 3 ms | 9 ms | 28 ms |
| Moyen | 43 ms | 34 ms | 117 ms | 211 ms |
| Difficile | 98 ms | 62 ms | 309 ms | 651 ms |
| Expert | 76 ms | 59 ms | 209 ms | 417 ms |

Sur un appareil modeste ces durées peuvent doubler : la génération est donc confiée
à un **Web Worker de module** (`ui/generation-worker.js`) qui exécute le même
`engine.init` et renvoie l'état JSON. Si le navigateur ne fournit pas de Worker de
module ou si le Worker échoue, on se replie sur le fil principal (même résultat).

Fréquences observées sur 1 500 grilles minimales tirées au hasard : environ 67 %
ne demandent que des singletons, 6 % des intersections, 2 % des sous-ensembles,
4 % un X-Wing, XY-Wing ou Swordfish, et 20 % dépassent le catalogue. D'où le
mécanisme de remontée, qui transforme ces grilles trop dures en grilles du niveau visé.

### 5. Indice, vérification et bots

`advisor.js` choisit le prochain coup **à partir de la seule vue du joueur** :
conflit visible → effacer ; chiffre faux → effacer ; sinon la chaîne de déductions
humaines jusqu'à la prochaine pose ; à défaut (grille imposée trop dure) le solveur
exact. La vue ne contient pas la solution : pour repérer un chiffre faux, le
conseiller la **recalcule** à partir des chiffres donnés, information publique.

- **Indice** en deux temps : d'abord la région et le nom de la technique, puis le
  raisonnement complet, la case surlignée et un bouton « Appliquer ».
- **Bot « Logique »** (`bots/logic.js`) : joue le conseil et expose `lastAdvice`
  (technique et explication), affiché pendant « Regarder l'IA résoudre ».
- **Bot « Retour sur trace »** (`bots/backtracking.js`) : résout les données par
  force brute et remplit les cases dans l'ordre de lecture, en affichant le nombre
  de nœuds explorés. La comparaison montre ce que la logique apporte : une
  explication réutilisable par un humain.

Les deux bots respectent le contrat du lab (`chooseAction(view, validActions, rng)`)
et ne choisissent qu'une action présente dans `validActions`.

## Tests

```bash
make npm CMD="test -- games/sudoku lib/engine-contract"   # moteur, solveurs, bots, client
make npm CMD="exec -- eslint games/sudoku e2e/sudoku.spec.js"
make test-e2e                                              # dont e2e/sudoku.spec.js
```

Couverture exigée dans `jest.config.js` : 100 % pour le moteur, les solveurs, le
générateur, les bots et les modules d'interface, seuils mesurés pour le contrôleur.
Les tests construisent un fragment de grille **par technique** (X-Wing compris),
vérifient l'unicité et la symétrie des grilles générées sur plusieurs seeds par
niveau, le rejeu état par état, la reprise après `JSON.parse(JSON.stringify(state))`
et l'absence de la solution dans la vue.

## Limites

- Le catalogue s'arrête aux X-Wing, XY-Wing et Swordfish : pas de chaînes,
  coloriage ni rectangles uniques. Les grilles « Expert » sont donc des grilles
  difficiles mais résolubles sans essai-erreur, pas les monstres des championnats.
- Le solveur humain cherche la technique la plus simple, pas l'explication la plus
  courte : une chaîne d'indices peut contenir une élimination dont la pose finale
  n'avait pas besoin.
- Les notes du joueur ne sont pas utilisées par l'indice : le conseiller recalcule
  les candidats depuis les chiffres posés.
- L'historique d'annulation n'est pas borné ; il reste petit en pratique
  (quelques centaines de changements de cases).
- Le chronomètre se fie à l'horloge du navigateur (`Date.now`) ; seul le temps hors
  pause est compté.
