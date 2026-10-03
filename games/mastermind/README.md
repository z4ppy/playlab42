# Mastermind

Jeu de déduction classique où vous devez deviner un code secret de 4 couleurs en 10 tentatives maximum.

## Règles

### Rôles

- **🤖 Ordinateur (codeur)** : Génère le code secret au début de chaque partie et calcule automatiquement les feedbacks
- **👤 Humain (décodeur)** : Fait les tentatives pour deviner le code en sélectionnant 4 couleurs

### Couleurs disponibles

- 🔴 Rouge (R)
- 🔵 Bleu (B)
- 🟢 Vert (G)
- 🟡 Jaune (Y)
- 🟠 Orange (O)
- 🟣 Violet (V)

### Déroulement

1. L'ordinateur génère un code secret de 4 couleurs (les doublons sont autorisés)
2. Vous proposez une combinaison de 4 couleurs
3. L'ordinateur vous donne un feedback sous forme de pions :
   - **⚫ Pion noir** : Une couleur est correcte ET bien placée
   - **⚪ Pion blanc** : Une couleur est correcte MAIS mal placée
4. Vous avez 10 tentatives pour trouver le code exact

### Victoire

Vous gagnez si vous trouvez le code exact (4 pions noirs) en 10 tentatives ou moins.

### Défaite

Vous perdez si vous épuisez vos 10 tentatives sans trouver le code.

## Comment jouer

1. **Sélectionner les couleurs** : Cliquez sur les couleurs de la palette pour construire votre tentative
2. **Modifier une couleur** : Cliquez sur un pion de votre tentative en cours pour changer la couleur
3. **Valider** : Cliquez sur "Valider" quand vous avez sélectionné 4 couleurs
4. **Nouvelle partie** : Cliquez sur "Nouvelle partie" pour recommencer

## Stratégie

- Commencez par tester différentes couleurs pour identifier lesquelles sont présentes
- Utilisez les feedbacks pour éliminer progressivement les mauvaises combinaisons
- Les pions blancs et noirs ne révèlent pas quelle couleur correspond à quel indice
- Attention aux doublons ! Une même couleur peut apparaître plusieurs fois

## Technique

Le jeu utilise un moteur isomorphe déterministe :
- Génération seedée du code secret (replay possible)
- Algorithme de feedback en 2 passes (évite le double comptage)
- État immutable et sérialisable (JSON)
- Fog of war : le code secret est caché pendant le jeu, révélé à la fin

La commande de configuration `{ type: 'reset', seed }` exige une seed entière
sûre (zéro et entiers négatifs acceptés, normalisés par le RNG existant).
Une seed absente, non numérique ou non entière est refusée explicitement.
L'interface fournit l'heure lors de la nouvelle partie ; le moteur ne consulte
jamais l'horloge. Conserver cette seed avec les actions permet de rejouer les
resets. Le format des anciens états JSON reste inchangé.

`getValidActions(state, playerId)` retourne désormais les **1296 combinaisons
submit concrètes**, dans l'ordre des couleurs R/B/G/Y/O/V, ou `[]` après la fin
ou pour un autre joueur. Le template historique `code: []` et le reset sans seed
ne sont plus proposés : ils ne constituaient pas des actions de gameplay valides.
L'interface continue à construire les tentatives depuis la palette.
Les accesseurs canoniques `isGameOver`, `getWinners` (tableau d'IDs ou `null`)
et `getCurrentPlayer` (propriétaire, puis `null` à la fin) ne modifient pas
les champs historiques `gameOver`, `winner`, `playerId`.

## Fichiers

- `engine.js` : Moteur de jeu isomorphe
- `engine.test.js` : Tests unitaires (>90% coverage)
- `index.html` : Interface utilisateur
- `game.json` : Manifest
- `README.md` : Ce fichier
