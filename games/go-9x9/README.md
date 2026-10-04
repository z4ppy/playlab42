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

## Revue de fin de partie

La page active `manualScoring: true` dans `init`. Après deux passes, le moteur
ouvre `state.scoring` sans score ni vainqueur : les coups et le bot sont suspendus.
Les groupes non marqués sont vivants. Activer une pierre au clavier ou à la souris
bascule tout son groupe connexe, de l'une ou l'autre couleur ; les groupes morts
portent une croix et un libellé accessible. En solo, l'humain contrôle cette revue
même si le joueur suivant est le bot. Aucune IA ne décide automatiquement de la
vie ou de la mort, et aucune double approbation fictive n'est simulée.

Les méthodes immuables `toggleDeadGroup(state, x, y)`, `confirmScore(state)` et
`resumePlay(state)` exigent une revue en cours et rejettent explicitement les
autres phases. `state.deadStones` contient des indices `y * 9 + x`, sérialisables.
La confirmation calcule l'aire chinoise sur une copie sans les groupes morts,
avec komi 6.5 ; ces retraits ne sont pas des captures. Le plateau joué et son
marquage final restent visibles. La reprise efface les marquages et les deux
passes, conserve plateau/captures/komi et reprend au joueur suivant.

Sans cette option, le moteur garde exactement son scoring automatique et son
format JSON historiques, pour préserver les appelants et trajectoires existants.
Les tests de caractérisation, les scénarios de revue avec entrées gelées et les
interactions navigateur couvrent ces deux contrats.
