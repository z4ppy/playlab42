# Démineur

Le démineur classique, avec trois ajouts qui en font un support d'apprentissage :
**le premier clic est toujours sûr**, les grilles sont **sans hasard** par défaut
(elles se terminent par pure logique), et un **solveur explique en français**
chaque déduction : indice, carte des probabilités et IA qui joue sous vos yeux.

## Règles

Ouvrir toutes les cases sans mine. Un chiffre indique combien de mines se cachent
parmi ses huit voisines ; un « 0 » ouvre automatiquement ses voisines, en cascade.

| Niveau | Grille | Mines |
|---|---|---|
| Débutant | 9 × 9 | 10 |
| Intermédiaire | 16 × 16 | 40 |
| Expert | 30 × 16 | 99 |

- **Drapeau** : marque une mine supposée (le compteur affiche mines − drapeaux).
- **Accord** : un clic sur un chiffre dont les drapeaux sont au complet ouvre ses
  autres voisines. Si un drapeau est faux, une mine explose : c'est la règle.
- **Défaite** : les mines sont dévoilées, les drapeaux erronés sont barrés.
- **Victoire** : toutes les cases sûres sont ouvertes ; le temps (hors pauses)
  devient un record s'il a été obtenu sans indice, sans IA et sans rejouer la grille.

| Entrée | Ouvrir | Drapeau | Accord |
|---|---|---|---|
| Souris | clic gauche | clic droit | clic sur un chiffre, clic milieu |
| Doigt | appui | appui long, ou bouton « Mode drapeau » | appui sur un chiffre |
| Clavier | Entrée / Espace | F | Entrée sur un chiffre |

Les flèches (et Ctrl + Début/Fin) parcourent la grille, H demande un indice.
Sur téléphone en portrait, la grille Expert est affichée **pivotée** (16 × 30)
pour garder des cases assez grandes ; la barre d'outils reste au bas de l'écran.

## Architecture

```
games/demineur/
├── engine.js            # Moteur : contrat GameEngine (règles seules)
├── engine/
│   ├── grid.js          # Niveaux, indices ↔ coordonnées, voisinages
│   ├── board.js         # Ouverture en cascade (partagée moteur / simulation)
│   └── generator.js     # Premier clic sûr, mode sans hasard, repli borné
├── solver/
│   ├── board-reader.js  # Vue joueur → contraintes « ce chiffre voit N mines ici »
│   ├── deductions.js    # Chiffre seul, paires de chiffres, compte global
│   ├── probabilities.js # Énumération exacte de la frontière, pondérée
│   ├── explanations.js  # Rédaction française des raisonnements
│   ├── solver.js        # analyze() et adviseMove() : indice et bot
│   └── playthrough.js   # Partie simulée « sans deviner » pour le générateur
├── bots/                # Hasard (facile) et Solveur (expert)
├── ui/                  # Rendu de la grille, gestes, chronomètre, records
├── controller.js        # Relie DOM, moteur, solveur et bot (dépendances injectables)
├── main.js, index.html, style.css
```

Le **moteur** est pur, déterministe et isomorphe : ni DOM, ni horloge, ni stockage.
Son état est du JSON (`marks`, `mines`, `rngState`...) ; il ne modifie jamais
l'état reçu et refuse une action invalide par une erreur qui en donne la raison.
Les actions sont `{ type: 'reveal' | 'toggleFlag' | 'chord', index }` avec
`index = y * width + x`.

`getPlayerView` ne montre **aucune mine** tant que la partie dure : seulement les
chiffres ouverts, les cases fermées et les drapeaux. Elle ne contient ni la seed
ni l'état du générateur, qui permettraient de recalculer la grille. Le chronomètre,
les animations, le mode drapeau et les records appartiennent à la page.

## Comment fonctionne l'IA

Le solveur ne lit que la vue joueur, comme un humain. Les drapeaux servent à
rédiger les explications mais ne sont **jamais crus** : un drapeau peut être faux,
et le solveur sait alors le signaler (« Le drapeau en (3, 4) est faux »).

1. **Chiffre seul.** Si un chiffre touche déjà toutes ses mines, ses autres
   voisines sont sûres ; s'il n'a plus que N voisines possibles pour N mines,
   ce sont des mines. *« Le 2 en (3, 4) touche déjà 2 drapeaux : ses autres
   voisines sont sûres. »*
2. **Paires de chiffres.** Deux chiffres A et B partagent des voisines. Si `x`
   est le nombre de mines de la zone commune, il est borné par
   `max(0, A − |propre A|, B − |propre B|) ≤ x ≤ min(|commune|, A, B)`.
   Quand la borne force la zone propre d'un chiffre à 0 mine (ou à être pleine),
   on conclut. Cela couvre l'inclusion d'ensembles et les motifs « 1-1 »,
   « 1-2 », « 1-2-1 ».
3. **Compte global.** Toutes les mines localisées → le reste est sûr ; autant de
   mines que de cases fermées → tout est miné.
4. **Probabilités exactes.** La frontière (cases fermées touchant un chiffre) est
   découpée en composantes indépendantes, dont on énumère toutes les
   configurations par retour arrière avec élagage. Une configuration à `k` mines
   laisse `R − k` mines aux `I` cases intérieures : elle pèse `C(I, R − k)`.
   On en déduit le risque exact de chaque case (y compris l'intérieur) et les
   certitudes que la logique locale ne voit pas (cases à 0 % ou 100 %), calculées
   sur des entiers pour ne pas dépendre des arrondis.
   **Garde-fou** : au-delà de 200 000 nœuds explorés, on se replie sur une
   estimation locale (ratio du chiffre le plus contraignant, densité moyenne à
   l'intérieur), signalée comme telle, sans en tirer de certitude.

Les techniques s'appliquent toujours de la plus simple à la plus subtile : les
explications restent les plus courtes possibles. Un conseil rappelle aussi les
déductions préalables qui ne sont pas visibles (« Parce que : le 1 en (2, 3)
n'a qu'une voisine fermée : c'est une mine »).

**Conseil** (`adviseMove`, utilisé par l'indice et le bot Solveur) : corriger un
drapeau prouvé faux, sinon ouvrir une case sûre, sinon marquer une mine certaine,
sinon parier sur la case la moins risquée en annonçant sa probabilité.
Les égalités sont départagées par le générateur seedé du bot.

**Génération sans hasard.** Après le premier clic, on tire une grille, puis on la
fait jouer au solveur en n'ouvrant que des cases prouvées sûres. S'il bloque,
on tire la suivante avec le même générateur (son état avance) : le résultat reste
déterminé par la seed et le premier clic. Mesures : Débutant 1 essai en moyenne,
Intermédiaire 1,5, Expert 7 (environ 40 ms par grille Expert). Au-delà de
**100 essais**, on garde la grille que le solveur a le plus avancée et la page
prévient qu'un pari peut être nécessaire (`generation.guaranteed: false`).

**Bots** (`game.json`) : `Hasard` ouvre une case fermée au hasard ; `Solveur` joue
le conseil ci-dessus. Le bot Solveur gagne toutes les grilles sans hasard et
environ la moitié des grilles Expert classiques (premier clic sûr compris).

## Reproductibilité

Une partie est entièrement déterminée par sa seed, son niveau, son mode et la
suite d'actions. La page affiche le numéro de grille et accepte des paramètres
d'URL pour la retrouver : `index.html?seed=42&level=expert` (ajouter `&classique`
pour désactiver le mode sans hasard). « Rejouer cette grille » relance la même
seed avec le même premier clic : la grille est identique, le temps ne compte pas.

## Tests

```bash
make npm CMD="test -- games/demineur lib/engine-contract.test.js"
```

- `engine.test.js` : premier clic, cascade, drapeaux, accord, victoire/défaite,
  actions invalides, immutabilité, replay état par état, reprise JSON, vue sans fuite.
- `solver/*.test.js` : un cas dessiné par technique, explications, conseil, et
  comparaison des probabilités avec une **énumération brute** sur 150 positions.
- `engine/generator.test.js`, `bots/bots.test.js`, `ui/ui.test.js`,
  `controller.test.js` (vraie page en jsdom) et `e2e/demineur.spec.js` (navigateur).
