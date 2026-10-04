## ADDED Requirements

### Requirement: Visible TicTacToe Grid
The TicTacToe board SHALL expose visible separators with a contrast ratio of at least 3:1 against unoccupied cells in explicit and system light and dark themes.

#### Scenario: Theme and viewport changes
- **WHEN** an empty TicTacToe board is displayed on desktop or mobile with an explicit or system light or dark theme
- **THEN** its separators meet the contrast threshold without changing cell dimensions, keyboard navigation or game rules.
