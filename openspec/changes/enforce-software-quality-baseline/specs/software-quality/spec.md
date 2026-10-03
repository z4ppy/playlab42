## ADDED Requirements

### Requirement: Blocking code quality checks
La CI SHALL refuser les avertissements lint et les constructions interdites
`Function` dynamique et URL JavaScript.

#### Scenario: Lint warning
- **WHEN** une règle produit un avertissement
- **THEN** le check lint échoue sans convertir le diagnostic en succès

### Requirement: Measured critical coverage
La CI SHALL appliquer les seuils versionnés aux composants critiques désignés.

#### Scenario: Coverage regression
- **WHEN** la couverture mesurée descend sous un seuil ciblé
- **THEN** le check de tests avec couverture échoue

### Requirement: Truthful analysis report
Le rapport SHALL distinguer résultats bloquants et consultatifs, erreurs et
analyses non exécutées, sans déduire un succès d'un fichier absent.

#### Scenario: Advisory analysis
- **WHEN** un job consultatif réussit
- **THEN** le rapport ne conclut pas à l'absence de problèmes

#### Scenario: Missing or failed execution
- **WHEN** une analyse échoue, est annulée ou ignorée
- **THEN** cet état apparaît explicitement dans le rapport

### Requirement: Shared software review practice
Les procédures SHALL partager un guide de qualité et distinguer assertions,
preuves observées et validations non exécutées.

#### Scenario: Read only review
- **WHEN** une revue ne permet pas d'exécuter les contrôles
- **THEN** le skill indique les limites et propose les commandes Docker adaptées
- **AND** il ne prétend pas avoir validé le changement ni autoriser sa livraison

### Requirement: Scoped security workflow permissions
Le workflow de sécurité SHALL limiter les droits d'écriture aux jobs qui les utilisent.

#### Scenario: Analysis execution
- **WHEN** les jobs de scan s'exécutent
- **THEN** leurs permissions par défaut sont en lecture seule
- **AND** seuls les jobs SARIF et commentaire PR reçoivent leurs droits d'écriture dédiés
