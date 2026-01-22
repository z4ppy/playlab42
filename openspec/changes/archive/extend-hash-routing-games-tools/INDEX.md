# Index - Proposal: Extend Hash Routing to Games and Tools

**Change ID:** `extend-hash-routing-games-tools`  
**Status:** 🟡 Draft (Ready for Review)  
**Created:** 2025-01-14

---

## 📖 Reading Guide

### 🎯 Quick Start (5 minutes)

**For stakeholders and decision makers:**

1. [README.md](./README.md) — Executive summary with examples
2. [proposal.md](./proposal.md#solution-proposée) — Solution section only

### 🏗️ For Technical Review (15 minutes)

**For architects and reviewers:**

1. [README.md](./README.md) — Full overview
2. [design.md](./design.md#décisions-clés) — Key decisions section
3. [specs/router-games-tools/spec.md](./specs/router-games-tools/spec.md#added-requirements) — Requirements

### 🔨 For Implementation (Full)

**For developers who will implement:**

1. [tasks.md](./tasks.md) — Complete implementation plan
2. [design.md](./design.md) — Full architecture
3. [specs/router-games-tools/spec.md](./specs/router-games-tools/spec.md) — Detailed requirements
4. [proposal.md](./proposal.md) — Context and rationale

### 🔮 For Future Exploration

**For Open Graph / social sharing consideration:**

→ [specs/og-metadata-future/spec.md](./specs/og-metadata-future/spec.md)

---

## 📋 File Structure

```
extend-hash-routing-games-tools/
├── INDEX.md                       ← You are here
├── README.md                      ← Start here for quick overview
├── SUMMARY.md                     ← File summary and status
├── proposal.md                    ← Business case
├── design.md                      ← Architecture decisions
├── tasks.md                       ← Implementation plan (5 phases)
└── specs/
    ├── router-games-tools/
    │   └── spec.md               ← Main technical spec
    └── og-metadata-future/
        └── spec.md               ← Future exploration
```

---

## 🎯 Document Purpose

| Document | Purpose | Read Time |
|----------|---------|-----------|
| README.md | Executive overview, business case | 2 min |
| proposal.md | Problem, solution, impact | 5 min |
| design.md | Architecture, 8 key decisions | 10 min |
| tasks.md | Implementation tasks T1-T5 | 5 min |
| specs/router-games-tools/spec.md | Functional requirements | 7 min |
| specs/og-metadata-future/spec.md | Future exploration options | 5 min |
| SUMMARY.md | File list and navigation | 3 min |

**Total reading time:** 37 minutes (comprehensive review)

---

## 🗂️ By Audience

### 👔 Project Manager / Stakeholder

**Goal:** Understand scope and effort

**Read:** 
- [README.md](./README.md) — 2 min
- [proposal.md](./proposal.md) — 5 min
- [tasks.md](./tasks.md) — Effort Estimate section — 2 min

**Time:** ~10 min

### 👨‍💻 Senior Developer / Architect

**Goal:** Review architecture and design decisions

**Read:**
- [README.md](./README.md) — Full — 2 min
- [design.md](./design.md) — Full — 10 min
- [specs/router-games-tools/spec.md](./specs/router-games-tools/spec.md) — Full — 7 min
- [proposal.md](./proposal.md) — Full — 5 min

**Time:** ~25 min

### 👨‍🔧 Developer (Implementer)

**Goal:** Understand requirements and tasks

**Read:**
- [tasks.md](./tasks.md) — Full — 5 min
- [design.md](./design.md) — Implementation Notes section — 3 min
- [specs/router-games-tools/spec.md](./specs/router-games-tools/spec.md) — Full — 7 min

**Then:** Follow tasks T1-T5 from tasks.md

**Time:** ~15 min (before starting)

### 🔮 Future Work (OG Metadata)

**Goal:** Understand options for social sharing

**Read:**
- [specs/og-metadata-future/spec.md](./specs/og-metadata-future/spec.md) — Full — 5 min

**Time:** ~5 min

---

## 🚀 Key Points Summary

### What's New

✅ Hash routes for games: `#/games/:id`  
✅ Hash routes for tools: `#/tools/:id`  
✅ Direct links now shareable  
✅ Context preserved on refresh  

### Architecture

```
#/games/tictactoe
        ↓
app/router.js (parse)
        ↓
app/game-loader.js (validate + load)
        ↓
games/tictactoe/index.html (in iframe)
```

### Files to Modify

- `app/router.js` — Add game/tool route patterns
- `app/game-loader.js` — Sync hash + validate
- `app/catalogue.js` — Generate hash-based links

### Effort

**~4 days** (5 sequential/parallel tasks)

### Backwards Compatibility

✅ Full backward compatibility (no breaking changes)

---

## ✅ Validation Checklist

Before approval:

- [ ] proposal.md is clear and complete
- [ ] design.md decisions are sound
- [ ] tasks.md is actionable
- [ ] specs have concrete scenarios
- [ ] No conflicting dependencies
- [ ] Risk level acceptable

---

## 📞 Questions?

| Question | Answer |
|----------|--------|
| **Why hash router?** | Works with GitHub Pages, simpler than History API |
| **What about OG metadata?** | Deferred to future; see og-metadata-future spec |
| **Backward compatible?** | Yes, full compatibility |
| **Effort?** | ~4 days of development |
| **Risk?** | Low (isolated changes, good testing) |

---

## 🔗 Related Specifications

- `openspec/specs/portal/spec.md` — Portal architecture
- `openspec/specs/platform/spec.md` — Platform conventions
- `openspec/changes/archive/2025-12-19-add-hash-router/` — Router foundation (already implemented)

---

## 📊 Status Timeline

```
2025-01-14  Proposal created (today)
   ↓
   Review & Approval Phase
   ↓
Post-approval → Implementation Phase (follow tasks.md)
   ↓
T1-T5 completion → Validation & Merge
```

---

## 🎬 Next Steps

1. **Distribute** this proposal to reviewers
2. **Discuss** any concerns or questions
3. **Approve** or request changes
4. **Apply** using `openspec apply extend-hash-routing-games-tools`
5. **Implement** following [tasks.md](./tasks.md)

---

Generated: 2025-01-14  
Author: Claude  
Requested by: Cyrille (Docaposte)
