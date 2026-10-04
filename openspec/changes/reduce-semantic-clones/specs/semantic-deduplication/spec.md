## ADDED Requirements

### Requirement: Behavior-preserving semantic consolidation
The system SHALL consolidate duplicate production code only when the observable contracts are identical.

#### Scenario: Style consolidation
- **WHEN** duplicated CSS declarations are shared or grouped
- **THEN** computed styles preserve theme, cascade, responsive and interaction contracts
- **AND** required standalone markup and conditional behavior remain available

#### Scenario: Algorithm consolidation
- **WHEN** duplicated JavaScript or CLI logic is extracted
- **THEN** characterized public APIs, ordering, seeded results, errors and output shapes are preserved
- **AND** extracted helpers remain instrumented and protected

### Requirement: Comparable absolute clone evidence
The system SHALL measure clone reduction without weakening quality policies or hiding sources.

#### Scenario: Measured reduction
- **WHEN** the integrated change is evaluated
- **THEN** clones, duplicated lines and duplicated tokens are compared with the native merged-main baseline
- **AND** tools, scanner parameters and exclusions remain unchanged
- **AND** versioned budgets are tightened only after verified measurement

#### Scenario: Intentional similarity
- **WHEN** similar tokens represent distinct contracts or mandatory markup
- **THEN** the source remains explicit and the residual clone is documented
- **AND** formatting or an unnecessary abstraction is not used to disguise it

#### Scenario: Truthful delivery
- **WHEN** completion evidence is reported
- **THEN** the tested head, native reports and behavior checks are identified
- **AND** a passing pull request is not reported as an authorized publication or archive
