# Project memory — decisions, reasons, traps

Long-term memory of this repo, read at the start of **every** agent session (imported by `CLAUDE.md`). It holds what the code and `git log` cannot tell you: the choices made and their reasons, what was tried and rejected, the traps that cost time, how the maintainer likes to work.

This file is the **always-loaded index**. The detail lives in `docs/memory/<topic>.md`, one file per area, loaded **on demand**: read the topic file(s) matching the area you are about to touch **before** acting (table at the bottom). Do not `@import` them into `CLAUDE.md` — the split exists to keep the per-session prompt small.

## How to maintain (mandatory — CLAUDE.md rule 2)

- **When**: at the end of every task, before its commit, in the same commit. Writing is the **default**; only skip if there is truly nothing a future agent could use, and say so explicitly in the final message.
- **What**: a design/product decision, a non-obvious technical choice, an explicit rejection ("the maintainer did not want X because Y"), a trap (browser, tooling, framework, hosting) and its remedy, a working preference. Not implementation detail readable in the diff, not what `git log` already says, not history ("this was fixed on…") — once a fix is committed, keep only the rule it taught.
- **Where**: the matching `docs/memory/<topic>.md`; a new file only when no topic fits (kebab-case name, add it to the table below with a "read when"). Cross-cutting rules, working style, decisions-at-a-glance and open items stay in this index.
- **How**: search first and **update** the existing entry rather than adding a near-duplicate; delete what became false. One entry = one short paragraph: *decision → why → how to apply*, dated `YYYY-MM-DD` on first write and on each revision. Say the same thing **once** — cross-reference other files by name instead of repeating.
- **Language**: **English**, dense, factual. No session narration.
- Budget: keep this index under ~200 lines and each topic file under ~150; if one outgrows that, split it.

## Working with Steeve Pommier

<!-- Fill in as you learn: how they validate work, how they phrase requests,
     what they want when an audit finds problems, what annoys them. -->

## Direction in five lines

<!-- The product/design north star, short enough to read every session. -->

## Decisions at a glance (details in the topic files)

<!-- One line per structural decision, each pointing at its topic file. -->

## Open items (dated; remove when done)

<!-- Unfinished, undecided, or "only the maintainer can do this". -->

## Topic files — read before touching the area

| File | Read when you touch… |
| --- | --- |
| | |
