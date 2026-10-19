# CLAUDE.md

## Hard rules

1. are.na API v3 only (`https://api.are.na/v3/`). v2 is dead.
2. Polite throttling: 150 ms between page fetches; on 429, back off `[2, 4, 8]` seconds and honour `Retry-After`.
3. The toolkit is migrating to a shared build pipeline (`_shared/` modules, `src/` → `dist/` via Node `build.js`, Vitest for pure logic). Full plan in Project knowledge: `claude/toolkit-architecture-plan.md`.
4. Migration is opportunistic — each tool stays in its current shape until next touched. Current state per tool is in `AGENTS.md` §1.
5. Copy to `docs/` after any change — it's the GitHub Pages root.
6. Ask before changing code. Be concise; explain when asked.
7. British English in UI copy.

## Where to look

- Current state of play, tool status, open work → `AGENTS.md`
- A specific tool → that tool's folder (`README.md` + `NOTES.md`/`CONTEXT.md`)
- User-facing docs → `README.md`
