## Priorité 1 : contrats

- [ ] Reproduire le reset Mastermind non déterministe avant correction.
- [ ] Fournir la seed depuis l'appelant et tester refus/replay.
- [ ] Protéger les six moteurs par des scénarios de conformité communs.
- [ ] Harmoniser API/types sans migration des états JSON ni régression UI.

## Priorité 2 : cœur d'interface

- [ ] Caractériser puis séparer clavier/focus et chargement commun du portail.
- [ ] Caractériser les composants réels du lecteur et supprimer le rendu parallèle.

## Priorité 3 : conception et mutualisation

- [ ] Décomposer validation JSON, sauvegardes et persistance.
- [ ] Caractériser et clarifier le moteur pédagogique.
- [ ] Mutualiser le RNG avec séquences de référence inchangées.
- [ ] Séparer les responsabilités Triomino et réduire les hotspots Tetris/Dames/Go.
- [ ] Actualiser les cinq dépendances avec contrats et rendu réel vérifiés.
- [ ] Trier les diagnostics consultatifs et corriger les problèmes concrets.

## Intégration et livraison

- [ ] Collecte et budgets ciblés après mesure, sans baisse des seuils hérités.
- [ ] Guides et parcours alignés, avec limites et preuves datées.
- [ ] Revue et validation intégrée complète dans Docker.
- [ ] Builds reproductibles, archive vérifiée et Chromium réel.
- [ ] PR et dernière tête native vérifiées.
- [ ] Livraison constatée et décision explicite d'archivage, hors autorisation actuelle.
