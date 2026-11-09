## ADDED Requirements

### Requirement: Triomino Tile Uniqueness

The system SHALL generate exactly 56 unique Triomino tiles.

#### Scenario: Full tile set generation
- **WHEN** a Triomino game is initialized
- **THEN** exactly 56 tiles are created, each with values `(a, b, c)` where `0 ? a ? b ? c ? 5`
- **AND** no two tiles are identical after normalization (canonical rotation)

---

### Requirement: Triomino Tile Distribution

The system SHALL distribute tiles according to the number of players.

#### Scenario: 2-player game
- **WHEN** a game starts with 2 players
- **THEN** each player receives 9 tiles on their rack

#### Scenario: 3 or 4-player game
- **WHEN** a game starts with 3 or 4 players
- **THEN** each player receives 7 tiles on their rack

#### Scenario: Draw pile
- **WHEN** tiles are distributed
- **THEN** the remaining tiles form the draw pile

---

### Requirement: Triomino First Player Determination

The system SHALL determine the starting player fairly.

#### Scenario: First player selection
- **WHEN** the game starts
- **THEN** each player draws a tile
- **AND** the player with the highest sum of the 3 values on their tile goes first
- **AND** in case of a tie, players draw again
- **AND** the drawn tiles are returned to the draw pile before play begins

---

### Requirement: Triomino First Placement

The system SHALL handle the first tile placement.

#### Scenario: First tile placed
- **WHEN** the first player places their first tile
- **THEN** it is placed at the center of the board
- **AND** the player scores the sum of the 3 values on the tile

---

### Requirement: Triomino Valid Placement

The system SHALL enforce tile placement rules.

#### Scenario: Legal placement
- **WHEN** a player places a tile adjacent to an existing tile
- **THEN** the two values on the shared edge must match the corresponding values of the adjacent tile
- **AND** the placement is accepted

#### Scenario: Illegal placement — mismatched values
- **WHEN** a player attempts to place a tile where the shared-edge values do not match
- **THEN** the placement is rejected

#### Scenario: One tile per turn
- **WHEN** a player places a tile
- **THEN** their turn ends immediately (no second placement allowed)

---

### Requirement: Triomino Base Score

The system SHALL calculate the base score for each tile placed.

#### Scenario: Score on placement
- **WHEN** a player places a tile
- **THEN** their score increases by the sum of the 3 values on the placed tile

---

### Requirement: Triomino Bonus — Bridge

The system SHALL award a bridge bonus.

#### Scenario: Bridge formed
- **WHEN** a player places a tile that forms a bridge (the tile has neighbors on exactly 2 non-adjacent sides, leaving a gap)
- **THEN** the player receives +40 bonus points

---

### Requirement: Triomino Bonus — Hexagon

The system SHALL award a hexagon bonus.

#### Scenario: Hexagon completed
- **WHEN** a player places a tile that completes a hexagon (6 triangles forming a closed ring around an empty center)
- **THEN** the player receives +50 bonus points

---

### Requirement: Triomino Bonus — Double Hexagon

The system SHALL award a double hexagon bonus.

#### Scenario: Double hexagon completed
- **WHEN** a player places a tile that completes a double hexagon (two adjacent hexagons sharing one edge)
- **THEN** the player receives +60 bonus points

---

### Requirement: Triomino Draw Rules

The system SHALL enforce draw mechanics.

#### Scenario: Drawing a tile
- **WHEN** a player cannot or chooses not to place a tile
- **THEN** they draw one tile from the pile
- **AND** they lose 5 points
- **AND** they MAY place the drawn tile

#### Scenario: Drawing again
- **WHEN** a player drew a tile but still cannot or chooses not to play
- **THEN** they draw a second tile and lose another 5 points

#### Scenario: Maximum draws per turn
- **WHEN** a player draws a third tile in the same turn
- **THEN** they lose 5 points for the draw plus an extra 10 points (total: -25 for the turn)
- **AND** they CANNOT draw further this turn

#### Scenario: Triple draw penalty total
- **WHEN** a player draws 3 tiles in one turn
- **THEN** their total penalty is -25 points (3×(-5) + (-10))

#### Scenario: Empty draw pile
- **WHEN** a player must draw and the pile is empty
- **THEN** they pass their turn with no score change

---

### Requirement: Triomino End of Game — Last Tile

The system SHALL handle the end-of-game bonus.

#### Scenario: Player empties their rack
- **WHEN** a player places their last tile
- **THEN** they receive +25 bonus points
- **AND** they add the sum of all tiles remaining on opponents' racks to their score
- **AND** the game ends

---

### Requirement: Triomino End of Game — Blocked

The system SHALL handle blocked games.

#### Scenario: Game is blocked
- **WHEN** no player can place any tile
- **THEN** the game ends
- **AND** each player subtracts the sum of their remaining rack tiles from their score
- **AND** no player receives the +25 bonus

---

### Requirement: Triomino Winner

The system SHALL determine the winner.

#### Scenario: Highest score wins
- **WHEN** the game ends
- **THEN** the player with the highest score is declared the winner

---

### Requirement: Triomino Game Variants

The system SHALL support optional rule variants.

#### Scenario: Target score mode
- **WHEN** a target score is configured (e.g., 400 points)
- **THEN** the game continues across multiple rounds until a player reaches that score

#### Scenario: Simplified scoring mode
- **WHEN** simplified mode is enabled
- **THEN** placing a tile = 1 pt, bridge = 1 pt, hexagon = 1 pt, double hexagon = 2 pts, last tile = 5 pts

#### Scenario: Kids mode
- **WHEN** kids mode is enabled
- **THEN** no points are counted
- **AND** the winner is the first player to place all their tiles

---

### Requirement: Triomino Fog of War

The system SHALL hide opponents' tile values.

#### Scenario: Player view
- **WHEN** a player requests their game view
- **THEN** they see their own tiles with values
- **AND** they see only the count (not values) of opponents' remaining tiles
