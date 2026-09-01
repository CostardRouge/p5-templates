# Testing and CI

Read before writing tests, changing Jest config, or working out what gates a merge.

## What gates a merge

2026-08-20 — `.github/workflows/ci.yml` runs four independent jobs on Node 24 — **lint, typecheck, test, build** — in parallel, each doing its own `npm ci` with `HUSKY: 0`. Markdown-only and `docs/**` changes are path-ignored, so a docs commit runs no CI at all. Concurrency cancels superseded PR runs but never cancels a `main` run (`github.head_ref` is empty there, so the group key falls back to the unique `run_id`) — every commit on `main` is validated end to end. **How to apply**: `npm run check` reproduces three of the four jobs locally; the fourth is `npm run build`. Run both before handing work back.

## The build job is a test, not a packaging step

2026-08-20 — The fourth CI job exists because `next build` compiles **every sketch route**, which is the only thing that catches a broken import or an oversized serverless bundle in a sketch that no unit test touches. It runs with the feature flags pinned (`INTERACTION_BINDINGS: "true"` so that code path compiles, the rest `"false"`), mirroring the Docker build args. **How to apply**: any change under `src/sketches/` or `src/app/` needs a local `npm run build`, not just `npm test`. A sketch that imports a missing asset passes lint, typecheck and test, and fails here.

## Jest runs in Node, and never resolves a sketch entry

2026-08-20 — `jest.config.js` uses `testEnvironment: "node"` with ts-jest and a relaxed inline tsconfig (`diagnostics: false`, CommonJS, `jsx: "react"`) so `options.ts` and helpers compile without the Next tsconfig plugin. `modulePathIgnorePatterns` excludes `.next` and `src/generated`. Sketch `index.js` files are deliberately never loaded through the resolver: they call the global p5 API at module top level and pull in browser-only assets. **How to apply**: test a sketch's *maths* by extracting it into a helper module and testing that (see `src/sketches/p5/sketches/voronoi/__tests__/` and `metaballs/__tests__/`) — importing the sketch entry itself will fail. jsdom is available (`jest-environment-jsdom`, plus `@testing-library/react`) per-file via a docblock for component tests; it is not the default.

## What the ~74 test files actually cover

2026-08-20 — Coverage is concentrated where behaviour is subtle rather than spread evenly: pure maths helpers (`dragMath`, `zoomCalculations`, `vector2dMath`, voronoi, metaballs), type/serialisation boundaries under `src/types/__tests__/`, a handful of React component and hook tests, the recorder strategy (`AsyncLoopRecorder`), and the catalogue drift guard `src/sketches/__tests__/sketches.test.ts`. `fast-check` is installed as a devDependency but nothing in `src/` imports it — property-based testing is available and currently unused. **How to apply**: match that pattern — extract the tricky computation and property-test it, rather than trying to assert on rendered pixels in Jest. Visual verification belongs to the `verify` skill against the running app.
