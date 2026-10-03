## Priorité 1 : contrats

- [x] Reproduire le reset Mastermind non déterministe avant correction.
- [x] Fournir la seed depuis l'appelant et tester refus/replay.
- [x] Protéger les six moteurs par des scénarios de conformité communs.
- [x] Harmoniser API/types sans migration des états JSON ni régression UI.

## Priorité 2 : cœur d'interface

- [x] Caractériser puis séparer clavier/focus et chargement commun du portail.
- [x] Caractériser les composants réels du lecteur et supprimer le rendu parallèle.

## Priorité 3 : conception et mutualisation

- [x] Décomposer validation JSON, sauvegardes et persistance.
- [x] Caractériser et clarifier le moteur pédagogique.
- [x] Mutualiser le RNG avec séquences de référence inchangées.
- [x] Séparer les responsabilités Triomino et réduire les hotspots Tetris/Dames/Go.
- [x] Actualiser les cinq dépendances avec contrats et rendu réel vérifiés.
- [x] Trier les diagnostics consultatifs et corriger les problèmes concrets.

## Intégration et livraison

- [x] Collecte et budgets ciblés après mesure, sans baisse des seuils hérités.
- [x] Guides et parcours alignés, avec limites et preuves datées.
- [x] Revue et validation intégrée complète dans Docker.
- [x] Builds reproductibles, archive vérifiée et Chromium réel.
- [x] PR et dernière tête native vérifiées (PR #148 ; preuves datées en commentaire).
- [ ] Livraison constatée et décision explicite d'archivage, hors autorisation actuelle.
