## ADDED Requirements

### Requirement: Supported TypeScript lint
Les sources TypeScript SHALL être lintées par une chaîne compatible avec
la stack actuelle, indépendamment du contrôle strict de types.

#### Scenario: Forbidden or invalid typed source
- **WHEN** une source TS contient une construction interdite ou une syntaxe invalide
- **THEN** le vrai linter échoue avec un diagnostic exploitable
- **AND** aucun peer incompatible n'est forcé

### Requirement: Embedded script lint
Les scripts JavaScript exécutables des HTML source SHALL être soumis au lint
retenu, sans ignorer globalement les jeux ou les parcours.

#### Scenario: Invalid embedded module
- **WHEN** un script de module HTML contient un défaut interdit
- **THEN** le vrai CLI signale sa position dans le document et échoue
- **AND** les données JSON non exécutables ne sont pas traitées comme du JS

### Requirement: Unified required lint
La commande de lint globale SHALL exécuter les périmètres JS, HTML et TS requis
avec propagation des erreurs, en local comme en CI.

#### Scenario: Failed targeted lint
- **WHEN** un des périmètres échoue
- **THEN** le gate global échoue sans convertir le diagnostic en avertissement ignoré

### Requirement: Honest lint scope
La documentation SHALL distinguer scripts HTML, attributs HTML inline, lint TS,
analyse de types et heuristiques de sécurité.

#### Scenario: Reviewing coverage
- **WHEN** un contributeur consulte la politique
- **THEN** les périmètres exécutés et les limites correspondent aux vrais outils
- **AND** la présence d'un linter n'est pas présentée comme une preuve de sécurité
