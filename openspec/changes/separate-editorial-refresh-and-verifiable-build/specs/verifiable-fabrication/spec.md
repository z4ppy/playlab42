## ADDED Requirements

### Requirement: Editorial metadata separated from build
La fabrication normale SHALL utiliser le snapshot OG revu sans collecte réseau.

#### Scenario: Network forbidden
- **WHEN** le réseau OG est interdit pendant la fabrication normale
- **THEN** le catalogue conserve ses métadonnées éditoriales et le build réussit

#### Scenario: Corrupt snapshot
- **WHEN** le snapshot source est invalide
- **THEN** une erreur explicite empêche de prétendre une fabrication réussie

### Requirement: Reproducible scoped artifact
À sources, commit, outils, plateforme et SOURCE_DATE_EPOCH identiques,
deux builds SHALL produire les mêmes empreintes publiques.

#### Scenario: Same build inputs
- **WHEN** deux fabrications utilisent les mêmes entrées déclarées
- **THEN** leurs inventaires et empreintes sont égaux

### Requirement: Verifiable public inventory
L'artefact SHALL exposer SBOM de fabrication et inventaire des fichiers livrés,
et refuser une altération, absence ou fichier supplémentaire.

#### Scenario: Modified file
- **WHEN** un fichier est altéré après fabrication
- **THEN** la vérification d'intégrité échoue explicitement

### Requirement: Documented recovery boundaries
La reprise SHALL être exercée localement et rester une décision humaine en production.

#### Scenario: Local archive restore
- **WHEN** l'archive connue est restaurée après altération locale
- **THEN** l'intégrité et l'identité attendues sont à nouveau vérifiées
