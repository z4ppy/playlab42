# Morpion : contrat moteur

Le moteur expose le contrat canonique `init`, `applyAction`, `isValidAction`,
`getValidActions`, `getPlayerView`, `isGameOver`, `getWinners` et `getCurrentPlayer`.
La configuration contient une seed numérique et les IDs des deux joueurs.

Une action `{ type: 'place', position }` exige une position **entière numérique**
entre 0 et 8, sur une case libre, au tour du joueur et avant la fin.
Les positions textuelles (par exemple `"0"`) ne sont plus acceptées par
coercition ; les actions incomplètes sont refusées explicitement. Les coups
proposés à l'interface et aux bots restent identiques et dans le même ordre.

L'état JSON, les règles et la vue complète (sans information cachée) sont
inchangés. Les tests communs `lib/engine-contract.test.js` exercent le moteur
réel, les entrées gelées, les refus et le replay après restauration JSON.
