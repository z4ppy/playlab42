## Context

Le modèle utilise c=1, les secondes du laboratoire et les secondes-lumière.
Les observateurs sont inertiels entre des impulsions instantanées. La source
et le récepteur échangent des fronts d'onde sphériques dans le laboratoire.

## Decisions

- Un accumulateur à pas lab fixe découple les trajectoires du RAF. Les temps
  d'émission sont interpolés aux ticks propres ; l'intersection du cône de
  lumière et du segment inertiel du récepteur donne la réception.
- Doppler : `γr(1−n·vr) / [γs(1−n·vs)]`, avec n dans le laboratoire.
- La poussée est une vitesse gagnée dans le repos instantané du véhicule,
  composée avec sa vitesse lab. Le débit continu est en kg/seconde lab ;
  l'intégration par impulsions n'est pas une fusée rigide accélérée exacte.
- La scène demeure en coordonnées lab. La sélection change les données
  reçues et le suivi caméra, sans mélanger deux conventions de simultanéité.
  Horloges et corps sont des schémas, pas une image optique retardée.
- Les photons internes suivent exactement les miroirs inertiels dans le lab :
  pour `q=phase×2L` et `b=β·e` sur l'axe propre du bras, la réflexion arrive
  à `q=L(1+b)`. La position relative est le vecteur du bras contracté multiplié
  par `q/[L(1+b)]` à l'aller, `(2L−q)/[L(1−b)]` au retour. La vitesse lab
  a une norme c, même oblique ; les ticks et phases H/V restent synchronisés.
- Modules officiels locaux ; OrbitControls est assemblé par esbuild avec
  `three` externe pour partager une seule instance Three.

## Limits

Pas de gravitation, réaction dynamique du rayonnement, rotation de
Thomas/Wigner du véhicule, rigidité de Born ni traçage optique des miroirs
accélérés. Les changements de vitesse replacent le photon à phase conservée
selon le boost instantané : ce raccord reste une approximation discrète.
Les couleurs Doppler sont une légende, pas un spectre. Le temps de trajet lab
n'est pas une distance radar mesurée par l'observateur. L'accumulateur laisse
au plus un pas en attente ; une suspension d'onglet ne simule pas le temps caché.
