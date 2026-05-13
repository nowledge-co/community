# Run Nowledge Mem in Docker

The official headless image at `docker.io/nowledge/mem` runs the full Nowledge
Mem server: REST API, MCP, and the web UI at `/app`. The container ships the
**same** PyArmor-protected Python bundle as the desktop release, runs as a
non-root user, and lives entirely off three named volumes.

It is **headless** by design. There is no GTK, no WebKit, no Tauri. If you want
the desktop app, install the `.deb` or `.AppImage` from the release page
instead.

---

## Volume contract — what survives `docker compose pull && up -d`

The image is built so it touches **only** the three named volumes at runtime.
Everything else (`/opt`, `/usr`, the rootfs) is read-only by design and gets
fully replaced when you pull a new image.

| Mount | Tier | What lives here | Survives upgrade? | Lose it = |
|---|---|---|---|---|
| `/var/lib/nowledge-mem`   | **Irreplaceable** | KuzuDB graph (`NowledgeGraph/nowledge_graph_v2.db/`), content store, persisted thread/source/artifact payloads | yes (named volume) | data loss; restore from backup |
| `/etc/nowledge-mem`       | **Valuable** | `app-settings.json`, `plugins.json`, `remote-access.json` (the API key), `license.json`, OAuth tokens, remote-LLM creds, AI Now config, scheduler state | yes (named volume) | re-activate license, re-sign-in, re-paste API keys |
| `/var/cache/nowledge-mem` | **Rebuildable** | `huggingface/` (LLM/embedding weights), `embeddings/` (FastEmbed ONNX), LanceDB search projection | yes (named volume) | one-time slow first search (re-download) |

So: back up `data` and `config`. `cache` is convenience storage; you can wipe
it any time. The image upgrade contract is:

```bash
docker compose pull
docker compose up -d        # restart with new image, all three volumes intact
```

### The three contracts that make this work — and that we will not break

1. **UID 10001 is forever.** The container runs as `uid=10001 gid=10001`.
   Files in your volumes are owned by 10001:10001 on the host. Every future
   release of this image must run as the same UID, otherwise mount-point
   permissions would break on upgrade. If you ever see a new image fail with
   permission errors on existing volumes, that is a regression — please file
   an issue.
2. **The three mount paths above are part of the public API.** They will not
   move. The `XDG_*` env vars inside the image will not move either. You can
   bind your compose volumes to wherever you want on the host without worrying
   about path drift across releases.
3. **Your device identity lives in the `config` volume.** A UUID seed at
   `/etc/nowledge-mem/co.nowledge.mem.desktop/machine_id` (auto-generated on
   first start) is what the license backend sees as your device. So:
   - `docker compose down && up -d` → same device, license stays activated.
   - `docker compose pull && up -d` → same device, license stays activated.
   - `docker compose down -v` → device gone, equivalent to a fresh install.
   - Moving the volume to another host → license follows the volume.
   - Fleet operators: override with `NOWLEDGE_DEVICE_FINGERPRINT=<value>` env
     for centralized identity (e.g. derived from a secret manager).
   This is the contract that makes the per-license device cap meaningful when
   running in containers — without it, every container restart would look
   like a brand-new device to the license server.

### Air-gapped / pre-baked models

If your deployment has no internet access, pre-populate the `cache` volume
once on a connected machine:

```bash
# On a connected machine, with the same image:
docker compose up -d
# Trigger a search so embedding weights download:
docker compose exec mem curl -s -H "Authorization: Bearer $(docker compose exec mem nmem key | tr -d '\r\n')" \
  "http://127.0.0.1:14242/memories/search?q=warmup&limit=1" >/dev/null
docker compose down

# Snapshot the cache volume:
docker run --rm -v nowledge-mem_cache:/cache -v "$PWD":/dst alpine \
  tar -C /cache -czf /dst/nmem-cache.tgz .

# On the air-gapped machine:
docker volume create nowledge-mem_cache
docker run --rm -v nowledge-mem_cache:/cache -v "$PWD":/src alpine \
  tar -C /cache -xzf /src/nmem-cache.tgz
docker compose up -d
```

The cache layout is identical across hosts of the same arch; there's nothing
machine-specific in there.

---

## Quick start (one command)

```bash
./bootstrap.sh
```

That brings the stack up, waits for `/livez`, prints the Access Anywhere API
key, shows your license tier, and tells you the URL to open.

If you have a license code:

```bash
./bootstrap.sh activate <BASE64-LICENSE-CODE>
```

The default `compose.yaml` exposes the server on `0.0.0.0:14242`. To put TLS
in front, overlay `compose.tls.yaml` and Caddy will obtain a Let's Encrypt
certificate for you.

### Or do it by hand

```bash
docker compose up -d
docker compose logs -f mem                                 # wait for "Application startup complete"
docker compose exec mem nmem key                           # show the API key
docker compose exec mem nmem license status                # license tier
docker compose exec mem nmem license activate <CODE>       # optional
open http://localhost:14242/app
```

---

## TLS (Let's Encrypt) via Caddy sidecar

```bash
export NOWLEDGE_DOMAIN=mem.example.com
export NOWLEDGE_LE_EMAIL=you@example.com

docker compose -f compose.yaml -f compose.tls.yaml up -d
```

You need:

- A DNS A/AAAA record for `NOWLEDGE_DOMAIN` pointing at this host.
- Ports `80` and `443` open to the internet (Let's Encrypt HTTP-01 challenge).
- Docker Compose **v2.24 or newer** (the overlay uses the `!reset` tag to
  rebind the upstream port, which earlier versions don't understand).

The mem container is rebound to `127.0.0.1` so the only reachable surface is
Caddy.

---

## Authentication — the full picture

The server enforces two independent things:

- **A license** (`license.json`) — paid Pro tier vs Free. Free is capped at
  20 memories; activate a license to lift the cap. License is a file, not a
  network call, and persists in the `config` volume.
- **An API key** (`remote-access.json`) — bearer-token auth on every non-public
  endpoint. The web UI uses the same key.

### What's exempt from auth

Anyone on the LAN can hit these without a key (by design — they're for
probes, sign-in, and serving static assets):

- `GET /livez` — orchestrator liveness; no DB touch
- `GET /health` — readiness; DB ping included
- `GET /capabilities` — feature flags (for the web/MCP client to adapt UI)
- `GET /app` + `/app/assets/*` — the SPA itself

Everything else requires `Authorization: Bearer <key>` or `X-NMEM-API-Key: <key>`.
Requests from `127.0.0.1` inside the container (e.g. the Docker `HEALTHCHECK`)
skip auth by default.

### Where the key lives

```
/etc/nowledge-mem/co.nowledge.mem.desktop/remote-access.json
                  ^                       ^
                  app namespace           mode 0600, owner nowledge:nowledge
```

This file is generated on first start. Backing up the `config` volume backs
up the key.

### Common operations

```bash
# Show the current key
./bootstrap.sh                            # or: docker compose exec mem nmem key

# Rotate (invalidates the old value immediately; re-paste in clients)
./bootstrap.sh rotate-key                 # or: docker compose exec mem nmem key --rotate

# Pre-seed a known key (useful for fleets managed by a secret manager).
# Write the file before first `docker compose up`:
mkdir -p ./seed/co.nowledge.mem.desktop
cat > ./seed/co.nowledge.mem.desktop/remote-access.json <<EOF
{"api_key":"<your-key>","require_auth_loopback":false,"created_at":"$(date -Iseconds)"}
EOF
chmod 0600 ./seed/co.nowledge.mem.desktop/remote-access.json
# Then bind ./seed onto /etc/nowledge-mem in compose.yaml (or copy into the
# volume with `docker run --rm -v config:/dst -v $PWD/seed:/src alpine cp -a /src/. /dst/`).
```

### Rate-limit recovery

After 5 invalid-auth attempts from the same client IP, the server blocks
that IP for **15 minutes**. If you locked yourself out during testing:

```bash
docker compose restart mem        # clears the in-memory rate-limit window
```

The block is per-client-IP, not per-key — rotating the key won't unblock you.

### If a key leaks

1. `./bootstrap.sh rotate-key` — issue a new value.
2. Audit `docker compose logs mem` for `HTTP_REQUEST_SUMMARY` lines with
   unfamiliar `client_ip` values around the time of the leak.
3. If the leak is severe, also rotate any provider keys you stored via the
   web UI (remote-LLM creds, OAuth tokens, Cloudflare tunnel cert).

### Locking down to LAN only

The image listens on `0.0.0.0:14242` so it's reachable from your network.
If you want to restrict reachability to a specific subnet:

```yaml
services:
  mem:
    environment:
      # CIDR allowlist; comma-separated. Default = no allowlist (auth-only).
      NOWLEDGE_IP_ALLOWLIST: "10.0.0.0/24,192.168.1.0/24"
```

Or front the container with a reverse proxy (Caddy in `compose.tls.yaml`,
nginx, Traefik, …) and bind the upstream to `127.0.0.1`. The TLS overlay we
ship already does this.

---

## Verify the image was built by Nowledge Labs

Every published manifest is signed via Sigstore keyless signing. There are no
public keys to download or rotate — verification uses the GitHub Actions OIDC
identity that produced the build.

```bash
cosign verify docker.io/nowledge/mem:0.8.4 \
  --certificate-identity-regexp='https://github.com/nowledge-co/nowledge-mem/.github/workflows/release-docker.yml@.*' \
  --certificate-oidc-issuer='https://token.actions.githubusercontent.com'
```

A passing run prints the certificate chain that bound the signature to the
release-docker workflow at a specific commit. A failing run means the image
you pulled was not produced by our pipeline.

`cosign` install: <https://docs.sigstore.dev/cosign/installation/>.

---

## Day-2 operations

### Backup

```bash
docker run --rm \
  -v nowledge-mem_data:/data:ro \
  -v nowledge-mem_config:/config:ro \
  -v "$PWD":/backup \
  alpine \
  tar -C / -czf /backup/nowledge-mem-$(date +%F).tgz data config
```

Restore by extracting into fresh volumes before the first `docker compose up`.

### Upgrade

```bash
# Pin to the new version in compose.yaml, then:
docker compose pull
docker compose up -d
```

The backend runs schema migrations on startup. There is **no downgrade path**;
once a newer image has opened the database, an older image will refuse to.

### Factory reset

```bash
docker compose down
docker volume rm nowledge-mem_data nowledge-mem_config nowledge-mem_cache
docker compose up -d
```

### Logs

The image emits structured JSON to stdout. The compose file already configures
rotation (`max-size: 10m`, `max-file: 5`). To follow:

```bash
docker compose logs -f mem
```

### Health probes

- `GET /livez` — process is up. Use this for orchestrator liveness restarts.
- `GET /health` — process is up **and** the database is open. Use this for
  readiness gating (k8s readinessProbe, load balancer health check).

### Memory and recovery

The server uses KuzuDB for the graph, and KuzuDB has a per-process buffer
pool. The pool is sized at startup from a heuristic over the current DB
size and grown automatically as the data scales. Two things to know:

**Sizing your container.** The compose default (`mem_limit: 4g`) is sized
for a small-to-medium personal graph. As your data grows, lift the
container:

| DB size (steady state) | Recommended `mem_limit` |
|---|---|
| < 200 MB | 2 GB |
| < 1 GB | **4 GB** (the compose default) |
| 1 – 4 GB | 8 GB |
| 4 – 16 GB | 16 GB |
| > 16 GB | host-specific; pin `NOWLEDGE_KUZU_BUFFER_POOL_SIZE` explicitly |

A rough rule: the Kuzu pool wants ~25% of the container budget; the
embedding model wants ~1.4 GB; Python + uvicorn want ~500 MB; and you
want ~25% headroom for OS page cache and ingestion temp buffers.

**If a large upload fails with a 500 and the next few reads also 500**,
you've hit a buffer-pool exhaustion (`docker compose logs mem | grep
"Buffer manager exception"` confirms). Today's recovery:

```bash
docker compose restart mem
# Then verify the new floor:
curl -s http://127.0.0.1:14242/health \
  | jq '{
      pool:  .buffer_pool_current_mb,
      floor: .buffer_pool_auto_floor_mb,
      cap:   .buffer_pool_auto_cap_mb,
      need_restart: .buffer_pool_restart_required
    }'
```

The image self-escalates the floor on exhaustion and the next restart
picks up the new value, so a single restart is normally enough. If
exhaustion keeps recurring, your container's `mem_limit` is too low for
your dataset — bump it per the table above and recreate the stack.

**Power-user knobs:**

- `NOWLEDGE_KUZU_BUFFER_POOL_SIZE` — pin the pool to a fixed size
  (e.g. `1GB`, `512MB`). Disables both the heuristic and auto-escalation.
  Use when you want deterministic capacity planning at scale.
- `NOWLEDGE_KUZU_BUFFER_POOL_FLOOR_MB` — override the auto-mode floor.
  Headless containers default to **256 MB** so a fresh deploy can absorb
  a first-day ingest workload. Set to `0` to opt out on tight-memory
  hosts (e.g. 1 GiB VPS); set higher on bulk-ingest hosts.
- `NOWLEDGE_AGENT_MAX_CONCURRENT` — per-agent-type concurrency cap.
  Default **1** on headless, 2 on desktop. Raise to 2 on an 8 GiB
  container, 3+ on a 16 GiB container. Above this cap the server
  returns `AgentBusy` immediately rather than queueing — the browser
  shows "agent is busy, try again in a few seconds" instead of
  silently double-booking memory and OOM-killing the container.

**Container memory cap is now cgroup-aware.** Earlier builds would
size Kuzu's auto-cap from the *host's* RAM, ignoring your
`mem_limit`. Starting 0.8.4 the auto-cap clamps to the cgroup
`memory.max` (or v1 equivalent), so Mem cannot grow its graph memory
past what Docker has actually given the container. No action needed
— this just means `mem_limit: 4g` is honoured the way you'd expect.

---

## Secrets

If you'd rather not store the license inside the `config` volume, mount it as
a Docker secret instead. The path inside the container is unchanged:

```yaml
services:
  mem:
    secrets:
      - source: nowledge_license
        target: /etc/nowledge-mem/co.nowledge.mem.desktop/license.json
        mode: 0400

secrets:
  nowledge_license:
    file: ./secrets/license.json
```

The backend reads the same file; nothing else changes.

---

## What is **not** in this image

- The Tauri desktop GUI. Use the platform installer.
- Bundled OCR tooling for PDF/image ingestion. API-driven workflows are not
  affected; only drag-and-drop scanned-document ingest is.
- Bundled `cloudflared`. Use a Cloudflare Tunnel container as a sidecar if you
  need that pattern; the headless image is intentionally network-agnostic.

---

## Troubleshooting

**`/health` returns `degraded` shortly after start.** Normal during the first
~60 s while Kuzu opens and the content store reconciles. The image's
`start_period` (90 s) accounts for this; `/livez` is green immediately.

**`nmem license activate` says "license file not found".** Make sure the
`config` volume is mounted (`docker compose config` should list it under the
`mem` service).

**Web UI loads but says "Web Client Not Available".** The image was built
without the SPA. This should not happen with the official image; please file a
bug. If you're building locally, ensure `npm run build:web` produced
`nowledge-graph/dist-web/`.

**MCP plugins won't install.** Plugin install needs network and may shell out
to `npx`/`uvx`. The default image trusts outbound HTTPS but does not include
those CLIs. For now, install plugins on the desktop app and they'll be picked
up by the server via the shared config volume; first-class headless plugin
install is on the roadmap.

**A file upload returned 500 and now every page in the UI fails.** The Kuzu
buffer pool exhausted. `docker compose restart mem` recovers; if it keeps
recurring, bump `mem_limit` per the table above or pin
`NOWLEDGE_KUZU_BUFFER_POOL_SIZE` explicitly. See "Memory and recovery"
above and `docs/design/HEADLESS_MEMORY_CONTRACT.md` for the full picture.

**Feed agent / knowledge agent hangs the container, /livez goes
"unhealthy".** Different cause from the buffer-pool wedge above: those
agents do many synchronous BGE-m3 ONNX embedding passes during context
gathering. Sync inference on CPU starves the asyncio event loop;
in-flight `httpx` LLM responses can't be serviced and report
`ReadTimeout` **even though the network and the LLM provider are
fine**. The agent retries, doing more inference, and memory climbs
toward `mem_limit`. Eventually Docker OOM-kills.

Confirm:

```bash
docker stats --no-stream nowledge-mem
# CPU near 200 %, memory near mem_limit → it's this failure mode.
docker logs nowledge-mem | grep -E "httpx.*Timeout|ReadTimeout" | tail -3
# Many of these → confirms the event-loop starvation pattern.
```

Recover and avoid recurrence:

```bash
docker compose restart mem        # kills the wedged agent loop
# Then BEFORE re-triggering feed/knowledge:
#   - Bump mem_limit to 8g per the table above. The default 4g is
#     sized for passive (graph + web UI + idle embedding); agent
#     flows need headroom for retries + the resident embedding model.
#   - AI Now is lighter and works inside 4g; feed/knowledge are the
#     heavyweights right now.
```

This is **not** a misconfigured LLM provider — verified by inspecting
on-disk state, all three agents (AI Now, feed, knowledge) read the
same `remote_llm.json`. The structural fix lives in the agent layer
(off-event-loop ONNX inference, batched embedding calls, bounded
retries) and is tracked in
`docs/design/HEADLESS_MEMORY_CONTRACT.md` Appendix A (TODO 5.5a–5.5d).
