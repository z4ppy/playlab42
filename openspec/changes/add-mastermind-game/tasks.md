# Tasks: Add Mastermind Game

**Change ID**: `add-mastermind-game`

## Implementation Checklist

### Phase 1: Core Engine (Sequential)

- [ ] **Task 1.1**: Create `games/mastermind/` directory structure
  - Create folder `games/mastermind/`
  - **Validation**: Folder exists

- [ ] **Task 1.2**: Implement game engine (`games/mastermind/engine.js`)
  - Define TypeScript types (State, Action, Config, Feedback)
  - Implement `MastermindEngine` class with interface methods:
    - `init(config)` - Generate secret code using SeededRandom
    - `applyAction(state, action, playerId)` - Process submit/reset
    - `isValidAction(state, action, playerId)` - Validate actions
    - `getValidActions(state, playerId)` - Return possible actions
    - `getPlayerView(state, playerId)` - Hide secret code
  - Implement `calculateFeedback(secretCode, attempt)` helper
  - **Validation**: All methods defined, no syntax errors

- [ ] **Task 1.3**: Write unit tests (`games/mastermind/engine.test.js`)
  - Test feedback calculation with edge cases:
    - All correct: [R,B,G,Y] vs [R,B,G,Y] → {black:4, white:0}
    - All wrong: [R,B,G,Y] vs [O,V,O,V] → {black:0, white:0}
    - Duplicates: [R,R,B,B] vs [B,B,R,R] → {black:0, white:4}
    - Mixed: [R,B,G,Y] vs [R,Y,B,G] → {black:1, white:3}
  - Test game flow (init → attempts → victory/defeat)
  - Test determinism (same seed → same secret code)
  - Test player view (secret code hidden)
  - **Validation**: `npm test -- engine.test.js` passes, coverage > 90%

### Phase 2: Interface (Sequential after Phase 1)

- [ ] **Task 2.1**: Create HTML structure (`games/mastermind/index.html`)
  - Basic layout: title, game board, color palette, submit button
  - Grid for attempts (10 rows × 4 pegs + feedback)
  - Current attempt builder
  - Game over message area
  - **Validation**: File opens in browser, layout visible

- [ ] **Task 2.2**: Implement game UI logic
  - Initialize engine with seed
  - Color selection (click to cycle through colors)
  - Submit attempt (validate 4 colors selected)
  - Display feedback (black/white pegs)
  - Show/hide secret code on game over
  - Reset button (new game with new seed)
  - **Validation**: Manual playthrough completes successfully

- [ ] **Task 2.3**: Add styling
  - Color-coded pegs (visual circles)
  - Feedback display (small black/white indicators)
  - Responsive layout (mobile-friendly)
  - Game over animations
  - **Validation**: UI is intuitive and visually clear

### Phase 3: Integration

- [ ] **Task 3.1**: Create game manifest (`games/mastermind/game.json`)
  - Set id="mastermind", name="Mastermind"
  - Configure players: min=1, max=1 (single-player only)
  - Set type="turn-based"
  - Add tags: ["logic", "deduction", "classic", "1-player"]
  - **Note**: No bots configuration needed (human always decoder)
  - **Validation**: JSON is valid, matches schema

- [ ] **Task 3.2**: Create thumbnail (`games/mastermind/thumb.png`)
  - Design or find appropriate image (colored pegs)
  - Size: 400×300px
  - **Validation**: Image displays correctly in catalogue

- [ ] **Task 3.3**: Build and verify catalogue
  - Run `npm run build:catalogue` (or equivalent)
  - Verify Mastermind appears in catalogue
  - Click through to game from catalogue
  - **Validation**: Game is playable from portal

### Phase 4: Documentation & Polish

- [x] **Task 4.1**: Add code documentation
  - JSDoc comments on all public methods
  - Inline comments explaining feedback algorithm
  - README in `games/mastermind/` explaining rules and clarifying roles (human=decoder, computer=coder)
  - **Validation**: Code is self-documenting

- [x] **Task 4.2**: Integration testing
  - Test full game flow in browser
  - Test with different seeds
  - Test replay consistency
  - **Validation**: No console errors, smooth gameplay

- [x] **Task 4.3**: Update CHANGELOG
  - Add entry for new Mastermind game
  - Mention key features (human decoder, determinism)
  - **Validation**: CHANGELOG.md updated

## Dependencies

- **Task 1.2** depends on: Task 1.1
- **Task 1.3** depends on: Task 1.2
- **Task 2.1** depends on: Task 1.2 (needs engine API)
- **Task 2.2** depends on: Task 2.1
- **Task 2.3** depends on: Task 2.2
- **Task 3.1** depends on: Task 1.2
- **Task 3.3** depends on: Task 3.1, Task 3.2
- **Task 4.2** depends on: All previous phases
- **Task 4.3** depends on: Task 4.2

## Parallel Work

None - All phases are sequential in this simplified version.

## Estimated Effort

- Phase 1: 3-4 hours (engine + tests)
- Phase 2: 2-3 hours (UI)
- Phase 3: 1 hour (integration)
- Phase 4: 1 hour (docs + polish)

**Total**: ~7-11 hours for a complete implementation (simplified without bots)

## Notes

- Use `lib/seeded-random.js` for all randomness (computer code generation)
- Follow TypeScript strict mode conventions
- Ensure all code is isomorphic (no browser-specific APIs in engine)
- Write tests first for critical algorithms (feedback calculation)
- Keep feedback algorithm simple and well-commented (it's the trickiest part)
- **No bots in v1**: Human is always the decoder, computer always generates codes and feedbacks
