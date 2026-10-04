## ADDED Requirements

### Requirement: Conservative impact selection
The CI SHALL classify the changes against the tested merge commit and SHALL
execute all controls when impact cannot be established.

#### Scenario: Documentary PR
- **WHEN** only known documentary Markdown files change
- **THEN** documentary contracts, the new build, archive verification, guide
  interactions and cross-engine smokes execute
- **AND** inapplicable static controls have an explicit successful gate without
  pretending their analysis executed

#### Scenario: Executable documentation or shared inputs
- **WHEN** HTML slides, shared code, dependencies or CI configuration change
- **THEN** the applicable checks execute and shared inputs require the full path

#### Scenario: Unknown or unavailable diff
- **WHEN** a changed path is unknown or the Git diff is unavailable
- **THEN** CI selects the full path and reports the reason

### Requirement: Stable blocking gates
The CI SHALL preserve the nine required check names and SHALL reject failures,
cancelled jobs, skipped jobs and missing results before publication.

#### Scenario: Upstream failure
- **WHEN** a required upstream job does not succeed
- **THEN** Build or the final aggregate fails explicitly
- **AND** no successful skipped gate substitutes for a required execution

### Requirement: Verified reuse
The CI SHALL reuse only original successful executions from the same PR after
independently comparing Git inputs, workflow, Node and runner image.

#### Scenario: Documentary rebase
- **WHEN** a previous successful run has identical inputs for a control
- **THEN** that control may reuse its original proof with run and commit provenance
- **AND** documentary browser checks and the new archive are still verified

#### Scenario: Invalid proof or changed inputs
- **WHEN** a proof is missing, invalid, from another PR, chained, or its inputs differ
- **THEN** the control executes again and no invalid proof produces success

#### Scenario: Publication, manual run or evolving audit
- **WHEN** CI validates main or a manual launch, or runs a vulnerability/secret audit
- **THEN** those controls execute without reuse
