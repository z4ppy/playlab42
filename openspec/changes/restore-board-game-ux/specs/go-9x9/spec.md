## MODIFIED Requirements

### Requirement: Board and Actions (Go 9x9)
The system SHALL provide a 9x9 Go game with legal actions place/pass/resign for two players and SHALL suspend play during an explicitly enabled manual scoring review.

#### Scenario: Board initialization
- **WHEN** a Go 9x9 game is started
- **THEN** a 9x9 empty board is created, Black plays first, and komi is set to 6.5.

#### Scenario: Legal placement
- **WHEN** a player places a stone on an empty intersection
- **THEN** the move is accepted only if it is not suicide (unless it captures) and respects ko simple.

#### Scenario: Pass and resign
- **WHEN** a player chooses `pass`
- **THEN** the turn ends and `passesInARow` increments; two consecutive passes enter manual review in the standalone page, or end the game with automatic scoring for default engine callers.
- **WHEN** a player chooses `resign`
- **THEN** the game ends immediately with the opponent as winner.

### Requirement: Scoring (Chinese, Komi 6.5)
The system SHALL score using Chinese rules with komi 6.5 awarded to White and SHALL require explicit confirmation after manual review in the standalone page.

#### Scenario: Territory scoring
- **WHEN** scoring is confirmed after double pass
- **THEN** the final score is surviving stones on board plus controlled empty territory per color plus komi for White.

#### Scenario: Winner determination
- **WHEN** scoring is computed
- **THEN** the winner is the color with the higher score; a tie yields no winner.

#### Scenario: Reversible group marking
- **WHEN** the user activates a stone during manual review
- **THEN** its whole connected same-color group toggles between dead and alive, with visible and accessible status, without modifying the played board or captures.

#### Scenario: Human review against a bot
- **WHEN** two passes occur in solo play
- **THEN** the bot stops and the human can mark either color and confirm the score even when the next player is the bot.

#### Scenario: Disagreement and resumption
- **WHEN** the user resumes play instead of confirming
- **THEN** dead-group markings and consecutive passes are cleared, the board and captures are preserved, and the next player resumes normally.

#### Scenario: Serializable review
- **WHEN** a manual review state is serialized and restored as JSON
- **THEN** group marking and confirmation produce the same score without mutating the restored input.
