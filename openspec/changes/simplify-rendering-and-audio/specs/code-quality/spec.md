## ADDED Requirements

### Requirement: Characterized presentation extraction
The system SHALL preserve board and musical presentation behavior during scoped responsibility extraction.

#### Scenario: Board interactions
- **WHEN** a characterized Dames or Triomino state is rendered and interacted with
- **THEN** DOM content, ordering, selection and legal actions retain their existing behavior
- **AND** extracted sources remain measured and tested

#### Scenario: Musical panel lifecycle
- **WHEN** a panel is shown, hidden or synchronized
- **THEN** its controls, focus and panel-specific effects retain their existing order
- **AND** shared logic does not remove panel-specific lifecycle hooks

### Requirement: Characterized audio responsibility extraction
The system SHALL preserve audio construction, parameter and disposal contracts while simplifying their implementation, except for the reproduced live MetalSynth harmonicity defect.

#### Scenario: Audio settings and presets
- **WHEN** characterized settings or presets are applied
- **THEN** constructor options, graph connections and parameter calls match the prior behavior
- **AND** supported changes retain their resource disposal and activation behavior

#### Scenario: Live metal harmonicity
- **WHEN** the harmonicity parameter of an active MetalSynth is changed
- **THEN** the real Tone node reflects the requested value without synth recreation
- **AND** the unit boundary double models Tone's numeric accessor rather than a signal

#### Scenario: Truthful audio evidence
- **WHEN** audio quality evidence is published
- **THEN** unit boundary doubles and real browser evidence are identified separately
- **AND** neither is presented as human listening or microphone hardware validation
