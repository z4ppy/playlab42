## Contrats
- [x] Valider strictement le change avant implémentation (38 éléments).
- [x] Ajouter les régressions avant correction et constater leur échec (21 cas moteur, contraste clair et double passe navigateur).

## Corrections indépendantes
- [x] Restaurer les lignes du morpion et mesurer le contraste (4 thèmes, desktop/mobile).
- [x] Ajouter la revue Go réversible, confirmation et reprise ; suspendre le bot.
- [x] Documenter le comportement et les limites, préserver les replays historiques.

## Livraison
- [x] Valider tests, floors, qualité, build et interactions dans Docker (182 suites, 4 132 tests, 3 snapshots ; 79 interactions ciblées).
- [x] Ouvrir la PR #156 et vérifier la tête native 74e3cc3 : CI 37234505543 et audit 37234505371 verts ; 167 interactions et 9 smokes, 7 artefacts qualité/Jest validés, 70 floors/101 fichiers. Toute tête documentaire suivante est revérifiée en commentaire de PR.
- [ ] Fusion, publication et archivage sur décision distincte.
