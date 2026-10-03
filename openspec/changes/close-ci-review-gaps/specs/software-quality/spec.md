## ADDED Requirements

### Requirement: Fork-safe security reports
Le workflow de sécurité SHALL produire un artefact et un résumé de rapport
sur PR de fork sans essayer un commentaire avec token public en lecture seule.

#### Scenario: Public fork pull request
- **WHEN** le dépôt source de la PR diffère du dépôt analysé
- **THEN** le rapport est généré, archivé et ajouté au résumé
- **AND** aucun appel de commentaire PR n'est effectué
- **AND** aucun pull_request_target ni secret supplémentaire n'est utilisé

#### Scenario: Same-repository pull request
- **WHEN** le dépôt source de la PR correspond au dépôt analysé
- **THEN** le job dédié peut commenter avec ses permissions PR localisées
- **AND** l'appel API est attendu et ses erreurs restent explicites

#### Scenario: Non-pull-request event
- **WHEN** l'audit vient d'un push, du planning ou d'un lancement manuel
- **THEN** aucun accès au dépôt source d'une PR absente ni commentaire PR n'est tenté
- **AND** artefact et résumé restent disponibles
