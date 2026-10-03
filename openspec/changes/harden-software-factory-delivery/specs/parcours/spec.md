## ADDED Requirements

### Requirement: Usable slide references
Le lecteur SHALL permettre l'ouverture des références des slides sans autoriser
une navigation automatique de la fenêtre principale.

#### Scenario: Full guide from conclusion
- **WHEN** l'utilisateur active le lien du guide complet avec `target="_top"`
- **THEN** le navigateur ouvre le guide dans la fenêtre principale
- **AND** le sandbox exige une activation utilisateur pour cette navigation

#### Scenario: Reference in a separate tab
- **WHEN** l'utilisateur active une référence avec `target="_blank"` et `rel="noopener"`
- **THEN** le navigateur ouvre la référence hors du sandbox de la slide
- **AND** le parcours reste ouvert dans son onglet
