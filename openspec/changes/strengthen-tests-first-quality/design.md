## Décisions

Écrire et exécuter les tests avant les corrections/refactorings. Une anomalie
confirmée conserve sa reproduction ; les cas déjà conformes restent des tests
de caractérisation. Vérifier effets et invariants, pas seulement appels mockés.
Le moteur ou l'orchestration testé reste réel ; seules ses frontières sont doublées.

Les sept scopes initiaux sont indépendants : rapports CI, messages, loader,
settings, Dames, Triomino, Simulation. Chacun possède son worktree et ses fichiers.
Les configurations communes et les guides restent hors des scopes métier.
L'intégration dépend de leurs contributions ; les seuils dépendent ensuite
de la mesure complète. Une extraction ne devient pas une obligation artificielle.

Utiliser Jest, ESLint/Biome, tsc et Playwright existants dans Docker, sans nouvelle
dépendance. Reporter statements/branches/fonctions/lignes séparément avec SHA/run
et limites d'instrumentation. Conserver les seuils et gates existants.
Le pourcentage global n'est pas une certification ni un objectif à 100 %.

Ne pas modifier les séquences RNG, règles françaises des Dames ou modes Triomino
pour faciliter les tests. Les anciennes sessions iframe ne doivent pas piloter
la session courante. Un reset refusé ou échoué ne produit pas un succès trompeur.

## Validation et livraison

Tests ciblés avec couverture et invariants après chaque contribution, puis
suite complète/qualité/types/OpenSpec, build et Chromium sur l'archive intégrée.
Vérifier réellement le refus d'une régression de seuil ciblé.
La PR d'implémentation part de main livré ; la PR de plan #146 reste distincte.
Une CI native du head final est une preuve séparée des validations locales.
L'archivage attend livraison et autorisation explicite.
