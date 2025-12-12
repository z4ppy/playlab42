# Jeu de Dames - Proposition OpenSpec

Cette proposition ajoute un jeu de Dames (Checkers français, 10×10) à la plateforme Playlab42.

## Documents

- **[proposal.md](./proposal.md)** - Contexte, objectifs et décision
- **[design.md](./design.md)** - Architecture détaillée et considérations techniques
- **[tasks.md](./tasks.md)** - Plan d'implémentation découpé en tâches (30 tâches)

## Spec Deltas

- **[game-engine](./specs/game-engine/spec.md)** - Exigences pour le moteur de jeu
- **[catalogue](./specs/catalogue/spec.md)** - Exigences pour l'entrée catalogue

## Validation

```bash
# Valider la proposition
openspec validate add-checkers-game --strict

# Voir le résumé
openspec show add-checkers-game

# Voir les deltas uniquement
openspec show add-checkers-game --json --deltas-only
```

## Prochaines étapes

1. **Revue** : Faire valider la proposition par l'équipe
2. **Approbation** : Marquer comme approuvée
3. **Implémentation** : Utiliser `@openspec-apply add-checkers-game` pour commencer
4. **Tests** : Suivre les tâches de la phase 2
5. **Intégration** : Phase 5 - intégration au catalogue
6. **Archive** : Une fois déployé, archiver avec `openspec archive add-checkers-game`

## Impact

- **Fichiers créés** : ~8 nouveaux fichiers dans `games/checkers/`
- **Fichiers modifiés** : `data/catalogue.json`
- **Tests** : ~15 tests unitaires
- **Documentation** : README du jeu

## Bénéfices pédagogiques

Ce jeu permet d'enseigner :
- Algorithmes de jeu (minimax, alpha-beta)
- Gestion d'état complexe
- Validation de règles métier
- Interface utilisateur interactive
- Tests unitaires et TDD
