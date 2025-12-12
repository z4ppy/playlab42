# Spec Delta: Catalogue - Checkers Game

## ADDED Requirements

### Requirement: Checkers Game Entry

The system SHALL include a checkers game in the game catalogue.

#### Scenario: Game metadata
- **GIVEN** the catalogue is loaded
- **WHEN** the checkers game entry is retrieved
- **THEN** it has id "checkers"
- **AND** it has name "Dames" or "Checkers"
- **AND** it has a French description
- **AND** it specifies 2 players (min and max)
- **AND** it is tagged as "strategy" and "classic"

#### Scenario: Bot configuration
- **GIVEN** the checkers game entry
- **WHEN** bot configuration is accessed
- **THEN** it lists at least 2 available bots
- **AND** it includes a "Random" bot (easy difficulty)
- **AND** it includes a "Smart" bot (medium or hard difficulty)
- **AND** each bot specifies its file path

#### Scenario: Game asset paths
- **GIVEN** the checkers game entry
- **WHEN** the game is loaded
- **THEN** it points to "games/checkers/index.html"
- **AND** it points to "games/checkers/engine.js"
- **AND** all referenced files exist

## MODIFIED Requirements

None - this is an additive catalogue entry.

## REMOVED Requirements

None - existing games remain unchanged.
