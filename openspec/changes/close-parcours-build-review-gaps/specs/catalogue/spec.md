## ADDED Requirements

### Requirement: Required tool HTML entry point

Le builder SHALL collecter une erreur bloquante lorsqu'un manifest d'outil
valide n'a pas son point d'entrée HTML, pour les formats simples et complexes.
Il SHALL conserver le dernier catalogue et sortir avec un code non nul, sans
ignorer cet outil ni annoncer de succès.

#### Scenario: Simple tool missing HTML with another valid tool
- **WHEN** `tools/foo.json` est valide mais `tools/foo.html` est absent
- **AND** un autre outil possède un manifest valide et son HTML
- **THEN** le CLI sort avec le code 1 et nomme le HTML manquant
- **AND** le catalogue précédent reste inchangé

#### Scenario: Complex tool missing HTML
- **WHEN** `tools/foo/tool.json` est valide mais `tools/foo/index.html` est absent
- **THEN** le CLI échoue avec une erreur contextualisée sans remplacer le catalogue
