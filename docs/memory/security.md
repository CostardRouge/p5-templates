# Security

Read before adding or changing an API route, a server action, anything that turns request data into a path, an S3 key or an outbound request, or anything in `.env.example`.

## There is no authentication, so every route is a public endpoint

2026-10-02 — No proxy/middleware, no session, no API key: every handler under `src/app/api/` and every server action in `src/app/actions/` is callable by anyone who can reach the host, and the deployed host is on the public internet (`p5.steeve.website`, framed by steevepommier.com). The `NEXT_PUBLIC_*` feature flags only hide UI — no route checks `BACKEND_RECORDING` before acting. `/api/dev/*`, `/api/thumbnails/generate` and `/api/previews/generate` refuse in production (`NODE_ENV === "production"`) and are only reachable under `next dev`, which listens on the LAN. Adding auth is the maintainer's decision (TODO: N8n API key, multi-user). **How to apply**: until then, write every handler as if the caller is hostile — validate each parameter at the boundary, and never let one become a filesystem path, an S3 key prefix, a URL the server fetches, or a shell argument without a check.

## Request data never becomes a filesystem path through `path.join`

2026-10-02 — `/api/assets` built `path.join( os.tmpdir(), name )` from the query string, and `path.join` normalises `..` away: `?name=../../etc/passwd` returned `/etc/passwd` with a 200 (proved by `src/app/api/assets/__tests__/route.test.ts` against the old route), which in the container includes `/proc/self/environ` — the database URL and S3 keys. Nothing in the repo calls that route any more. **How to apply**: resolve untrusted segments with `src/utils/resolveInsideDirectory.ts`, which returns `null` when the result leaves the root (a `..`, an absolute segment, or the root itself), and answer 400 on `null`.
