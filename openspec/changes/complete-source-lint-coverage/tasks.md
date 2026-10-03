## Préparation
- [x] 1. Terminer et mesurer l'optimisation CI dans un worktree distinct.
- [x] 2. Vérifier les versions et compatibilités sans forcer de peers.

## Implémentation
- [x] 3. Configurer le lint TS et corriger les sources concernées.
- [x] 4. Couvrir les scripts HTML et corriger les sources concernées.
- [x] 5. Intégrer les périmètres aux commandes/gates et tester leurs erreurs.
- [x] 6. Actualiser guides, parcours et skills avec les limites réelles.

## Vérification et revue
- [x] 7. Vérifier lint, types, tests, audit, build et navigateur dans Docker.
- [x] 8. Ouvrir une PR distincte et constater ses contrôles natifs.
- [ ] 9. Après autorisation et livraison constatée, décider sync et archive.

Preuves locales : vrais CLI sur sources/fixtures, warnings fatals et diagnostics
JSON ; 14 TS suivis couverts, scripts HTML et handlers migrés. Suite complète
et seuils vérifiés, audit npm, types et OpenSpec strict ; build de production
puis 64 scénarios Chromium sur `site/` sans modification de son contenu.
La frontière Chart externe est simulée dans la régression du laboratoire,
pas son modèle neuronal ni ses canvas. Pas de merge, déploiement ou archive.

PR #140 : CI 37136498309 et Security Audit 37136498150 réussis sur bd9ed72,
navigateur compris. Le code est identique à d8f7495 ; la synchronisation ajoute
seulement l'ascendance main. L'optimisation a été fusionnée extérieurement dans
l'ancien parent après la fusion de celui-ci : PR #141 corrige sa cible main,
avec ce lot lint empilé au-dessus. Ce constat n'est pas une livraison présumée.
