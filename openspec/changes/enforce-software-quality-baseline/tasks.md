## Contrat
- [x] 1. Mesurer l'état réel et préciser le lot autorisé.
## Contrôles
- [x] 2. Renforcer lint et audit requis dans la CI.
- [x] 3. Activer les seuils ciblés et éprouver les chemins d'échec.
- [x] 4. Rendre le rapport de sécurité fidèle aux états des analyses.
## Pratiques
- [x] 5. Actualiser guides, parcours et skill release ; ajouter le skill de revue.
## Validation
- [x] 6. Vérifier tests, lint, types, OpenSpec et guides dans Docker.

### Preuves locales

- Node 26 dans Docker : 85 suites et 1 847 tests avec les seuils actifs, lint
  strict et types réussis. Build local avec TypeScript, guides et site public réussi.
- Refus effectif d'un warning seul ; exécution partielle SeededRandom à 27,27 %
  des statements refusée par le seuil réel de 100 %, sans abaisser la configuration.
- Audit npm : zéro vulnérabilité connue au moment du contrôle ; registre
  volontairement indisponible refusé avec `ECONNREFUSED`, pas un succès vide.
- OpenSpec strict : 23 éléments. Quatre workflows contrôlés avec actionlint.
- Playwright officiel : 57 tests sur le site préconstruit, puis 18 tests ciblés
  après la dernière mise à jour des guides. Sommes des fichiers inchangées pendant
  la suite complète ; smoke HTTP local réussi.
- Scénarios des cinq skills contrôlés structurellement. Les nouveaux scénarios
  de revue n'ont pas fait l'objet d'une comparaison d'agents.
- API GitHub revérifiée le 3 octobre 2026 : main non protégée, zéro règle active
  applicable. Aucun réglage modifié, aucune CI native ni publication déclenchée.
## Livraison ultérieure
- [ ] 7. Faire relire les changements et constater la CI native GitHub.
- [ ] 8. Sur autorisation, livrer puis décider de la synchronisation et de l'archive.
