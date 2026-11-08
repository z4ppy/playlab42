# Reconnaissance de chiffres

On dessine un chiffre au doigt ou à la souris ; un petit réseau de neurones
convolutif l'identifie **dans le navigateur**, sans serveur d'inférence ni
bibliothèque externe. Les seuls fichiers chargés sont ceux de ce dossier.

## Ce que montre l'outil

1. **Prétraitement façon MNIST**, visible : boîte englobante (pointillés sur le
   dessin), réduction proportionnelle dans 20×20 avec niveaux de gris, puis
   centrage par centre de masse dans 28×28. L'image 28×28 réellement donnée au
   modèle est affichée à côté de la prédiction.
2. **Prédiction en direct** pendant le tracé : barres de probabilité 0-9,
   chiffre retenu et confiance.
3. **Activations** : les 8 filtres 5×5 appris et leurs cartes 24×24, les 16
   cartes 10×10 de la seconde convolution, les 64 neurones cachés.
4. **Exemple MNIST** : rejoue l'une des 20 images réelles du jeu de test,
   passée par le même prétraitement que les dessins.

## Architecture

| Fichier | Rôle |
|---------|------|
| `src/preprocess.js` | Prétraitement pur (encre → 28×28), sans DOM |
| `src/model.js` | Inférence pure (Float32Array) : convolutions, max-pool, denses, softmax |
| `src/weights-loader.js` | Validation du manifeste, décodage float32, contrôle SHA-256 |
| `src/visuals.js` | Conversions pures valeurs → couleurs du thème |
| `src/drawing-pad.js` | Dessin Pointer Events (doigt, stylet, souris) |
| `src/main.js` | Interface |
| `model/model.json` | Manifeste : architecture, offsets, empreinte, provenance, précision |
| `model/weights.bin` | 27 690 poids float32 little-endian (108 Ko) |
| `model/mnist-samples.json` | 20 images du jeu de test (2 par chiffre) |

Réseau : `conv 8×5×5 → ReLU → max-pool 2 → conv 16×3×3 → ReLU → max-pool 2 →
dense 400→64 → ReLU → dense 64→10 → softmax`. À cette taille, une
quantification int8 n'apporterait rien d'utile : les poids restent en float32.

## Entraînement reproductible

Le script `scripts/train-digit-recognizer.js` (JavaScript pur, sans
dépendance) régénère les trois fichiers de `model/`. Dans Docker, depuis la
racine du dépôt :

```sh
node scripts/train-digit-recognizer.js --download   # télécharge MNIST dans tmp/mnist (ignoré par Git)
node scripts/train-digit-recognizer.js --data <dossier contenant les 4 .gz>
```

- Source : miroir `https://ossci-datasets.s3.amazonaws.com/mnist/` (celui de
  torchvision ; les URLs historiques de yann.lecun.com ne répondent plus). Les
  quatre archives sont vérifiées par SHA-256 ; leurs MD5 sont ceux publiés.
- Graine 42, Adam, 12 époques, lots de 32, taux d'apprentissage cosinus de
  0,002 à 0,00005, augmentation aléatoire (rotation, échelle, cisaillement,
  translation) pour mieux tolérer les dessins au doigt.
- 55 000 images d'entraînement, 5 000 retenues pour la validation ; le jeu de
  test n'est utilisé qu'une fois, à la fin, avec `src/model.js`.
- Résultat : **99,31 %** sur les 10 000 images de test (9 931 correctes ; détail,
  historique et matrice de confusion dans `model/model.json`).
- Durée : environ 9 minutes sur un cœur de CPU.

Les gradients de la rétropropagation sont testés par différences finies
(`scripts/lib/digit-recognizer-training.test.js`).

## Données et licence

MNIST, Yann LeCun, Corinna Cortes et Christopher J.C. Burges,
<https://yann.lecun.com/exdb/mnist/>, licence
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Les 20 images
de `model/mnist-samples.json` sont extraites du jeu de test sans modification
(octets 0-255 encodés en base64) et restent sous cette licence. Les poids
dérivent de l'apprentissage sur ces données.

## Limites

- MNIST contient des chiffres écrits au stylo sur papier par des Américains :
  un 1 avec empattement, un 7 barré ou un 4 fermé peuvent être moins bien
  reconnus. La précision affichée concerne MNIST, pas les dessins au doigt.
- Le réseau répond toujours un chiffre, même pour un gribouillis.
- Hors contexte sécurisé (HTTP distant), Web Crypto est indisponible : seule la
  taille de `weights.bin` est alors contrôlée, pas son empreinte.
