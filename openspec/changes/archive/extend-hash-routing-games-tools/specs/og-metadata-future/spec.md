# Spec Delta: Open Graph Metadata (Future Consideration)

**Change ID:** extend-hash-routing-games-tools  
**Spec:** og-metadata-future  
**Status:** Future / Exploratory  
**Priority:** Nice-to-have (Post-MVP)

---

## Overview

This spec explores the feasibility of adding Open Graph metadata to shareable game/tool links so they display nicely on Teams, Slack, Discord, and other social platforms.

**Current limitation:** Pure JavaScript frontend cannot dynamically update OG meta tags for link previews (preview fetchers run before JS executes).

**Possible paths forward:** Service Worker, serverless function, static pre-generation.

---

## Problem Statement

### Current Behavior

```
User shares: https://example.com/#/games/tictactoe
  ↓
Teams/Slack preview fetcher visits URL
  ↓
Sees generic index.html (no OG tags specific to game)
  ↓
Shows default image, no game title, no description
```

### Desired Behavior

```
User shares: https://example.com/#/games/tictactoe
  ↓
Teams/Slack preview fetcher visits URL
  ↓
Sees dynamic OG tags:
  - og:title = "Tic-Tac-Toe - Playlab42"
  - og:description = "The classic morpion - align 3 symbols to win"
  - og:image = "https://example.com/games/tictactoe/thumb.png"
  ↓
Shows nice preview with game image and description
```

---

## Proposed Solutions

### Option 1: Service Worker (Preferred for future)

**Approach:** Service Worker intercepts requests and injects OG meta tags based on hash.

```javascript
// sw.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('index.html')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        // Clone and modify HTML
        return response.text().then((html) => {
          // Extract hash from Referer header or URL
          // Inject OG tags based on game/tool ID
          return new Response(html, { headers: response.headers });
        });
      })
    );
  }
});
```

**Pros:**
- Works without backend
- Transparent to frontend code
- Works offline

**Cons:**
- Complex to debug
- Service Worker lifecycle quirks
- May interfere with app updates

### Option 2: Serverless Function (Most practical)

**Approach:** Redirect `/` requests with game hash to a function that serves dynamic HTML.

```bash
# On Netlify, Vercel, or AWS Lambda
GET https://example.com/#/games/tictactoe
  ↓
Proxy detects hash
  ↓
Routes to serverless function
  ↓
Function reads game.json, injects OG tags
  ↓
Returns HTML with meta tags
```

**Pros:**
- Clean separation
- Reliable
- Easy to debug

**Cons:**
- Requires backend infrastructure
- Cold start latency
- Not fully "standalone"

### Option 3: Pre-generate Static Files (Hybrid)

**Approach:** Build step generates HTML files with OG tags for each game/tool.

```bash
build:
  ├─ index.html (default, generic OG tags)
  ├─ _game-tictactoe.html (with OG tags for tictactoe)
  ├─ _game-checkers.html (with OG tags for checkers)
  └─ .htaccess or redirect rules
```

**Pros:**
- Works with any host (GitHub Pages, S3)
- No backend needed
- CDN-friendly

**Cons:**
- Complex build process
- Requires host support for rewrites
- Duplicates index.html many times

### Option 4: Do Nothing (Accept limitation)

**Approach:** Accept that OG metadata isn't available in pure JS.

**Pros:**
- Simplest
- No architecture changes
- Focus on core functionality

**Cons:**
- Share preview looks plain
- May reduce adoption/sharing

---

## Decision for MVP

**Decision:** ✅ **Accept limitation for MVP, plan Option 2 (serverless) for future**

**Rationale:**
1. Deeplinks work without OG metadata
2. Core feature (hash routing) is complete and valuable
3. OG metadata is nice-to-have, not essential
4. Serverless approach is cleanest long-term

---

## Future Implementation Path

### Phase 1: Research & Prototype

1. Set up Netlify Functions or Vercel
2. Create prototype function that:
   - Receives hash from request
   - Parses game/tool ID
   - Reads `data/catalogue.json`
   - Injects OG meta tags into index.html
3. Test with Teams/Slack preview

### Phase 2: Decision Point

- If works well: proceed to production
- If too complex: revert to Option 4

### Phase 3: Production Deployment

- Deploy function
- Update DNS/routing rules
- Test all share scenarios
- Monitor for issues

---

## Example OG Tags

```html
<!-- For #/games/tictactoe -->
<meta property="og:title" content="Tic-Tac-Toe - Playlab42">
<meta property="og:description" content="The classic morpion - align 3 symbols to win">
<meta property="og:image" content="https://example.com/games/tictactoe/thumb.png">
<meta property="og:type" content="game">
<meta property="og:url" content="https://example.com/#/games/tictactoe">

<!-- For #/tools/json-formatter -->
<meta property="og:title" content="JSON Formatter - Playlab42">
<meta property="og:description" content="Format and validate JSON documents">
<meta property="og:image" content="https://example.com/tools/json-formatter/thumb.png">
<meta property="og:type" content="website">
<meta property="og:url" content="https://example.com/#/tools/json-formatter">
```

---

## Tracking for Future

- [ ] Create GitHub issue for OG metadata research
- [ ] Prototype serverless function
- [ ] Test with Teams/Slack preview fetchers
- [ ] Decide: pursue or defer indefinitely

---

## Questions for User

1. Is social media sharing important for your use case?
2. Do you have budget/resources for serverless infrastructure?
3. Would you prefer Option 2 (serverless) or Option 3 (pre-generation)?

---

## Related

- `extend-hash-routing-games-tools/proposal.md` — Main proposal
- `extend-hash-routing-games-tools/design.md` — Architecture
