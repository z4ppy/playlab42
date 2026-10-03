# Go 9×9 : contrat moteur

Le moteur réel expose `init`, `applyAction`, `isValidAction`, `getValidActions`,
`getPlayerView`, `isGameOver`, `getWinners`, `getCurrentPlayer` et `getScores`.
La configuration comporte une seed numérique et les IDs des deux joueurs.
Les actions concrètes sont `place` (coordonnées x/y entières entre 0 et 8),
`pass` et `resign`. Les coordonnées textuelles ou fractionnaires et les
actions incomplètes sont refusées explicitement, sans modifier l'état.

`getScores` retourne `null` avant le comptage, puis une map **ID joueur → score**.
Le champ JSON historique `state.scores` garde ses clés `black`/`white` :
l'interface et les bots existants continuent à le lire sans migration.
La vue reste complète (pas d'information cachée au Go).

Les scénarios partagés de `lib/engine-contract.test.js` protègent le replay
déterministe, la reprise JSON, les entrées gelées, les actions proposées et les
refus hors tour/après la fin. Les règles, le ko, le scoring et la géométrie
du plateau ne sont pas modifiés par l'harmonisation du contrat.
