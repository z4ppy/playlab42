# Solitaire (Klondike)

Le solitaire classique, avec une IA qui explique ce qu'elle fait.
Jouable à la souris, au doigt et entièrement au clavier, en thème clair,
sombre ou automatique, de 320 px de large jusqu'au bureau.

Adresse directe d'une donne : `games/solitaire/index.html?donne=1234&pioche=3`.

## Règles

- **But** : monter les quatre enseignes de l'as au roi sur les **fondations**
  (une par enseigne : pique, cœur, trèfle, carreau).
- **Tableau** : sept colonnes ; la colonne *n* reçoit *n* cartes, seule la
  dernière face visible. Une carte (ou une séquence) se pose sur une carte de
  rang immédiatement supérieur et de **couleur opposée** ; seul un **roi**
  occupe une colonne vide. Une carte cachée découverte se retourne seule.
- **Talon** : on pioche **1 ou 3 cartes** à la fois vers la défausse ; seule
  la carte du dessus de la défausse est jouable. Talon vide : la défausse se
  retourne pour reformer le talon, **sans limite de tours**.
- Une carte de fondation peut redescendre sur le tableau.
- **Score** (barème courant des solitaires sur ordinateur, sans bonus de
  temps) : défausse → tableau +5, vers une fondation +10, carte retournée +5,
  fondation → tableau −15, recyclage −100 en pioche 1 et −20 en pioche 3 ;
  jamais négatif.
- La partie est gagnée quand les 52 cartes sont montées. Si plus aucune action
  n'est possible (cas rare), elle est perdue.

## Jouer

| Geste | Effet |
|---|---|
| Clic / appui | Meilleure destination : la fondation si la carte y monte **sans risque**, sinon une colonne, sinon la fondation |
| Double-clic / double appui | Vers la fondation, même si la carte pourrait encore servir de support |
| Glisser (souris, doigt, stylet) | La carte et toutes celles posées dessus suivent le pointeur |
| Clic sur le talon | Piocher, ou recycler la défausse |

| Touche | Effet |
|---|---|
| Flèches | Parcourir la table (↑ dans une colonne prend une carte de plus) |
| `1` … `7` | Aller à une colonne |
| `Entrée` | Déplacement automatique (comme un clic) |
| `Espace` | Prendre, puis poser sur la pile visée ; `Échap` annule |
| `F` | Envoyer à la fondation |
| `P` | Piocher ou recycler |
| `Z` / `Y` (ou `Ctrl+Z`, `Ctrl+Y`) | Annuler / refaire, sans limite |
| `I` | Indice |
| `A` | Regarder l'IA jouer, ou l'arrêter |
| `T` | Terminer automatiquement |
| `N` | Nouvelle donne |
| `?` | Règles et raccourcis |

La table n'a qu'un arrêt de tabulation (tabindex itinérant) ; chaque coup est
annoncé dans une région `aria-live` (« Le 7 de carreau va sur le 8 de pique,
colonne 6. Carte découverte en colonne 5 : le 2 de cœur. »).

**Options** : pioche 1 ou 3, numéro de donne, *donnes gagnables uniquement*,
*fin automatique* (dès qu'aucune carte n'est cachée dans le tableau), thème.
Réglages et bilan (parties, victoires, meilleur temps, meilleur score) sont
gardés par `GameKit.saveProgress` ; une victoire enregistre son score avec
`GameKit.saveScore`. Une donne où l'IA a joué n'est pas comptée comme victoire.

## Architecture

```
games/solitaire/
├── engine.js            # SolitaireEngine : contrat GameEngine du lab
├── engine/
│   ├── cards.js         # Codes de cartes ('7H'), règles d'empilement, noms français
│   ├── rules.js         # Plateau : coups légaux, application, victoire (partagé avec l'IA)
│   ├── deal.js          # Donne reproductible (SeededRandom)
│   ├── scoring.js       # Barème
│   └── winnable.js      # Choix d'une donne prouvée gagnable
├── ai/
│   ├── solver.js        # Solveur à information complète
│   ├── talon.js         # Coups composés « piocher jusqu'à… puis jouer »
│   ├── planner.js       # Indices à partir de la seule vue du joueur
│   ├── heuristics.js    # Coups sûrs, ordre d'essai, évaluation
│   ├── explain.js       # Phrases françaises des indices
│   ├── position.js      # Vue → plateau (cartes cachées = null), hachage canonique
│   └── benchmark.js     # Mesure reproductible du taux de victoire
├── bots/
│   ├── random.js        # Aléatoire (référence)
│   └── heuristic.js     # Heuristique (le planificateur d'indices)
├── ui/                  # Client : session, rendu, gestes, clavier, animations
├── index.html, style.css, main.js, game.json
└── __tests__/           # Tests Jest (le moteur est testé dans engine.test.js)
```

### Contrat moteur

`init`, `applyAction`, `isValidAction`, `getValidActions`, `getPlayerView`,
`isGameOver`, `getWinners`, `getCurrentPlayer` (et `getScores`) suivent
`lib/types/game-engine.ts`. Le moteur est pur et isomorphe : ni DOM, ni
stockage, ni réseau, ni horloge ; l'état est du JSON ; l'état reçu n'est
jamais muté (les piles inchangées sont partagées, rien n'étant muté).

- **Configuration** : `{ seed, playerIds: ['joueur'], options: { drawCount: 1|3, winnableOnly } }`.
  La seed est le **numéro de donne** (entier 32 bits). Le jeu neuf est mélangé
  par `SeededRandom` (le tableau est toujours neuf avant `shuffle`) et
  `rngState` est conservé dans l'état.
- **Actions** : `{ type: 'draw' }`, `{ type: 'recycle' }` et
  `{ type: 'move', from, to, count }`, où les piles s'appellent `waste`,
  `tableau-0`…`tableau-6`, `foundation-0`…`foundation-3`. `isValidAction` et
  `getValidActions` reposent sur les mêmes règles (`engine/rules.js`) ; une
  action invalide ou d'un autre joueur lève une erreur.
- **Vue** (`getPlayerView`) : les colonnes deviennent `{ downCount, up }`, le
  talon `stockCount`. Les cartes face cachée et **l'ordre du talon** ne sont
  jamais exposés ; la défausse l'est, car chacune de ses cartes a été
  retournée face visible devant le joueur. Le client ne rend **que** cette vue :
  aucune carte cachée n'apparaît dans le DOM.

### Décisions

- **Annuler/refaire côté client** (`ui/session.js`) : les états étant du JSON
  immuable, garder la pile des états précédents suffit, sans limite. Le moteur
  reste une fonction de transition, et un replay se réduit aux actions jouées.
  Une action « undo » dans le moteur aurait obligé l'état à porter son propre
  historique, qui grossit à chaque coup.
- **Retournement automatique** des cartes cachées (+5), comme dans tous les
  solitaires sur écran : une action « retourner » n'ajouterait aucun choix.
- **Compteurs publics de talon** : `passMoves` (coups depuis le dernier
  recyclage) et `stalePasses` (tours complets sans aucun coup) découlent des
  coups joués. Ils permettent de dire honnêtement qu'un nouveau tour de talon
  ne montrerait rien de neuf.
- **Le temps appartient au client** : le chrono s'arrête en pause (onglet
  masqué, pause du portail) et n'entre pas dans le score.

## Comment fonctionne l'IA

Deux problèmes différents, deux outils, et une frontière nette entre ce que
le **jeu** sait et ce que le **joueur** sait.

### 1. Le solveur (information complète) — `ai/solver.js`

Il répond à : « cette donne a-t-elle une solution ? ». Recherche en
profondeur d'abord (pile explicite, pas de récursion) :

1. **Coups sûrs imposés** : un as, un 2, ou une carte dont les deux supports
   possibles (rang inférieur de l'autre couleur) sont déjà montés, peut aller
   sur sa fondation sans jamais perdre de solution. Le solveur le joue sans
   explorer d'alternative.
2. **Ordre d'essai** (`heuristics.js`) : fondations qui découvrent une carte,
   découverte d'une carte cachée (colonnes les plus chargées d'abord),
   fondations, séquence partielle qui libère une carte montable, défausse vers
   le tableau, vider une colonne… Un roi déjà au fond d'une colonne ne
   déménage pas.
3. **Coups du talon composés** (`talon.js`) : piocher ne change ni le tableau ni
   les fondations, et un coup du tableau peut toujours être joué avant les
   pioches. On remplace donc `draw`/`recycle` par « piocher jusqu'à telle
   carte, puis la jouer » : la recherche reste complète mais beaucoup moins
   profonde.
4. **États déjà vus** : chaque position est réduite à une clé canonique
   (`position.js`) où les **colonnes sont triées** — deux positions qui ne
   diffèrent que par l'ordre des colonnes ont les mêmes solutions. Une
   position déjà vue n'est jamais réexplorée : plus de va-et-vient ni de tours
   de talon inutiles.
5. **Budget** : nombre de nœuds (déterministe) et, côté navigateur, échéance
   optionnelle via une horloge injectée.

Le résultat est **honnête** : `winnable` avec la suite de coups (rejouable
dans le moteur, c'est testé), `impossible` seulement après exploration
**complète**, `unknown` si le budget est épuisé. Le mode rapide
(`exhaustive: false`) ignore les simples réarrangements : il trouve plus vite
une solution, mais son échec ne prouve rien et rend donc `unknown`.

### 2. Les donnes gagnables — `engine/winnable.js`

Avec l'option *donnes gagnables uniquement*, c'est **le moteur**, qui connaît
toutes les cartes, qui lance le solveur sur la donne demandée puis sur les
suivantes jusqu'à en prouver une gagnable (30 essais de 4 000 nœuds au plus,
en mode rapide). C'est une décision du jeu, comme mélanger les cartes : le
joueur reçoit seulement la garantie `winnable: true`, jamais la solution. Le
budget étant en nœuds et non en temps, une même configuration donne la même
donne sur toutes les machines, et le numéro trouvé se rejoue tel quel.

### 3. Les indices et le bot (vue du joueur) — `ai/planner.js`

Le joueur ne voit ni les cartes cachées ni le talon : impossible de
« résoudre ». Le planificateur reconstruit un plateau depuis
`getPlayerView` où chaque carte cachée vaut `null`, puis cherche en
profondeur limitée (6 coups, 3 000 à 4 000 nœuds) la meilleure suite de coups
**qui n'utilise que des cartes visibles** :

- les pioches sont exclues des plans (la carte piochée est inconnue) ;
- un coup qui retourne une carte cachée **termine** le plan : la suite dépend
  d'une carte que personne ne connaît ;
- chaque position est évaluée (−50 par carte cachée, +20 par carte montée,
  +15 par colonne libre, −2 par carte de talon et de défausse), moins 1 par
  coup ; les positions déjà vues dans la recherche **ou déjà jouées dans la
  partie** sont écartées.
- une colonne **libre** est vide, ou commencée par un roi sans carte cachée
  dessous : poser un roi de la défausse dans une colonne vide garde cette
  valeur et sort une carte de la réserve, l'IA le joue donc au lieu de
  piocher (« Pose le roi de cœur de la défausse dans la colonne 5, vide : un
  roi commence une nouvelle suite en colonne 5. »). Déplacer un roi déjà au
  fond d'une colonne vers une autre colonne vide ne rapporte rien et n'est
  jamais conseillé.

Si un plan améliore la position, l'indice conseille son premier coup et
explique son but : « Déplace le 7 de carreau (colonne 5) sur le 8 de pique
(colonne 6) : cela libère une carte cachée en colonne 5. » ou « … première
étape d'un plan en 2 coups qui libère une carte cachée en colonne 6. ». Sinon
il conseille de piocher, de recycler si des coups ont été joués depuis le
dernier tour, ou annonce « Aucun coup utile » quand un tour complet du talon
n'a rien donné.

Le **bot Heuristique** (`bots/heuristic.js`, format du lab :
`chooseAction(view, validActions, rng)`) joue exactement ce conseil, avec pour
seule mémoire les positions qu'il a déjà vues. « Regarder l'IA » l'utilise
pas à pas et affiche l'explication de chaque coup. Le bot **Aléatoire** joue
un coup légal tiré avec le `rng` fourni. La **fin automatique** enchaîne les
coups du planificateur dès que le tableau n'a plus de carte cachée.

Un test vérifie que deux états qui ne diffèrent que par leurs cartes cachées
donnent la même vue, le même indice et le même choix du bot.

### Taux de victoire mesurés

Bot Heuristique, budget par défaut, donnes n° 1 à 1 000, sans aucune
information cachée :

| Mode | Victoires | Taux |
|---|---|---|
| Pioche 1 | 504 / 1 000 | **50,4 %** |
| Pioche 3 | 162 / 1 000 | **16,2 %** |

Avant que la colonne commencée par un roi compte comme libre, le bot
gagnait 440 et 139 de ces donnes : il préférait piocher plutôt que de poser
un roi de la défausse dans une colonne vide. Il examine en contrepartie
environ 15 % de positions de plus par partie (chaque indice reste borné par
son budget de nœuds).

Pour comparaison, le bot Aléatoire ne gagne aucune des donnes de référence.
La CI rejoue les donnes 1 à 6 en pioche 1 (gagnées : 1, 3 et 4) ; la mesure
large se relance hors CI (environ 9 minutes) :

```bash
# Dans le conteneur de développement (make shell)
SOLITAIRE_BENCH=1000 npm test -- games/solitaire/__tests__/bots -t "mesure large"
```

Le solveur complet donne un ordre de grandeur de la solvabilité réelle : sur
les donnes 1 à 100 en pioche 1, 74 sont prouvées gagnables, 2 impossibles et
24 restent inconnues avec 200 000 nœuds. En mode rapide à 4 000 nœuds, 61 %
des donnes (pioche 1) et 57,5 % (pioche 3) sont prouvées gagnables : environ
deux essais suffisent en moyenne pour l'option *donnes gagnables*.

## Tests

```bash
make npm CMD="test -- games/solitaire lib/engine-contract"
make npm CMD="exec -- eslint games/solitaire e2e/solitaire.spec.js"
make test-e2e   # dont e2e/solitaire.spec.js
```

- Moteur (`engine.test.js`) : donne (52 cartes, escalier, déterminisme),
  chaque coup légal et illégal, séquences, roi sur colonne vide, défausse,
  fondations et retour, pioche 1 et 3, recyclage, retournement, score,
  victoire, défaite, actions invalides et mauvais joueur, immutabilité des
  objets imbriqués, replay état par état, reprise après JSON au milieu, vue
  sans fuite. Le contrat commun (`lib/engine-contract.test.js`) l'exerce aussi.
- Règles : l'énumération rapide des coups est comparée à une énumération
  exhaustive naïve sur des parties aléatoires.
- Solveur : positions construites à la main (gagnable, impossible, budget),
  vraie donne rejouée dans le moteur, séquences du talon en pioche 1 et 3.
- Indices, explications, bots et client sans DOM (session, destinations,
  annonces, réglages, minuteries, raccourcis, navigation, rendu en jsdom).
- Navigateur : glisser-déposer souris et tactile, clic et double-clic,
  annuler/refaire, clavier, options, IA, fin automatique jusqu'à la victoire,
  contraste des cartes, mobile 390 × 844.

Les seuils de couverture de `jest.config.js` sont à 100 % pour le moteur, les
règles, l'IA, les bots et les modules du client sans DOM.

## Limites

- Le planificateur ne voit pas plus loin que la prochaine carte cachée, et le
  bot oublie l'ordre du talon dès qu'il est retourné (la vue le cache) : un
  joueur attentif qui le mémorise peut faire mieux en pioche 3.
- La fin automatique s'appuie sur ce même planificateur : en pioche 3, un
  talon mal aligné peut l'arrêter avant la fin (elle le dit alors).
- `unknown` reste fréquent pour le solveur sur les donnes difficiles : un
  budget plus grand coûterait plusieurs secondes dans le navigateur.
- Pas de sauvegarde de la partie en cours entre deux visites, ni de bonus de
  temps dans le score.
- Le contrôleur, les gestes et les animations (`ui/app.js`, `ui/pointer.js`,
  `ui/motion.js`, `ui/dialogs.js`) sont couverts par les parcours navigateur,
  pas par Jest.
