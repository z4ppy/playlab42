## ADDED Requirements

### Requirement: Validated publication
La chaîne de livraison SHALL publier uniquement après le succès du lint, des
tests unitaires, du contrôle de types, de la validation OpenSpec stricte, du build
et des tests navigateur pour le commit concerné.

#### Scenario: Failed validation
- **WHEN** un contrôle requis échoue
- **THEN** la publication Pages ne démarre pas

#### Scenario: Manual publication outside main
- **WHEN** une publication manuelle vise une référence différente de `main`
- **THEN** le workflow échoue avec un diagnostic explicite

### Requirement: One tested public artifact
La chaîne de livraison SHALL construire TypeScript et les ressources statiques
une seule fois, tester l'archive produite puis publier cette même archive.

#### Scenario: Browser validation
- **WHEN** la CI teste une archive de site construite
- **THEN** Playwright sert les fichiers extraits sans reconstruire les catalogues
- **AND** le déploiement utilise cette archive après le succès des contrôles

#### Scenario: Public payload
- **WHEN** le dossier `site/` est préparé
- **THEN** il contient les entrées web, catalogues, distributions runtime et guides
- **AND** il exclut les dépendances npm, tests, caches et configurations privées de développement

### Requirement: Observable deployment identity
La livraison SHALL inclure l'identité du commit CI et un contrôle HTTP du site publié.

#### Scenario: Matching deployment
- **WHEN** le contrôle reçoit l'URL publiée et le commit attendu
- **THEN** il vérifie l'identité, les catalogues et des points d'entrée du site

#### Scenario: Incorrect or unavailable deployment
- **WHEN** l'identité est incorrecte, une ressource requise est indisponible ou un catalogue est invalide
- **THEN** le contrôle échoue explicitement sans annoncer une livraison valide

### Requirement: Honest software factory documentation
La documentation SHALL distinguer les garanties automatisées, les contrôles
consultatifs, les réglages GitHub externes et les évolutions proposées.

#### Scenario: Learning the delivery workflow
- **WHEN** un contributeur consulte le guide ou le parcours
- **THEN** les commandes et garanties décrites correspondent aux workflows versionnés
- **AND** les améliorations restantes ne sont pas présentées comme réalisées
