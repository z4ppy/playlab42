# Change: Extend Hash Routing to Games and Tools

**Change ID:** `extend-hash-routing-games-tools`  
**Status:** 🚀 Ready for Review  
**Date:** 2025-01-14

---

## 📋 Summary

Extend the existing hash router (already used by parcours) to support **direct shareable links to games and tools**.

### Problem

Currently:
- ✅ Épics (parcours) support deeplinks: `#/parcours/epic-id/slide-id`
- ❌ Games/tools require clicking through the catalog
- ❌ Can't share direct links to a specific game
- ❌ Refreshing a page returns to catalog instead of reloading the game

### Solution

Add hash-based routing for games and tools:
- `#/games/:id` → loads game directly
- `#/tools/:id` → loads tool directly
- Refresh preserves context
- URLs are shareable

---

## 📂 Contents

| File | Purpose |
|------|---------|
| [proposal.md](./proposal.md) | Business case and scope |
| [design.md](./design.md) | Architectural decisions and rationale |
| [tasks.md](./tasks.md) | Implementation tasks (5 phases) |
| [specs/router-games-tools/spec.md](./specs/router-games-tools/spec.md) | Functional requirements and scenarios |
| [specs/og-metadata-future/spec.md](./specs/og-metadata-future/spec.md) | Future exploration: OG tags for social sharing |

---

## 🎯 Key Points

### What's included

✅ Hash routing for games and tools  
✅ Deep linking support  
✅ Context preservation on refresh  
✅ Unified architecture with épics  
✅ Graceful error handling  
✅ Comprehensive testing strategy

### What's NOT included (future)

🔜 Open Graph metadata (explored in separate spec)  
🔜 Query parameters for presets  
🔜 Advanced game configuration via URL  

---

## 🏗️ Architecture

### Routes

| Route | Type | Example |
|-------|------|---------|
| `#/` | Catalog | Default home |
| `#/games/:id` | Game | `#/games/tictactoe` |
| `#/tools/:id` | Tool | `#/tools/json-formatter` |
| `#/parcours/:epic/:slide?` | Parcours | `#/parcours/guide-contribution/slide-2` |

### Files to modify

```
app/
├── router.js              ← Add game/tool route patterns
├── game-loader.js         ← Sync hash on load + validate
├── catalogue.js           ← Generate hash-based links
└── app.js                 ← (no changes needed)
```

### Implementation phases

1. **T1** - Router: Parse game/tool routes
2. **T2** - Loader: Synchronize hash + validate
3. **T3** - Catalog: Generate hash-based links
4. **T4** - Init: Load game directly if hash present
5. **T5** - Tests: Add coverage + update specs

---

## ✨ Examples

### Before (current)

```
User: "Check this out!" 🎮
Shares URL: example.com/
Recipient: Sees catalog, has to search for game
```

### After (proposed)

```
User: "Check this out!" 🎮
Shares URL: example.com/#/games/tictactoe
Recipient: Opens directly to the game
```

---

## 📊 Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| T1: Router | 1 day | None |
| T2: Loader | 1 day | T1 |
| T3: Catalog | 0.5 day | T1 |
| T4: Init | 0.5 day | T1-T3 |
| T5: Tests | 1 day | T1-T4 |
| **Total** | **~4 days** | - |

---

## ✅ Validation Checklist

- [ ] proposal.md approved by stakeholder
- [ ] design.md reviewed for architectural soundness
- [ ] tasks.md tasks are clear and sequenced
- [ ] spec requirements are unambiguous
- [ ] No conflicting dependencies
- [ ] Backwards compatibility confirmed
- [ ] Testing strategy is comprehensive

---

## 🤔 Questions & Decisions

### Q1: Why hash router vs History API?

**A:** Hash router is:
- ✅ Works with GitHub Pages (no server config needed)
- ✅ Compatible with all browsers
- ✅ Simpler implementation
- ✅ Already proven with épics

### Q2: What about Open Graph metadata?

**A:** Deferred to future phase. See [og-metadata-future spec](./specs/og-metadata-future/spec.md) for exploration.

### Q3: Can games receive custom parameters?

**A:** Not in MVP. Reserved for future (`#/games/id?param=value`).

---

## 🚀 Next Steps

1. **Review** this proposal (all files)
2. **Approve** or request changes
3. **Apply** using `/openspec:apply` command
4. **Implement** following tasks.md

---

## 📞 Contact

- **Proposal Author:** Claude
- **Requested by:** Cyrille (Docaposte)
- **Date:** 2025-01-14

---

## Related

- Previous: `openspec/changes/archive/2025-12-19-add-hash-router/` (foundation)
- Specs: `openspec/specs/portal/spec.md`, `openspec/specs/platform/spec.md`
