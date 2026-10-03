## ADDED Requirements

### Requirement: Required Build security aggregation
La CI SHALL faire du check déjà requis Build un gate explicite de succès
Security lint et Trivy, sur PR et dans la CI réutilisée avant publication,
sans modifier les neuf checks configurés à distance.

#### Scenario: Security gates succeed
- **WHEN** Security lint et Trivy terminent tous deux avec le statut success
- **THEN** Build peut installer les dépendances, construire et archiver le site
- **AND** les autres validations restent nécessaires à la publication

#### Scenario: Security gate fails or does not run
- **WHEN** un gate sécurité est failure, skipped, cancelled, absent ou inconnu
- **THEN** Build s'exécute et échoue explicitement à sa première étape
- **AND** aucune installation, fabrication ou archive Build n'est exécutée
- **AND** un statut Build skipped n'est pas utilisé pour satisfaire la protection

#### Scenario: Parallel validation
- **WHEN** la CI démarre
- **THEN** les gates sécurité et les autres contrôles indépendants peuvent commencer en parallèle
- **AND** Build attend seulement les gates sécurité, puis Browser attend l'archive Build

### Requirement: Shared blocking Trivy policy
La CI de PR/publication et l'audit complémentaire SHALL appeler un workflow
Trivy partagé avec installation versionnée/checksum vérifié, analyse vuln/secret
HIGH/CRITICAL incluant les dépendances de développement et sortie bloquante.

#### Scenario: Scanner vulnerability or execution failure
- **WHEN** Trivy détecte un problème au seuil requis ou son exécution échoue
- **THEN** son job échoue sans conversion en résultat consultatif
- **AND** le rapport JSON est archivé lorsqu'il est disponible, son absence étant une erreur explicite

#### Scenario: Two callers in one run
- **WHEN** CI et Security Audit invoquent le workflow partagé dans un même run
- **THEN** leurs rapports portent des noms distincts sans collision d'artefacts
- **AND** les rapports consolidés utilisent les vrais états GitHub des jobs réutilisés
