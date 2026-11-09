# Puissance 4

Le grand classique à deux joueurs, avec une IA qui joue fort, montre qui est en
train de gagner et explique ses conseils. Ce dossier sert aussi de support de
cours : moteur pur, IA par recherche arborescente, Web Worker et interface
accessible y sont séparés et testés.

## Règles

- Grille de 7 colonnes sur 6 lignes, deux joueurs : Rouge et Jaune.
- À son tour, on lâche un jeton dans une colonne non pleine ; il tombe sur la
  case libre la plus basse.
- Le premier qui aligne 4 jetons (horizontale, verticale ou diagonale) gagne.
- Grille pleine sans alignement : match nul.

## Jouer

- **Contre l'IA** (4 niveaux) ou **à deux** sur le même appareil ; choix de la
  couleur et de qui commence.
- **Souris / doigt** : toucher une colonne. Un jeton fantôme montre où il tombera.
- **Clavier** : flèches gauche/droite pour choisir la colonne, Entrée ou Espace
  pour jouer, ou directement les touches 1 à 7. Un seul arrêt Tab sur la grille.
- **Annuler** : contre l'IA, retire son coup et le vôtre ; à deux, le dernier coup.
- **Indice** : la meilleure colonne selon l'IA, avec une phrase d'explication
  (« Bloque la menace adverse en colonne 3 », « Crée une double menace »…).
- **Barre d'évaluation** : part de Rouge entre 0 et 100 %, et « Rouge gagne de
  force en N coups » dès qu'une victoire forcée est trouvée. Désactivable.
- Les coups sont annoncés aux lecteurs d'écran (« Rouge (vous) joue en
  colonne 4. »), l'historique est listé, la ligne gagnante mise en évidence.
- Thèmes clair, sombre ou automatique ; animations coupées si le système
  demande moins de mouvement ; mise en page de 320 px au bureau.

## Architecture

```
games/puissance-4/
├── engine.js              # Moteur GameEngine : règles pures, état JSON
├── engine/board.js        # Grille lisible : gravité, alignements
├── ai/
│   ├── bitboard.js        # Grille en deux nombres + détection des cases gagnantes
│   ├── search.js          # Négamax alpha-bêta, itératif, table de transposition
│   ├── transposition-table.js
│   ├── advisor.js         # Indice expliqué + évaluation pour l'affichage
│   ├── protocol.js        # Messages page ↔ worker (fonction pure, testée sous Node)
│   ├── worker.js          # Web Worker : relaie protocol.js
│   └── client.js          # Côté page : promesses, annulation, repli sans worker
├── bots/                  # random, greedy, minimax (+ levels.js pour l'interface)
├── ui/                    # session (sans DOM), textes, grille, panneaux, main.js
├── index.html, style.css
└── **/__tests__/          # Tests Jest
```

**Moteur** (`engine.js`). Il implémente exactement le contrat du lab : `init`,
`applyAction`, `isValidAction`, `getValidActions`, `getPlayerView`,
`isGameOver`, `getWinners`, `getCurrentPlayer`. L'action est
`{ type: 'drop', column }` (0 à 6). L'état est un objet JSON lisible (grille
`board[ligne][colonne]`, ligne 0 en haut, `moves` pour l'historique,
`winningLine` pour l'affichage) ; il n'est jamais modifié en place. Le moteur
ignore DOM, stockage, réseau et horloge. Pas d'information cachée :
`getPlayerView` renvoie l'état complet.

**Session** (`ui/session.js`). Pile d'états et d'états du RNG des bots :
l'annulation revient exactement en arrière, et rejouer redonne les mêmes coups.

**IA dans un Web Worker**. La page envoie `{ kind: 'move' | 'analyze', view, … }`
au worker, qui répond avec le coup, l'analyse et le nouvel état du RNG. Toute la
logique est dans `protocol.js` : le worker ne fait que la relayer, et si le
worker ne peut pas démarrer (navigateur ancien, page ouverte en `file://`), le
client exécute la même fonction sur le fil principal. Une réponse qui arrive
après une annulation ou une nouvelle partie est ignorée, et le calcul est
interrompu (`terminate`) pour ne pas retarder la demande suivante.

## Comment l'IA choisit son coup

Les bots suivent le contrat du lab (`chooseAction(view, validActions, rng)`) :
ils ne voient que `getPlayerView`, et tout hasard passe par le `SeededRandom`
fourni. Même vue, même RNG : même coup.

| Niveau | Bot | Principe |
|---|---|---|
| Facile | `Random` | Une colonne légale au hasard. |
| Moyen | `Greedy` | Gagne s'il peut, sinon bloque, évite de jouer sous une case gagnante adverse, préfère le centre. |
| Difficile | `Minimax` | Recherche limitée à 4 coups d'avance (50 000 positions). |
| Expert | `Minimax` | Recherche complète décrite ci-dessous (800 000 positions). |

### Bitboards

Pour aller vite, l'IA n'utilise pas la grille JSON mais deux entiers de 49 bits :
`current` (jetons du joueur au trait) et `mask` (tous les jetons). Chaque
colonne occupe 7 bits, dont un bit « sentinelle » toujours vide qui empêche un
alignement de déborder d'une colonne à l'autre.

- **Jouer** : `mask + bit_du_bas(colonne)` fait monter la retenue jusqu'à la
  première case vide de la colonne — une seule addition pour la gravité.
- **Cases gagnantes** : en décalant les jetons de 1 (vertical), 7 (horizontal),
  6 et 8 (diagonales) et en combinant par ET/OU, on obtient d'un coup toutes les
  cases vides qui compléteraient un alignement de quatre.
- JavaScript n'a que des opérateurs binaires 32 bits ; un `Number` représente
  toutefois exactement les entiers jusqu'à 2^53. Les opérations logiques sont
  donc découpées en deux mots de 32 bits, les décalages faits par
  multiplication ou division par une puissance de deux (mesuré : deux fois
  plus rapide que `BigInt`).

Les tests comparent ces opérations à `BigInt` et la détection des cases
gagnantes à une recherche naïve avec le moteur.

### Négamax et élagage alpha-bêta

Minimax suppose que chaque joueur choisit le meilleur coup pour lui. Le
**négamax** l'écrit en une seule fonction : la valeur d'une position est
l'opposé de la meilleure valeur des positions suivantes, vues par l'adversaire.
L'**élagage alpha-bêta** abandonne une branche dès qu'elle ne peut plus changer
la décision : `alpha` est ce que le joueur au trait s'est déjà garanti, `beta`
ce que l'adversaire lui concèdera au plus.

À chaque nœud, avant toute recherche :

1. une **victoire immédiate** est jouée ;
2. on calcule les **coups sûrs** : si l'adversaire menace une case jouable, il
   faut la bloquer ; deux menaces jouables sont imparables (défaite détectée
   sans chercher plus loin) ; on écarte aussi les coups placés juste sous une
   case gagnante adverse ;
3. la fenêtre est resserrée : sans victoire immédiate, on ne peut pas gagner
   avant le jeton suivant de l'adversaire et le nôtre.

**Scores.** Une victoire vaut `10000 - n`, où `n` est le nombre de jetons posés
au moment du coup gagnant : gagner vite vaut plus, perdre tard coûte moins, et
la valeur ne dépend pas de la profondeur de recherche (elle peut être mise en
cache telle quelle). « Victoire forcée en N coups » se déduit directement de ce
score.

### Ordre des coups, approfondissement itératif, table de transposition

- **Ordre des coups** : d'abord le meilleur coup déjà connu, puis ceux qui
  créent le plus de cases gagnantes, puis du centre vers les bords. Un bon ordre
  fait couper l'alpha-bêta beaucoup plus tôt.
- **Approfondissement itératif** : on cherche à profondeur 1, puis 2, 3… Chaque
  itération commence par le meilleur coup de la précédente. On s'arrête quand le
  budget est épuisé (on garde la dernière itération complète) ou dès qu'une
  issue est prouvée.
- **Table de transposition** : des ordres de coups différents mènent souvent à
  la même grille. Une table (tableaux typés, ≈ 5 Mo) mémorise pour chaque
  position la profondeur, le score, le type de borne (exacte, minorant,
  majorant) et le meilleur coup. Elle est vidée à chaque analyse : un appel ne
  dépend jamais du précédent.
- **Égalités** : à la racine, chaque coup est cherché avec une fenêtre qui
  révèle les ex æquo ; le bot les départage avec son RNG.

### Fonction d'évaluation

Quand la profondeur est atteinte sans issue, la position est notée pour le
joueur au trait (toujours bien en deçà d'un score de victoire) :

- **menaces** : nombre de cases qui compléteraient un alignement, les nôtres
  moins celles de l'adversaire (poids 10) ;
- **parité** (théorie de Victor Allis) : en fin de partie, le premier joueur
  peut forcer l'occupation des lignes impaires, le second des lignes paires ;
  une menace « bien placée » compte en plus (poids 6) ;
- **centre** : la colonne centrale participe au plus grand nombre
  d'alignements (poids 3 par jeton).

### Budget et reproductibilité

La recherche est bornée en **nombre de positions examinées** (et en profondeur),
pas en millisecondes : à budget égal, le coup est identique sur toutes les
machines, ce qui rend les bots reproductibles et les tests stables. Mesuré sous
Node : 1,2 à 1,7 million de positions par seconde, soit 0,5 à 0,7 s pour le
niveau Expert, qui atteint 14 à 16 demi-coups d'anticipation en début de partie
et résout les fins de partie.

### Indice expliqué

`ai/advisor.js` choisit l'explication par une liste ordonnée de règles : gagner
tout de suite, bloquer, créer une double menace, victoire forcée, défense d'une
position perdue, éviter une colonne piégée, préparer une menace, prendre le
centre, sinon « meilleur équilibre à N coups ».

## Tests

```bash
make npm CMD="test -- games/puissance-4 lib/engine-contract"
```

- Moteur : gravité, victoires dans les 4 directions et aux bords, alignement de
  cinq, nul, colonne pleine, actions invalides et mauvais joueur, immutabilité
  (objets imbriqués gelés), replay comparé état par état, reprise après
  `JSON.parse(JSON.stringify(state))`, contrat commun du lab.
- IA : opérations 49 bits contre `BigInt`, cases gagnantes contre une recherche
  naïve, scores exacts comparés à un solveur naïf sur des fins de partie,
  gains forcés vérifiés indépendamment (distance comprise), déterminisme du
  budget, table de transposition.
- Bots : règles de chaque niveau, aucun gain immédiat évitable laissé à
  l'adversaire, tournois à graines fixes (Minimax bat Random et Greedy dans
  toutes les parties, Rouge comme Jaune ; Greedy bat largement Random).
- Worker : protocole complet (validation, erreurs, reproductibilité) et client
  (worker simulé, repli, annulation, réponses périmées), sans navigateur.
- Navigateur (`e2e/puissance-4.spec.js`) : partie contre l'IA au clavier avec
  worker réel, indice, annulation, victoire à deux, défaite face à l'Expert,
  affichage mobile sans débordement et mouvement réduit.

## Limites

- L'IA n'est **pas un solveur parfait** depuis la grille vide : le Puissance 4
  est résolu (le premier joueur gagne en jouant au centre), mais une preuve
  demande bien plus de calcul qu'une demi-seconde. L'Expert reste très fort en
  pratique et parfait sur les fins de partie qu'il résout.
- Le budget en positions donne un temps de réponse variable selon l'appareil
  (plus lent sur un vieux téléphone). L'interface ne se fige pas pour autant :
  le calcul tourne dans le worker.
- À petit budget (50 000 positions), Minimax peut encore perdre en second
  joueur contre Greedy ; les tests de force utilisent 150 000 positions.
- Sans Web Worker, le calcul se fait sur le fil principal et peut bloquer
  l'interface jusqu'à une seconde.
- Les scores enregistrés (victoires contre l'IA, pondérées par le niveau)
  utilisent `GameKit.saveScore` et restent dans ce navigateur.
