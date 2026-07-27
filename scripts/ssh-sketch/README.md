# ssh-sketch — PoC: a sketch over SSH

`ssh <host> -p 2222` opens **ascii-pulse-v1-komputery** rendered live in the
terminal, terminal.shop-style. No browser, no p5 — the sketch's visual core is
a pure function of the loop phase, so it is ported natively to a grid of
truecolor ANSI glyph cells (one terminal cell = one sketch glyph cell).

## Quick try (no SSH needed)

```bash
npm run sketch:tty                  # renders in the current terminal
npm run sketch:tty -- --palette crt # crt | hot | komputery
npm run sketch:tty -- --mode spectrum
npm run sketch:tty -- --bell        # terminal bell on the beat
```

`q` or `Ctrl+C` quits.

## SSH server

```bash
npm run sketch:ssh                  # listens on :2222 (SSH_SKETCH_PORT to change)
```

Then from any terminal (the username picks the variant):

```bash
ssh komputery@localhost -p 2222
ssh crt@localhost -p 2222
ssh hot@localhost -p 2222
ssh spectrum@localhost -p 2222
```

Any password (or none) is accepted — it's a viewer, not a shop… yet. A host
key is generated on first run into `scripts/ssh-sketch/.host-key` (gitignored),
so the first connection may warn about an unknown host as usual.

## How it maps to the sketch

- `renderer.mjs` ports `cellIntensity()` and the glyph/colour mapping of
  `drawGrid()` from
  `src/sketches/p5/sketches/ascii-pulse/ascii-pulse-v1-komputery/index.js`,
  with the defaults from its `options.ts`.
- The loop clock mirrors the app: one loop = `DURATION_DEFAULT` (12 s), 8 beats
  per loop, phase φ ∈ [0, 1) — same seamless-loop maths, driven by wall clock.
- Terminal cells are ~2× taller than wide, so the field is sampled on a 1×2
  virtual pixel grid per cell to keep the radial wave circular.
- Frames repaint every cell from cursor-home (no clear → no flicker), with the
  alt screen + hidden cursor + autowrap-off for the session.

## Files

| File | Role |
|---|---|
| `renderer.mjs` | Pure ANSI frame renderer + frame loop (zero deps) |
| `local.mjs` | Run in the current TTY (`--once` prints a single frame) |
| `server.mjs` | SSH server (`ssh2`), username → variant |
