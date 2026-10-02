# Relativity Lab : modèle et vérification

## Exécution statique

Dans Docker, après l'installation du lockfile :

```sh
npm run build:relativity-vendors
```

Servir ensuite la racine du dépôt par HTTP. Le navigateur charge
`dist/vendor/three.module.js`, `OrbitControls.js` et `lil-gui.esm.js` depuis
le même site. Three **0.186.1**, lil-gui **0.21.0**, esbuild déjà présent :
aucun CDN, framework, backend ou faux objet 3D. `dist/` est généré et ignoré
par Git. Le déploiement doit appeler ce build avant de publier les fichiers.
`build` (utilisé par Pages) et `build:local` l'appellent déjà ; leur composition
avec les autres vendors est coordonnée avec le mainteneur des bibliothèques.
Les licences MIT sont copiées dans `THREE-LICENSE.txt` et `LILGUI-LICENSE.txt`.
Le build refuse une version installée différente des pins du manifest.

## Unités et référentiels

- **c = 1** : temps lab en secondes, distances en secondes-lumière (ls),
  vitesses β en fractions de c. Les masses sont en kg ; les formules E et p
  sont exprimées respectivement en unités kg·c² et kg·c.
- `position` et `velocity` sont toujours dans **un laboratoire inertiel
  conventionnel**, non dans un repos absolu ou un modèle cosmologique CMB.
  Les anciens champs `velocityCMB` / `vCMB` restent des alias de compatibilité.
- Le véhicule nommé « Lab » peut lui aussi recevoir une impulsion. Cela ne
  modifie pas le laboratoire inertiel initial utilisé pour les coordonnées.
- La sélection de l'observateur change le suivi caméra et le cockpit des
  signaux reçus, **pas la simultanéité ni les coordonnées**. La scène montre
  des positions simultanées lab, et non ce qu'une caméra recevrait optiquement.
- Entre impulsions : `dx = β dt`, `dτ = dt sqrt(1−|β|²)`.
  Une vitesse de véhicule non finie ou supérieure à `1−10⁻¹²` est refusée.
  Cette marge est numérique, pas une nouvelle loi physique.

## Horloges et signaux

Les horloges H et V ont la même période propre `T₀ = 2L/c`, et commencent
en phase. Chaque tick émet un flash depuis l'événement exact interpolé.
Le photon interne suit un trajet **exact dans le lab à vitesse c entre
miroirs inertiels**, y compris pour un bras oblique. Si `e` est l'axe propre
du bras, `b = β·e` et `q = phase × T₀` le temps propre du centre depuis le
dernier tick, la réflexion a lieu à `q = L(1+b)` (c=1), pas toujours à
`phase = 0.5`. La fraction du bras contracté parcourue vaut `q/[L(1+b)]`
à l'aller, puis `(2L−q)/[L(1−b)]` au retour. Ajouter la position mobile du
centre donne le trajet lab. H/V gardent les mêmes phases et ticks de période
propre `2L`, malgré des instants de réflexion différents.

Un front lumineux est `|x−xémission| = t−témission` dans le lab.
La réception est l'intersection analytique de ce cône avec le segment
inertiel du récepteur, y compris entre deux pas.

La fréquence reçue dépend des vitesses **à l'émission et à la réception** :

```text
D = fréception / fémission
  = γrécepteur (1 − n·βrécepteur) / [γsource (1 − n·βsource)]
```

`n` est la direction du photon dans le laboratoire. Exemple : source à +0.6c
vers un récepteur fixe à sa droite → D=2 ; source à −0.6c → D=0.5.
Une source transverse à 0.6c donne D=0.8. La soustraction classique des
vitesses et la formule longitudinale seule ne conviennent pas en 3D.

L'oscilloscope représente les phases **simultanées lab**, pas les signaux
retardés : utiliser « Réceptions Doppler » pour ceux-ci. Les distances du HUD
sont les **trajets lumineux lab**, pas une mesure radar aller-retour.
`γ radial≈` est une inférence sous hypothèse strictement radiale ; le Doppler
seul ne permet pas de retrouver une vitesse 3D. Les couleurs sont une légende,
pas une simulation spectrale.

## Propulsion et déterminisme

Chaque impulsion est une fusée à photons idéale à rendement 100 % :
`Δφ = ln(m₀/m₁)`, `Δβrepos = tanh(Δφ)`. La direction est celle du repos
instantané du véhicule, axes définis par le boost canonique sans rotation.
On compose **la vitesse gagnée au repos avec la vitesse lab du véhicule** :
inverser les arguments donne un autre résultat pour des axes non colinéaires.

Le bouton « Inverser » inverse la direction choisie, ce n'est pas un frein
automatique. Le Δv indiqué est celui **au repos**, pas `|vfinal−vinitial|`
dans le laboratoire. Les impulsions de direction nulle, masse invalide ou
vitesse hors borne sont refusées sans consommer de masse.

La poussée continue brûle la valeur du curseur en **kg/seconde lab**,
uniquement pendant la lecture. Elle est intégrée par impulsions au début de
chaque pas fixe `dtlab = 1/60 s`. La pause, le reset, le changement
d'observateur et la perte de focus annulent la commande maintenue.
Les entrées temporelles non finies sont refusées ; le temps réel par frame
est plafonné à 0.1 s et le facteur d'accélération à 100. Un reste inférieur
au pas attend la frame suivante. La suspension d'onglet met en pause :
aucun rattrapage arbitraire du temps caché.

Les trajectoires inertielles et les événements lumineux sont analytiques
sur chaque segment. **La poussée continue est une approximation discrète** :
la convergence ne signifie pas un modèle exact d'accélération d'un solide.
Pas de gravité, rigidité de Born, précession Thomas/Wigner du véhicule,
dynamique du rayonnement ni trajets optiques exacts entre miroirs accélérés.
Lors d'un changement de vitesse, les bras et photons internes sont replacés
selon le boost instantané à phase conservée : ce raccord est une approximation
discrète, pas un trajet lumineux continu exact pendant l'accélération.

## Régressions et limites opérationnelles

- Les tests de `Physics.test.js` vérifient les invariants 1D, temps propres,
  Doppler et rapidités.
- `Simulation.test.js` utilise les **vrais vecteurs et géométries Three** :
  conservation du quadrivecteur d'une impulsion transverse, émissions multiples,
  réception entre pas, 30/60/144 Hz, bornes et libération de textures ; photons
  internes H/V à c (aller/retour longitudinal, transverse, oblique, signes ±),
  continuité aux réflexions et synchronisation des ticks.
- `controls-ui.test.js` teste annulation, débit, erreurs et destruction.
- `e2e/relativity.spec.js` teste le véritable WebGL/lil-gui, les commandes
  mobile et clavier, les versions locales, la pause, le reset et le contexte.
  Les classes CSS de lil-gui 0.21 (`lil-root`, `lil-title`, `lil-children`)
  sont prises en compte ; pincement et annulation tactile sont exercés par
  de vrais événements Chromium, pas seulement des événements synthétiques.

Les signaux visent les observateurs présents à l'émission. Un observateur
ajouté ensuite ne reçoit pas rétrospectivement ces signaux. Les signaux sont
libérés après toutes les réceptions ou au rayon maximal configuré.
L'historique est borné à 500 entrées (avec agrégation ancienne), de même que
celui des impulsions ; il ne constitue pas un journal scientifique exhaustif.

Commandes ciblées, dans Docker :

```sh
npm test -- --runInBand tools/relativity-lab
npm exec -- eslint tools/relativity-lab e2e/relativity.spec.js --ignore-pattern '**/dist/**'
npm run build:relativity-vendors
npm exec -- playwright test e2e/relativity.spec.js
npm exec -- openspec validate correct-relativity-runtime --strict --no-interactive
```

Les résultats réellement exécutés sont consignés dans les tâches du change
`correct-relativity-runtime`, sans déclaration de merge ou de déploiement.
