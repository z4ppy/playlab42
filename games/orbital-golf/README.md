# Golf orbital

Jeu solo de golf dans l'espace : la balle suit la gravité des planètes, rebondit
sur leurs surfaces, peut s'y poser, et disparaît dans les trous noirs. Sans
framework, sans CDN, sans backend ; thèmes clair et sombre du portail.

## Jouer

Depuis le catalogue Playlab42, choisir **Golf orbital**, ou ouvrir
`games/orbital-golf/index.html` depuis le serveur HTTP du projet (les modules ES
ne se chargent pas en `file://`).

| Mode | Contenu |
|---|---|
| Initiation | 9 trous faits à la main, du premier putt au grand tour |
| Trou du jour | 1 trou généré à partir de la date locale de l'appareil |
| Parcours libre | 9 trous générés à partir d'une graine affichée et rejouable |

| Commande | Doigt ou souris | Clavier |
|---|---|---|
| Viser | Glisser n'importe où sur le terrain : la balle part à l'opposé, la longueur du glissé règle la puissance | ← → (1°, Maj : 0,1°), ↑ ↓ (1 %, Maj : 10 %) |
| Réglage fin | Boutons ⟲ ⟳ (0,5°) et − + (1 %) | — |
| Tirer | Relâcher, ou bouton **Tirer** si « Confirmer chaque tir » est coché | Entrée ou Espace |
| Annuler un glissé | Revenir au point d'appui | Échap |
| Accélérer un vol | Toucher le terrain | Espace |
| Pause, aide, son, recommencer | Barre du haut, bouton ↺ | P, ?, S, R |

« Confirmer chaque tir » est coché par défaut sur un pointeur grossier (écran
tactile) : le doigt vise, les boutons de réglage affinent, puis **Tirer** joue.
Le canvas décrit pour les lecteurs d'écran la distance et la direction du trou.

La perte de focus, un onglet masqué ou une pause du portail suspendent la
partie ; **la reprise est volontaire**. Le son est coupé par défaut.

## Règles

- Un coup = un angle (dixième de degré) et une puissance (1 à 100). Le vol est
  simulé d'un bloc par le moteur, puis animé par le client.
- **Rentré** : centre de la balle à 22 u ou moins du trou, vitesse < 150 u/s.
- **Arrêtée** : sur une planète ou sur le green (disque vert de 90 u qui freine
  la balle). Le coup suivant part de là ; depuis une planète, un tir doit
  quitter la surface.
- **Hors limites**, **avalée** (horizon d'un trou noir, 30 u) ou **perdue en
  orbite** (vol de plus de 10 s) : le coup compte et la balle revient au point
  de tir.
- Au 8ᵉ coup manqué, le trou est ramassé et compte 9.
- Les lunes suivent une orbite imposée et ne bougent que pendant les vols : la
  scène est figée pendant la visée. Une lune renvoie toujours la balle.
- Un record exige une partie sans « recommencer » ni indice. Les records
  (plus petit total) sont rangés par `GameKit.saveProgress`, car le tri
  décroissant de `saveScore` ne convient pas au golf.

## Architecture

| Fichier | Rôle |
|---|---|
| `engine.js` | `OrbitalGolfEngine` : contrat GameEngine, validation, transitions |
| `engine/physics.js` | Verlet vitesse à pas fixe (1/240 s), collisions, roulement, green, aperçu |
| `engine/level.js`, `engine/levels.js` | Schéma d'un trou, orbites, 9 trous d'initiation |
| `engine/generator.js`, `engine/solver.js` | Génération à graine et preuve de jouabilité |
| `engine/scoring.js` | Libellés (birdie, bogey…), plafond, totaux |
| `controller.js`, `input.js` | Machine d'états, animation, lance-pierre et clavier |
| `renderer.js`, `renderer-effects.js` | Canvas 2D net, étoiles, grille de champ, traînée |
| `records.js`, `audio.js` | Records v1 et effets WebAudio synthétisés |

Le moteur est pur et déterministe : ni horloge, ni `Math.random`. Le client
fournit la date du trou du jour ; chaque trou généré dérive sa graine de
`fnv1a32(graine + ':' + indice)` et n'est produit qu'à son tour. Le solveur
garde un tir qui atteint le green en moins de 7 s, dont au moins deux voisins
(±0,5°, ±2 %) réussissent aussi, et refuse dès la difficulté 0,3 un trou que le
tir direct suffit à jouer. Ce tir sert de `reference` (indice et tests).

Générer et prouver un trou reste sur le fil principal : comptez de 0,1 à 0,3 s
sur un ordinateur et jusqu'à environ 2 s sur un téléphone lent. Le contrôleur
peint d'abord le bandeau visible « Préparation du trou… » (`#busy`, phase
`loading`), puis lance le calcul ; la page ne répond pas pendant ce temps.

`Math.sin`, `Math.cos` et `Math.atan2` ne sont pas garantis identiques d'un
moteur JavaScript à l'autre : le replay est exact dans un même moteur, et la
fenêtre de robustesse du solveur protège la jouabilité entre navigateurs.

## Tests

```bash
make npm CMD="test -- games/orbital-golf lib/engine-contract.test.js"
make npm CMD="exec -- playwright test e2e/orbital-golf.spec.js"
```

Les références des trous générés pour 8 graines × 3 difficultés sont figées
dans `engine/generator.test.js` : une différence signale un changement de
physique ou de génération.
