# Deploy — event-driven redeploy

How a push to `main` ends up running on the NAS, instantly and without polling
Docker Hub.

```
push main ─▶ GitHub Actions ─▶ build + push image to GHCR
                             └▶ POST /v1/update ─▶ Watchtower (on the NAS)
                                                   └▶ re-pull image + recreate app
```

Two moving parts replace the old "Watchtower polls Docker Hub every minute":

- **Registry:** images are published to **GHCR** (`ghcr.io/costardrouge/p5-templates`)
  with a moving `:main` tag plus an immutable `:sha-<short>` tag for rollbacks.
  No Docker Hub pull rate-limit.
- **Trigger:** **Watchtower in HTTP API mode** — it waits for an authenticated
  POST instead of polling. The build calls it the moment the image is pushed.

> The original `containrrr/watchtower` image was archived in Dec 2025. Use the
> maintained `nickfedor/watchtower` fork (already set in
> [`watchtower.compose.yml`](./watchtower.compose.yml)).

---

## 1. Make the GHCR image pullable from the NAS

Pick one:

- **Public package (simplest):** GitHub → your profile → **Packages** →
  `p5-templates` → **Package settings** → **Change visibility** → **Public**.
- **Private package:** on the NAS, `docker login ghcr.io -u CostardRouge`
  (paste a PAT with `read:packages`), then uncomment the `config.json` volume in
  `watchtower.compose.yml`.

Point the app stack at the published image:

```yaml
# in the app stack's docker-compose.yml
image: ghcr.io/costardrouge/p5-templates:main
```

(`APP_IMAGE` can override this to pin a `sha-<short>` tag for a rollback.)

## 2. Deploy Watchtower as its own stack on the NAS

```sh
# pick a long random token
export WATCHTOWER_TOKEN=$(openssl rand -hex 32)

docker compose -f deploy/watchtower.compose.yml up -d
```

(In Portainer: new stack, paste `watchtower.compose.yml`, set `WATCHTOWER_TOKEN`
as a stack environment variable.)

## 3. Make the API reachable from GitHub Actions

GitHub's runners are on the public internet and need to reach Watchtower's
`:8080` on your NAS. **Never expose `:8080` raw to the internet** — the bearer
token is the only auth, so wrap it. Options, best first:

| Option | How | Open ports? |
|---|---|---|
| **Cloudflare Tunnel** | `cloudflared` on the NAS → `https://watchtower.yourdomain.com` → `localhost:8080` | None |
| **Tailscale** | Runner joins your tailnet (`tailscale/github-action`), hits the NAS's tailnet IP | None (private) |
| **Reverse proxy + DDNS** | Traefik/Caddy/NPM terminates TLS in front of `:8080` | 443 |

### Cloudflare Tunnel (chosen)

Prereq: a domain on Cloudflare (the free plan is enough).

**Already running `cloudflared`** for other services? Just add one Public
Hostname route to your existing tunnel (step 2 below) — nothing else to deploy.

**Otherwise, run it next to Watchtower** so it reaches the API over the internal
compose network — then you can even drop the host `8080` mapping from
`watchtower.compose.yml` entirely. Add to that stack:

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel run
    environment:
      TUNNEL_TOKEN: ${CF_TUNNEL_TOKEN:?set from the Cloudflare dashboard}
```

In the **Cloudflare Zero Trust dashboard → Networks → Tunnels**:

1. **Create a tunnel** → copy its token into `CF_TUNNEL_TOKEN`.
2. Add a **Public Hostname**: `watchtower.yourdomain.com` → service
   `http://watchtower:8080` (same compose network; use `http://localhost:8080`
   if `cloudflared` runs directly on the host). Cloudflare creates the DNS record
   and terminates TLS automatically.

`DEPLOY_WEBHOOK_URL` is then
`https://watchtower.yourdomain.com/v1/update?image=ghcr.io/costardrouge/p5-templates`.

Optional extra hardening: put a Zero Trust **Access** service-token policy in
front of the hostname — though the bearer token already gates `/v1/update`.

> For Tailscale instead, the workflow needs an extra step to join the tailnet
> before the curl — ask and it can be added.

## 4. Wire the secrets in GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `DEPLOY_WEBHOOK_URL` | `https://watchtower.yourdomain.com/v1/update?image=ghcr.io/costardrouge/p5-templates` |
| `DEPLOY_WEBHOOK_TOKEN` | the same `WATCHTOWER_TOKEN` as on the NAS |

Until `DEPLOY_WEBHOOK_URL` is set, the build still publishes the image — only
the redeploy step is skipped (so nothing breaks while you wire this up).

The `?image=...` filter makes the trigger touch only the app, never the other
services.

## 5. Test

```sh
# from anywhere with the token — should return 200 and recreate the app
curl -fsS -X POST \
  -H "Authorization: Bearer $WATCHTOWER_TOKEN" \
  "https://watchtower.yourdomain.com/v1/update?image=ghcr.io/costardrouge/p5-templates"

# watch it work
docker logs -f watchtower
```

Then push a trivial change to `main` and confirm the app container is recreated
within a minute of the build finishing.

---

## Why not …?

- **Portainer stack webhooks** — a Portainer **Business** feature, not in CE.
- **A hand-rolled webhook receiver** (a container with the docker socket that
  re-pulls on POST) — that is exactly what Watchtower's HTTP API already is, with
  cleanup, label-scoping and a polling fallback included. No custom code to keep
  alive.
- **Polling Docker Hub** (the old setup) — laggy, and the free tier's
  100–200 pulls/6h rate-limit silently throttles frequent polls.
