## 1. Contrat et implémentation locale autorisée

- [x] 1.1 Lire AGENTS et les changes actifs de livraison/qualité/scanners ; consigner l'autorisation ciblée.
- [x] 1.2 Extraire le scan Trivy partagé et ses rapports distincts, conserver les politiques bloquantes.
- [x] 1.3 Après 1.2, intégrer Trivy à CI et faire échouer explicitement Build requis sur tout non-succès sécurité.
- [x] 1.4 Préserver artefact/summary sur forks, limiter et attendre l'appel commentaire du même dépôt.
- [x] 1.5 Documenter les neuf checks distants inchangés, la couverture Build et le risque de durée.

## 2. Vérification

- [x] 2.1 Après 1.2–1.4, exercer guards Bash, conditions YAML, permissions/forks, partage scanner et états de jobs réutilisés.
- [x] 2.2 Exécuter les contrats de pipeline affectés et le lint ciblé dans Docker.
- [x] 2.3 Valider ce change avec le CLI OpenSpec épinglé dans Docker.
- [x] 2.4 Vérifier le runtime scanner disponible/préparé dans Docker et consigner l'exécution réelle ou sa limite.

## Preuves et limites

Validation finale le 3 octobre 2026, dans
`playlab42-review-software-factory-dev`, répertoire `/workspace`, dépendances
existantes inchangées :

- `npm test -- --runInBand --runTestsByPath scripts/ci-security-gates.test.js scripts/quality-policy.test.js scripts/software-delivery.test.js scripts/build-security-report.test.js scripts/pinned-chain.test.js` :
  **5 suites, 70 tests réussis**. Le contrat pinned-chain lit désormais
  le job du workflow partagé.
- `node_modules/.bin/eslint scripts/ci-security-gates.test.js scripts/quality-policy.test.js scripts/pinned-chain.test.js --max-warnings=0` : réussi.
- `npm run lint:security -- --no-warn-ignored scripts/ci-security-gates.test.js` :
  réussi (le script conserve sa cible dépôt `.`).
- `OPENSPEC_TELEMETRY=0 node_modules/.bin/openspec validate close-ci-review-gaps --strict --no-interactive` :
  change valide.
- Trivy absent initialement du PATH ; runtime préparé **dans Docker** avec
  l'installer existant. Archive Trivy **0.75.0**, checksum vérifié `OK`, puis
  commande exacte du step `scan` chargé depuis le YAML : sortie **0**, rapport
  JSON schéma 2, cible npm `package-lock.json`, **0 vulnérabilité HIGH/CRITICAL et
  0 secret** détecté. Base ghcr.io/aquasecurity/trivy-db:2 actualisée.
  Ce résultat ponctuel n'est pas une garantie exhaustive ou future ; aucun
  paquet hôte ni dépendance npm n'a été installé/modifié.
  Le runtime `.ci-security-validation` et le rapport local `trivy-results.json`
  ont été supprimés après consignation ; leur absence a été vérifiée.

Les checks distants, CI native et publication n'ont pas été modifiés ou exécutés.
Le coût natif du nouveau chemin critique reste à mesurer après livraison.
La livraison et l'archivage attendent une décision distincte, hors de cette demande.
