## ADDED Requirements

### Requirement: Required dependency audit
La livraison SHALL attendre le succès de l'audit npm au seuil modéré, incluant
les dépendances de développement de la chaîne de fabrication.

#### Scenario: Vulnerable or unavailable dependencies audit
- **WHEN** l'audit signale un problème au seuil requis ou ne peut pas être exécuté
- **THEN** la CI échoue et la publication ne démarre pas
