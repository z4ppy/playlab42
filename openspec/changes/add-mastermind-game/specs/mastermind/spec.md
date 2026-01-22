# Mastermind Game Specification

## Purpose

This specification defines the rules, state, and behavior of the Mastermind game implementation in Playlab42. Mastermind is a code-breaking game where a player (decoder) attempts to guess a secret color combination within a limited number of attempts, receiving feedback after each guess.

## Overview

Mastermind is a single-player deduction game against the computer:
- **Coder** (computer): Generates a secret 4-color code
- **Decoder** (human player): Attempts to guess the code in ≤10 tries
- **Feedback**: After each guess, the decoder receives hints (black/white pegs)

The game exemplifies:
- **Algorithmic thinking**: Systematic elimination of possibilities
- **Determinism**: Seeded random generation for replay
- **Bot strategies**: From random guessing to intelligent elimination

**Related specs**: [Game Engine](../game-engine/spec.md), [Bot](../bot/spec.md), [Seeded Random](../seeded-random/spec.md)

## ADDED Requirements

### Requirement: Game Initialization

The system SHALL generate a secret code at game start using a seeded random generator.

#### Scenario: New game with seed
- **GIVEN** a player starts a new Mastermind game
- **WHEN** the game is initialized with a seed value
- **THEN** a secret code of 4 colors is generated deterministically
- **AND** the code may contain duplicate colors
- **AND** the code is hidden from the player's view

#### Scenario: Deterministic code generation
- **GIVEN** two games initialized with the same seed
- **WHEN** both games are started
- **THEN** both games have identical secret codes

### Requirement: Valid Colors

The system SHALL use exactly 6 colors for the game.

#### Scenario: Color palette
- **WHEN** a player views the available colors
- **THEN** the colors are: Red (R), Blue (B), Green (G), Yellow (Y), Orange (O), Violet (V)

#### Scenario: Code composition
- **WHEN** a secret code is generated
- **THEN** each of the 4 positions contains one of the 6 valid colors
- **AND** colors may repeat (e.g., [R,R,R,R] is valid)

### Requirement: Attempt Submission

The system SHALL allow the player to submit guesses of 4 colors.

#### Scenario: Valid attempt
- **GIVEN** the game is not over
- **WHEN** a player submits a 4-color combination
- **THEN** the attempt is recorded
- **AND** feedback is calculated and returned
- **AND** the attempt count increments

#### Scenario: Invalid attempt (wrong length)
- **GIVEN** the game is not over
- **WHEN** a player attempts to submit fewer or more than 4 colors
- **THEN** the action is rejected
- **AND** the game state is unchanged

#### Scenario: Attempt after game over
- **GIVEN** the game is over (won or lost)
- **WHEN** a player attempts to submit a guess
- **THEN** the action is rejected

### Requirement: Feedback Calculation

The system SHALL provide accurate feedback for each attempt using black and white pegs.

#### Scenario: Black peg (exact match)
- **GIVEN** a secret code and a guess
- **WHEN** a color in the guess matches the secret code's color AND position
- **THEN** one black peg is awarded

#### Scenario: White peg (color match, wrong position)
- **GIVEN** a secret code and a guess
- **WHEN** a color in the guess exists in the secret code but in a different position
- **THEN** one white peg is awarded

#### Scenario: No match
- **GIVEN** a secret code and a guess
- **WHEN** a color in the guess does not appear in the secret code
- **THEN** no peg is awarded for that color

#### Scenario: No double counting
- **GIVEN** a secret code [R,B,G,Y] and a guess [R,R,O,O]
- **WHEN** feedback is calculated
- **THEN** only one black peg is awarded (for the first R)
- **AND** no white pegs are awarded
- **AND** no peg is awarded for the second R (already counted)

#### Scenario: All correct
- **GIVEN** a secret code [R,B,G,Y] and a guess [R,B,G,Y]
- **WHEN** feedback is calculated
- **THEN** 4 black pegs are awarded
- **AND** 0 white pegs are awarded

#### Scenario: All wrong
- **GIVEN** a secret code [R,B,G,Y] and a guess [O,V,O,V]
- **WHEN** feedback is calculated
- **THEN** 0 black pegs are awarded
- **AND** 0 white pegs are awarded

#### Scenario: Duplicates in code
- **GIVEN** a secret code [R,R,B,B] and a guess [B,B,R,R]
- **WHEN** feedback is calculated
- **THEN** 0 black pegs are awarded
- **AND** 4 white pegs are awarded

#### Scenario: Mixed feedback
- **GIVEN** a secret code [R,B,G,Y] and a guess [R,Y,B,G]
- **WHEN** feedback is calculated
- **THEN** 1 black peg is awarded (R in position 0)
- **AND** 3 white pegs are awarded (Y, B, G in wrong positions)

#### Scenario: Duplicate handling
- **GIVEN** a secret code [R,B,B,Y] and a guess [B,B,B,O]
- **WHEN** feedback is calculated
- **THEN** 1 black peg is awarded (B in position 1)
- **AND** 1 white peg is awarded (B in position 2, matching position 0 of secret)
- **AND** the third B in the guess gets no peg (only 2 B's in secret)

### Requirement: Victory Condition

The system SHALL detect when the player has won the game.

#### Scenario: Correct guess
- **GIVEN** the secret code is [R,B,G,Y]
- **WHEN** the player submits [R,B,G,Y]
- **THEN** the game status becomes 'won'
- **AND** the feedback shows 4 black pegs
- **AND** the player is declared winner
- **AND** no further attempts are allowed

### Requirement: Defeat Condition

The system SHALL detect when the player has exhausted all attempts.

#### Scenario: 10 failed attempts
- **GIVEN** the player has made 9 incorrect guesses
- **WHEN** the player submits a 10th incorrect guess
- **THEN** the game status becomes 'lost'
- **AND** no further attempts are allowed
- **AND** the secret code is revealed to the player

#### Scenario: Still playing
- **GIVEN** the player has made fewer than 10 attempts
- **WHEN** the current attempt is incorrect
- **THEN** the game continues
- **AND** the player can submit another attempt

### Requirement: Attempt History

The system SHALL maintain a complete history of all attempts and their feedback.

#### Scenario: View history
- **GIVEN** a player has made several attempts
- **WHEN** the player views the game state
- **THEN** all previous attempts are visible
- **AND** each attempt shows its 4-color combination
- **AND** each attempt shows its feedback (black and white pegs)
- **AND** attempts are ordered chronologically

### Requirement: Player View (Fog of War)

The system SHALL hide the secret code from the player during the game.

#### Scenario: During gameplay
- **GIVEN** the game is in progress
- **WHEN** the player requests their view
- **THEN** the secret code is null or hidden
- **AND** all other game state is visible (attempts, feedback, game status)

#### Scenario: After game over
- **GIVEN** the game has ended (won or lost)
- **WHEN** the player requests their view
- **THEN** the secret code is revealed
- **AND** the player can see what they were trying to guess

### Requirement: Game Reset

The system SHALL allow starting a new game with a new secret code.

#### Scenario: Reset game
- **GIVEN** a game is in progress or finished
- **WHEN** the player chooses to reset
- **THEN** a new game is initialized with a new seed
- **AND** a new secret code is generated
- **AND** attempt history is cleared
- **AND** the game status is 'playing'

### Requirement: Single Player Only

The system SHALL support exactly one human player per game as the decoder.

#### Scenario: Player configuration
- **GIVEN** a Mastermind game is being configured
- **WHEN** the number of players is set
- **THEN** only 1 player is allowed
- **AND** the player is always the decoder (guessing)
- **AND** the coder is always the computer (generates code and feedbacks)

#### Scenario: Fixed roles
- **GIVEN** a new game starts
- **WHEN** the game initializes
- **THEN** the computer generates the secret code
- **AND** the human makes all guessing attempts
- **AND** the computer calculates and displays feedbacks automatically

### Requirement: State Serialization

The system SHALL maintain fully JSON-serializable game state.

#### Scenario: Save state
- **GIVEN** a game in any state (playing, won, lost)
- **WHEN** `JSON.stringify(state)` is called
- **THEN** serialization succeeds without errors

#### Scenario: Restore state
- **GIVEN** a serialized game state
- **WHEN** `JSON.parse(serializedState)` is called
- **THEN** the game can continue from that exact state
- **AND** all history is preserved

### Requirement: Replay Support

The system SHALL support deterministic replay of games.

#### Scenario: Replay game
- **GIVEN** a recorded game with seed and action sequence
- **WHEN** the game is replayed with the same seed and actions
- **THEN** the secret code is identical
- **AND** all feedbacks are identical
- **AND** the final outcome is identical

## Game Constants

```typescript
const COLORS = ['R', 'B', 'G', 'Y', 'O', 'V'] as const;
const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 10;
```

## State Definition

```typescript
interface MastermindState {
  secretCode: Color[];           // [4] - Hidden during gameplay
  attempts: Attempt[];           // [0-10] - History of guesses
  gameOver: boolean;             // Game ended?
  winner: string | null;         // playerId if won, null if lost
  maxAttempts: number;           // Always 10
  rngState: number;              // For deterministic replay
  playerId: string;              // Single player ID
}

interface Attempt {
  code: Color[];                 // [4] - The guess
  feedback: Feedback;            // Result
}

interface Feedback {
  black: number;                 // 0-4: Correct position + color
  white: number;                 // 0-4: Correct color, wrong position
}

type Color = 'R' | 'B' | 'G' | 'Y' | 'O' | 'V';
```

## Action Definition

```typescript
type MastermindAction = 
  | { type: 'submit'; code: Color[] }  // Submit a 4-color guess
  | { type: 'reset' };                 // Start new game
```

## Feedback Algorithm

The feedback calculation follows this algorithm:

1. **Black pegs**: Count exact matches (same color, same position)
2. **Color matches**: For each color, count `min(occurrences_in_secret, occurrences_in_guess)`
3. **White pegs**: Total color matches minus black pegs

Example implementation:
```typescript
function calculateFeedback(secret: Color[], guess: Color[]): Feedback {
  // Count exact matches
  let black = 0;
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (secret[i] === guess[i]) black++;
  }
  
  // Count color matches
  const secretCounts = countColors(secret);
  const guessCounts = countColors(guess);
  let totalMatches = 0;
  
  for (const color of COLORS) {
    totalMatches += Math.min(
      secretCounts[color] || 0,
      guessCounts[color] || 0
    );
  }
  
  // White pegs = color matches minus exact matches
  const white = totalMatches - black;
  
  return { black, white };
}
```

## Integration with Game Engine

Mastermind implements the GameEngine interface:

```typescript
class MastermindEngine implements GameEngine<
  MastermindState,
  MastermindAction,
  MastermindState,  // PlayerView same as State (except secretCode hidden)
  MastermindConfig
> {
  init(config: MastermindConfig): MastermindState;
  applyAction(state: MastermindState, action: MastermindAction, playerId: string): MastermindState;
  isValidAction(state: MastermindState, action: MastermindAction, playerId: string): boolean;
  getValidActions(state: MastermindState, playerId: string): MastermindAction[];
  getPlayerView(state: MastermindState, playerId: string): MastermindState;
}
```

## Bot Interface

Mastermind bots implement the Bot interface:

```typescript
interface MastermindBot implements Bot<MastermindState, MastermindAction> {
  readonly name: string;
  readonly description: string;
  readonly difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  chooseAction(
    view: MastermindState,
    validActions: MastermindAction[],
    rng: SeededRandom
  ): MastermindAction;
}
```

## Non-Functional Requirements

### Performance
- Feedback calculation: O(1) (code length is constant: 4)
- Smart bot elimination: O(n) where n ≤ 1296 (all possible codes)
- UI rendering: < 16ms per frame (smooth animations)

### Usability
- Color-blind friendly palette (distinct hues and labels)
- Touch-friendly controls (minimum 44×44px tap targets)
- Clear visual feedback for current state
- Intuitive color selection mechanism

### Accessibility
- Keyboard navigation support
- Screen reader compatible (ARIA labels)
- High contrast mode support
- Color names visible (not just colors)

## Future Extensions

The following are out of scope for the initial implementation but may be added later:

- **SuperMastermind**: 5 pegs, 8 colors
- **Expert Bot**: Knuth's minimax algorithm
- **Tutorial Mode**: Show remaining possible codes
- **Statistics**: Track win rate, average attempts
- **Multiplayer**: Human vs human (role reversal)
- **Timed Mode**: Penalty for slow guesses

## References

- [Mastermind (Wikipedia)](https://en.wikipedia.org/wiki/Mastermind_(board_game))
- Knuth, D. E. (1977). "The Computer as Master Mind". *Journal of Recreational Mathematics*, 9(1), 1-6. (For future bot implementations)
- [Game Engine Specification](../game-engine/spec.md)
- [Seeded Random Specification](../seeded-random/spec.md)
