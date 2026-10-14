# Bounded braces fork

This local, private package is based on **braces 3.0.3**, upstream commit
`74b2db2938fad48a2ea54a9c8bf27a37a62c350d`:
https://github.com/micromatch/braces/tree/3.0.3

The original MIT license is preserved in `LICENSE`. The local version
`3.0.4-playlab42.1` identifies this patched code and is not a published upstream
version. The package retains its `braces` name so npm installs the same module
for direct and transitive consumers. The root npm override
replaces `braces` for every consumer, including OpenSpec 1.14.0's
`fast-glob -> micromatch` chain. This is a patched fork, not an upstream
release or an advisory exemption.

## GHSA-vfj7-8cjw-p6xm

All published upstream versions through 3.0.3 are affected. This fork:

- rejects nested braces **and parentheses** before the parser builds an AST
  deeper than the recursive walkers can safely consume;
- validates ASTs iteratively before stringify, compile and expand, including
  direct AST arguments and cycles;
- bounds AST node visits, including repeated shared subtrees;
- bounds expand's parent-chain traversal for malformed direct ASTs.
- rejects non-string AST values and bounds recursive expansion-array helpers.

The hard ceiling is 128 AST edges, including terminal nodes. Excessive nesting
raises `RangeError` with `code: ERR_BRACES_DEPTH`; excessive AST size raises
`ERR_BRACES_NODES`. Options cannot disable these safety limits. Escaped,
quoted and character-class delimiters remain literal. Existing range limits
and all normal public APIs are retained.

Regression and consumer tests live in `scripts/braces-security.test.js`.
Keep `npm audit --audit-level=moderate` enabled. Replace this fork with an
upstream release only when it fixes this advisory, then remove the local
dependency and override, regenerate the lockfile and retain the regressions.
