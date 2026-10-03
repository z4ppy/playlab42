## ADDED Requirements

### Requirement: Bounded HTTP lifecycle
Les requêtes OG SHALL être bornées pendant la réception des en-têtes et la
lecture du corps, puis libérées sur succès, erreur et retour anticipé.

#### Scenario: Abandoned HTTP error body
- **WHEN** une page ou une image renvoie une erreur HTTP avec un corps laissé ouvert
- **THEN** le traitement ne conserve pas la réponse abandonnée
- **AND** le processus de fixture termine naturellement en moins de trois secondes

#### Scenario: Stalled body after successful headers
- **WHEN** les en-têtes arrivent mais que le corps reste bloqué
- **THEN** le délai configuré interrompt la requête
- **AND** l'échec est explicite et ne produit pas de métadonnées fraîches en cache

### Requirement: Preserved validation guarantees
L'optimisation CI SHALL conserver les gates et l'utilisation de la même archive
publique pour le navigateur puis la publication.

#### Scenario: Measuring an improvement
- **WHEN** la CI optimisée est comparée à sa baseline
- **THEN** les contrôles existants restent réellement exécutés
- **AND** le gain est décrit avec ses mesures et limites, sans build reconstruit

#### Scenario: Stacked contribution
- **WHEN** une PR vise une branche de contribution avant intégration de son parent
- **THEN** CI et audits sont exécutés automatiquement
- **AND** aucune publication n'est déclenchée par cette PR
