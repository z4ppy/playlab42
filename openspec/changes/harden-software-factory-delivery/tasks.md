# Tasks

## Contrat
- [x] 1. Lire les specs/changes actifs et valider les nouveaux artefacts avec le CLI épinglé.

## Implémentation
- [x] 2. Unifier le build et produire un dossier public avec identité de commit.
- [x] 3. Relier CI, navigateur sur archive préconstruite et publication du même artefact.
- [x] 4. Ajouter un smoke test HTTP explicite avec contrôle du commit et cas d'erreur.

## Documentation
- [x] 5. Actualiser architecture, contribution, pipelines et déploiement.
- [x] 6. Compléter le guide et le parcours avec sources officielles et évolutions restantes.

## Validation
- [x] 7. Tester les contrats YAML, packaging, smoke et documentation dans Docker.
- [x] 8. Exécuter tests, lint, types, build et parcours navigateur sur le site préparé.

### Résultats locaux

- Node 26 dans le conteneur du worktree : 83 suites et 1 832 tests avec coverage,
  lint, types et build de production réussis.
- OpenSpec strict : 22 éléments validés. Workflows vérifiés avec actionlint.
- Image officielle Playwright `v1.63.0-noble` (Node 24.20) : 56 tests Chromium
  réussis sur `site/`, sans reconstruction, y compris WebGL et liens du lecteur.
- Sommes SHA-256 des fichiers et comparaison de l'archive tar inchangées après
  les tests navigateur ; smoke HTTP local réussi sur neuf ressources.
- La CI native GitHub, les protections distantes et la publication n'ont pas été
  exécutées ou modifiées. Le build local conserve un commit `null`, sans attestation.

## Livraison ultérieure
- [ ] 9. Faire relire la PR et constater la CI native GitHub.
- [ ] 10. Sur autorisation explicite, merger et vérifier la publication.
- [ ] 11. Après livraison et décision explicite, synchroniser et archiver le change.
