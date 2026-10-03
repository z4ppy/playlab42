## ADDED Requirements

### Requirement: Deterministic engine reset
The engine SHALL obtain the reset seed from explicit input rather than wall-clock time.

#### Scenario: Identical reset inputs
- **WHEN** the same state and reset action with the same explicit seed are processed under different clocks
- **THEN** the returned JSON states are identical
- **AND** the input state remains unchanged

#### Scenario: Reset from the interface
- **WHEN** a player requests a new Mastermind game
- **THEN** the interface supplies the new seed
- **AND** the engine does not read the clock

### Requirement: Compatible engine contracts
The system SHALL exercise shared deterministic engine contracts without forcing game-specific state into a universal serialization format.

#### Scenario: Replay after restoration
- **WHEN** legal gameplay is resumed after JSON restoration
- **THEN** subsequent actions and resulting states match uninterrupted gameplay
- **AND** player views preserve the intended hidden information

#### Scenario: Existing consumers
- **WHEN** engine APIs are harmonized
- **THEN** existing interfaces and bots keep their supported behavior
- **AND** incompatible inputs are rejected explicitly

### Requirement: Characterized core refactoring
The system SHALL preserve characterized interface, storage and engine behaviors during responsibility extraction.

#### Scenario: Independent responsibilities
- **WHEN** common loading, keyboard, rendering or validation logic is extracted
- **THEN** existing race, focus, error, migration and replay scenarios still pass
- **AND** complexity measurements describe the actual extracted functions

#### Scenario: Shared random generator
- **WHEN** Triomino uses the shared random generator
- **THEN** reference random sequences and game replays are unchanged
- **AND** imports work in the fabricated browser site

### Requirement: Complete scoped evidence
The system SHALL retain coverage for extracted modules and the educational engine, with dependency and advisory results reported truthfully.

#### Scenario: Extracted source modules
- **WHEN** engine responsibilities move into new source modules
- **THEN** those modules remain within coverage collection
- **AND** existing thresholds are not reduced to make checks pass

#### Scenario: Runtime dependency update
- **WHEN** Three or lil-gui is updated
- **THEN** browser tests exercise the real distributions
- **AND** advisory findings and blocking failures remain distinguishable
