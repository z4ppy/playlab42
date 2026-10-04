## Responsabilités indépendantes

Trois scopes en worktrees séparés : rendus des deux plateaux ; construction
et réglages audio ; contrôleurs/menu/curseurs musicaux. L'intégrateur conserve
configurations, collecte, documentation et preuves natives.

Extraire peu de modules cohérents, pas un moteur de rendu universel, une
classe de base de contrôleurs ou un framework de commandes. Conserver les
APIs existantes et les erreurs ; aucune copie parallèle de production pour
les tests. Une répétition de CSS/thèmes ou pédagogie n'est pas automatiquement
un clone à supprimer.

## Comportement et limites

Rendus : état réel, contenu/classes/positions, ordre DOM, écouteurs, focus,
sélection, actions autorisées, score et annonces ; tests de composants réels
et Chromium, sans déplacer le code hors instrumentation.

Audio : Tone reste une frontière contrôlée pour les tests unitaires, pas un
algorithme doublé ; vérifier constructeur/options, connexions, ordre des
réglages, dispose/remplacement, activation et paramètres de presets.
Le navigateur utilise la distribution réelle ; l'audition humaine et les
autorisations microphone restent distinctes.

Le navigateur a confirmé que `MetalSynth.harmonicity` est un nombre avec
accesseur, tandis que `frequency` expose `.value`. Le double initial masquait
la mauvaise écriture `.harmonicity.value`. Corriger cette ligne par affectation
directe et réaligner le double après tests rouges unitaires/navigateur ;
API, événements, ordre et corpus de construction restent identiques.
Les autres limites héritées de mute, filtre et réglages personnalisés ne sont
pas corrigées implicitement.

Contrôleurs : ordre show/hide et synchronisation des curseurs, états ignorés,
menus conditionnels, commandes et idempotence. Une mutualisation garde les
hooks propres à chaque panneau et ne change pas l'ordre des effets.

## Preuves

Baseline native 62 clones / 693 lignes dupliquées, 62 fonctions JS/HTML > 10
dont six > 20 ; pédagogie séparée. Rapport actuel inchangé : même
ESLint/Biome/jscpd, paramètres et scopes. Les nouvelles fonctions restent
mesurées ; ≤ 10 sur les responsabilités ciblées après découpage.

Tests publics avant refactoring, floors existants conservés, collecte des
modules UI/audio ajoutée explicitement. Expliquer les périmètres Jest/CLI/E2E,
pas de seuil global ou d'ignore pour obtenir une baisse. Validation complète,
builds hors réseau, intégrité/reprise, navigateur et artefacts de dernière PR.
