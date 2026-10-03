## ADDED Requirements

### Requirement: Reproducible quality evidence
The system SHALL publish reproducible duplication and complexity evidence using locked local tools and explicit source scopes.

#### Scenario: Successful measurement
- **WHEN** a local or CI quality report is generated
- **THEN** its JSON and Markdown identify source SHA, tool versions, parameters and scope
- **AND** production, test and pedagogical evidence are distinguishable

#### Scenario: Scanner failure
- **WHEN** a scanner fails or returns invalid output
- **THEN** report generation fails explicitly
- **AND** no absent measurement is presented as a successful zero

### Requirement: Characterized responsibility extraction
The system SHALL preserve existing behavior while reducing selected duplication and complexity.

#### Scenario: Shared logic
- **WHEN** a duplicated production responsibility is extracted
- **THEN** its callers preserve outputs, errors, ordering and numeric behavior
- **AND** behavioral tests exercise the shared implementation

#### Scenario: Enforced extraction
- **WHEN** a protected source is split into helpers
- **THEN** the helpers remain instrumented or have explicit subprocess evidence
- **AND** existing gates are not reduced to accept the change
