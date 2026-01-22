# Add Mastermind Game - OpenSpec Change

**Status**: ✅ Ready for Review  
**Change ID**: `add-mastermind-game`  
**Created**: 2026-01-22

## 📋 Summary

This change adds a complete Mastermind game implementation to Playlab42, including:
- Isomorphic game engine with official rules
- Intuitive web interface
- 2 AI bots (Random & Smart strategies)
- Full test coverage
- Deterministic replay support

## 🎯 Quick Start

### Review Documents (in order)
1. **[proposal.md](./proposal.md)** - Why we're doing this, what's in/out of scope
2. **[design.md](./design.md)** - Technical decisions and architecture
3. **[tasks.md](./tasks.md)** - Implementation checklist (15 tasks, ~10-15h)
4. **[specs/mastermind/spec.md](./specs/mastermind/spec.md)** - Detailed requirements with scenarios

### Key Features
- ✅ Single-player (human decoder vs computer coder)
- ✅ 6 colors, 4 pegs, 10 attempts max
- ✅ Accurate feedback (black/white pegs)
- ✅ Seeded random for determinism
- ✅ Bot integration (Random + Smart elimination algorithm)
- ✅ Full test coverage (engine + bots)

## 📊 Mastermind Rules (Quick Reference)

**Goal**: Guess the secret 4-color code in ≤10 attempts

**Colors**: 🔴 Red, 🔵 Blue, 🟢 Green, 🟡 Yellow, 🟠 Orange, 🟣 Violet

**Feedback**:
- ⚫ Black peg = Correct color + correct position
- ⚪ White peg = Correct color + wrong position
- Nothing = Color not in code

**Example**:
```
Secret: [R, B, G, Y]
Guess:  [R, Y, B, O]
Result: ⚫ ⚪ ⚪ (1 black for R, 2 whites for Y and B)
```

## 📁 Files to Create

```
games/mastermind/
├── game.json              # Manifest (players, tags, NO bots in v1)
├── engine.js              # Isomorphic game engine
├── engine.test.js         # Unit tests (20+ scenarios)
├── index.html             # Player interface (roles clearly indicated)
└── thumb.png              # Catalogue thumbnail
```

## 🔍 Impact Analysis

### Modified Specs
- **None** - Mastermind fits existing GameEngine interface

### New Specs
- **mastermind** - Game-specific rules and requirements

### Dependencies
- ✅ `lib/seeded-random.js` - For deterministic code generation by computer
- ✅ `lib/gamekit.js` - UI utilities (optional)

### No Dependencies
- Bot interface not used in v1 (reserved for v2+)

## ✅ Validation Checklist

Before marking as complete:

- [x] `proposal.md` - Context, objectives, scope defined
- [x] `tasks.md` - Implementation steps with dependencies
- [x] `design.md` - Technical decisions documented
- [x] `specs/mastermind/spec.md` - Requirements with scenarios
- [ ] No conflicts with existing specs
- [ ] All requirements have ≥1 scenario
- [ ] All scenarios follow GIVEN/WHEN/THEN format
- [ ] Dependencies clearly identified

## 🚀 Next Steps

### For Reviewers
1. Read `proposal.md` - Approve scope and objectives
2. Review `design.md` - Challenge technical decisions if needed
3. Check `specs/mastermind/spec.md` - Verify requirements are complete
4. Approve or request changes

### For Implementers (after approval)
1. Follow `tasks.md` sequentially
2. Check off tasks as completed
3. Run tests after each phase
4. Update `design.md` if implementation deviates
5. When done, run: `npm run build:catalogue`

## 📚 References

- **Official Rules**: [Mastermind Wikipedia](https://en.wikipedia.org/wiki/Mastermind_(board_game))
- **Knuth's Algorithm**: [5-guess algorithm paper (1977)](https://en.wikipedia.org/wiki/Mastermind_(board_game)#Worst_case:_Five-guess_algorithm)
- **Project Conventions**: `openspec/project.md`
- **Related Specs**:
  - `openspec/specs/game-engine/spec.md`
  - `openspec/specs/bot/spec.md`
  - `openspec/specs/manifests/spec.md`

## 🎓 Educational Value

This game is excellent for teaching:
- **Deduction algorithms** - Systematic elimination of possibilities (mental reasoning)
- **Deterministic systems** - Seeded randomness and replay
- **Feedback calculations** - Non-trivial counting algorithm with edge cases
- **State management** - Immutable history tracking
- **Asymmetric roles** - Understanding coder vs decoder dynamics

Perfect for AI/ML workshops where participants can:
1. Play to understand the game mechanics
2. Analyze the feedback algorithm (edge cases with duplicates)
3. **v2+**: Implement their own bot strategies
4. **v2+**: Benchmark bot performance
5. **v2+**: Visualize decision trees

---

**Ready to proceed?** Review the documents above and approve to move to implementation phase.
