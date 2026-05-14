# Run Nowledge Mem in Docker

The official headless image at `docker.io/nowledgelabs/mem` runs the full Nowledge
Mem server: REST API, MCP, and the web UI at `/app`. The container ships the
**same** PyArmor-protected Python bundle as the desktop release, runs as a
non-root user, and writes only into three directories you own.

It is **headless** by design. There is no GTK, no WebKit, no Tauri. If you want
the desktop app, install the `.deb` or `.AppImage` from the release page
instead.

> **For your agent.** Drop this URL into Claude / Codex / Cursor / any agent and
> it will know how to install, monitor, and upgrade your Mem server on its own
> (destructive operations stay with you):
>
> `https://raw.githubusercontent.com/nowledge-co/community/main/skills/nowledge-mem-docker/SKILL.md`
>
> (Raw file URL — curl returns the markdown directly. The browsable version
> is at `github.com/nowledge-co/community/blob/main/skills/nowledge-mem-docker/SKILL.md`.)

---

## Where your data lives

Three local directories, side by side with `compose.yaml`. **You own them.**
Standard tools (`rsync`, `restic`, `borg`, ZFS snapshots, `tar`, `du`) work
directly — no docker volume idioms to learn, no `docker volume inspect` to
chase mount points through.

| Directory | Tier | What lives here | Lose it = |
|---|---|---|---|
| `./data`   | **Irreplaceable** | KuzuDB graph (`NowledgeGraph/nowledge_graph_v2.db/`), content store, persisted thread/source/artifact payloads | data loss; restore from backup |
| `./config` | **Valuable**      | `app-settings.json`, `plugins.json`, `remote-access.json` (the API key), `license.json`, OAuth tokens, remote-LLM creds, agent state, scheduler state | re-activate license, re-sign-in, re-paste API keys |
| `./cache`  | **Rebuildable**   | `huggingface/` (LLM/embedding weights), `embeddings/` (FastEmbed ONNX), LanceDB search projection | one-time slow first search (re-download) |

Back up `./data` and `./config`. `./cache` is convenience storage; safe to
wipe. The image upgrade contract — `./nmemctl upgrade <version>` — leaves
all three dirs intact.

### The three contracts that make this work — and that we will not break

1. **UID 10001 is forever.** The container runs as `uid=10001 gid=10001`.
   Files in `./data`, `./config`, `./cache` are owned by 10001:10001.
   `./nmemctl up` handles chown for you on first run via a one-shot helper
   container — you never type `chown` or `sudo`. Every future release of
   this image will keep the same UID; if a new image ever fails with
   permission errors on your existing data, that is a regression — file an
   issue.
2. **The three in-container mount paths are part of the public API.**
   `/var/lib/nowledge-mem`, `/etc/nowledge-mem`, `/var/cache/nowledge-mem`
   will not move; nor will the `XDG_*` env vars inside the image. You can
   bind these to wherever you want on the host (the default is the three
   sibling dirs).
3. **Your device identity lives in `./config/co.nowledge.mem.desktop/machine_id`.**
   A UUID seed (auto-generated on first start) is what the license backend
   sees as your device. So:
   - `./nmemctl down && ./nmemctl up` → same device, license stays activated.
   - `./nmemctl upgrade <version>` → same device, license stays activated.
   - `./nmemctl wipe` → device gone, equivalent to a fresh install.
   - `./nmemctl export` (and `import` on another host) → `machine_id` is
     deliberately excluded; destination gets a fresh device identity.
     License re-activates on first launch (consumes one seat).
   - `rsync ./data ./config ./cache another-host:./` → device follows the
     copy; old and new will collide on license. Retire one.
   - Fleet operators: override with `NOWLEDGE_DEVICE_FINGERPRINT=<value>`
     env for centralized identity (e.g. derived from a secret manager).

### SELinux operators (RHEL / Fedora / Rocky)

Append `:Z` to each bind in `compose.yaml` so SELinux relabels the host
directories for container access:

```yaml
volumes:
  - ./data:/var/lib/nowledge-mem:Z
  - ./config:/etc/nowledge-mem:Z
  - ./cache:/var/cache/nowledge-mem:Z
```

This is opt-in because `:Z` is destructive on first apply (recursive
relabel) and a no-op (or worse, an error) on systems without SELinux. Set
it once if you see "permission denied" inside the container despite
ownership being correct.

### Air-gapped / pre-baked models

If your deployment has no internet access, pre-populate `./cache` once on
a connected machine, then move:

```bash
# On a connected machine:
./nmemctl up
# Trigger a search so embedding weights download into ./cache:
docker compose exec -T mem curl -s -H "Authorization: Bearer $(./nmemctl key)" \
  "http://127.0.0.1:14242/memories/search?q=warmup&limit=1" >/dev/null
./nmemctl down

# Move ./cache to the air-gapped machine — standard tooling:
rsync -av ./cache/ air-gapped-host:~/community/docker/cache/

# On the air-gapped machine:
./nmemctl up
```

The cache layout is identical across hosts of the same arch; there's nothing
machine-specific in there.

---

## Quick start (one command)

```bash
./nmemctl up
```

That brings the stack up, waits for `/livez`, prints the Access Anywhere API
key, shows your license tier, and tells you the URL to open.

If you have a license code:

```bash
./nmemctl license activate <BASE64-LICENSE-CODE>
```

`nmemctl` is the lifecycle controller for this deploy. Run `./nmemctl help`
for the full command set (up / down / restart / status / logs / version /
key / license / upgrade / wipe).

The default `compose.yaml` exposes the server on `0.0.0.0:14242`. To put TLS
in front, overlay `compose.tls.yaml` and Caddy will obtain a Let's Encrypt
certificate for you.

### Or do it by hand

```bash
docker compose up -d
docker compose logs -f mem                                    # wait for "Application startup complete"
docker compose exec -T mem nmem key                           # show the API key
docker compose exec -T mem nmem license status                # license tier
docker compose exec -T mem nmem license activate <CODE>       # optional

# macOS:   open http://localhost:14242/app
# Linux:   xdg-open http://localhost:14242/app
# Windows: start http://localhost:14242/app
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
- Docker Compose **v2.24.4 or newer**. The overlay uses the `!override`
  merge tag to rebind the upstream port; this tag (and the related
  `!reset`) only became reliable in 2.24.4. Earlier 2.24.x versions
  either fail to parse the file or silently drop the rebind.

The mem container is rebound to `127.0.0.1` so the only reachable surface is
Caddy.

---

## Authentication — the full picture

The server enforces two independent things:

- **A license** (`license.json`) — paid Pro tier vs Free. Free is capped at
  20 memories; activate a license to lift the cap. License is a file, not a
  network call, and persists in `./config/`.
- **An API key** (`remote-access.json`) — bearer-token auth on every non-public
  endpoint. The web UI uses the same key.

### Where is my API key? (read this first)

The image generates an API key on first start. Four ways to retrieve or
rotate it — pick whichever fits how you got here:

```bash
# 1. You ran ./nmemctl up and missed the output — re-print everything:
./nmemctl status                          # key, license, URL, health

# 2. You just want the key by itself:
./nmemctl key                             # prints the current key

# 3. You want to skim the first-run banner from logs:
./nmemctl logs | grep -A 1 "API Key"

# 4. Rotate the key (the old one stops working immediately):
./nmemctl key --rotate
```

The key is stored at `./config/co.nowledge.mem.desktop/remote-access.json`
on the host (`/etc/nowledge-mem/co.nowledge.mem.desktop/remote-access.json`
inside the container); it survives `docker compose pull && up -d` upgrades.
**Backing up `./config` backs up the key.**

If you rotate the key, every existing client (web UI, MCP clients, the
`nmem` CLI on remote machines) needs the new value pasted in.

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

```text
./config/co.nowledge.mem.desktop/remote-access.json   (on the host)
/etc/nowledge-mem/co.nowledge.mem.desktop/remote-access.json   (inside the container)
                  ^                       ^
                  app namespace           mode 0600, owner 10001:10001
```

This file is generated on first start. Backing up `./config` backs up the key.

### Common operations

```bash
# Show the current key
./nmemctl key                             # or: docker compose exec -T mem nmem key

# Rotate (invalidates the old value immediately; re-paste in clients)
./nmemctl key --rotate                    # or: docker compose exec -T mem nmem key --rotate

# Pre-seed a known key (useful for fleets managed by a secret manager).
# Write the file before first `./nmemctl up`:
mkdir -p ./config/co.nowledge.mem.desktop
cat > ./config/co.nowledge.mem.desktop/remote-access.json <<EOF
{"api_key":"<your-key>","require_auth_loopback":false,"created_at":"$(date -Iseconds)"}
EOF
chmod 0600 ./config/co.nowledge.mem.desktop/remote-access.json
# `./nmemctl up` will chown ./config to 10001:10001 on first run.
```

### Rate-limit recovery

After **8 invalid-auth attempts within a 5-minute window** from the same
client IP, the server blocks that IP for **10 minutes**. If you locked
yourself out during testing:

```bash
docker compose restart mem        # clears the in-memory rate-limit window
```

The block is per-client-IP, not per-key — rotating the key won't unblock you.

### If a key leaks

1. `./nmemctl key --rotate` — issue a new value.
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
cosign verify docker.io/nowledgelabs/mem:0.8.4 \
  --certificate-identity-regexp='https://github.com/nowledge-co/mem/.github/workflows/release-docker.yml@.*' \
  --certificate-oidc-issuer='https://token.actions.githubusercontent.com'
```

A passing run prints the certificate chain that bound the signature to the
release-docker workflow at a specific commit. A failing run means the image
you pulled was not produced by our pipeline.

`cosign` install: <https://docs.sigstore.dev/cosign/installation/>.

---

## Architecture support

The image ships a multi-arch manifest for **`linux/amd64`** and
**`linux/arm64`**. Docker pulls the matching variant automatically.

- **`amd64` — primary supported target.** Every release runs the full
  ingest/agent/search loop on amd64 before tagging.
- **`arm64` — experimental.** The build succeeds and all native
  dependency wheels (Kuzu/ladybug, ONNX, tokenizers, BGE-m3) exist for
  arm64, but we don't yet routinely exercise full agent flows on this
  arch. Expected hosts: Ampere/Graviton VPS, Apple Silicon under
  Docker Desktop, Raspberry Pi 5 with 8 GiB RAM. If you hit
  arch-specific behaviour, please file an issue with `arch: arm64`
  in the body so we can fold it into the supported set.

If you need a specific arch, pin it explicitly:

```bash
docker pull --platform linux/amd64 docker.io/nowledgelabs/mem:0.8.4
```

---

## Day-2 operations

### Backup and migration

Two layers, pick the one that matches your move:

**Volume-level snapshot** — exact same image version on both ends. Fastest
restore; carries everything bit-for-bit except the device identity.

```bash
./nmemctl export                              # stop, tar ./data ./config ./cache, restart
./nmemctl export --no-cache --out ~/backup.tar.gz   # skip cache for smaller archive
./nmemctl import ~/backup.tar.gz              # restore on a new host
./nmemctl import ~/backup.tar.gz --force      # overwrite an existing deploy
```

`export` stops the container (Kuzu must be at rest to snapshot cleanly),
tars the three bind-mount directories into a single `.tar.gz` with a
manifest, and restarts. Default filename is
`mem-export-<host>-<timestamp>.tar.gz` in the current directory.

**Application-level dump** — cross-version moves, or migrating from a
desktop / `.deb` install into Docker. Uses the same portable JSONL format
the desktop app uses for "Export to file":

```bash
./nmemctl backup-app                          # produces mem-app-export-<host>-<ts>.zip
./nmemctl backup-app --out ~/mem-app.zip      # explicit destination
./nmemctl restore-app ~/mem-app.zip           # imports memories into the running container
```

`backup-app` runs `nmem export` inside the container and stages the zip
out via `./cache` (no `docker cp` involved). `restore-app` stages a zip
in via `./cache` and runs `nmem import` inside. Both leave the container
running.

**What carries across, what doesn't (volume-level export):**

| Thing | Carries? | Notes |
|---|---|---|
| Graph DB (memories, threads, sources) | yes | Same image version on both ends. |
| Search index | yes | |
| License activation | yes | But the app may prompt for re-activation on first launch (uses one seat). |
| API key | yes | Clients keep working at the new host without re-auth. |
| Agent state (feed, scheduler) | yes | |
| Cached embeddings | yes by default | `--no-cache` to skip; first launch re-downloads. |
| `machine_id` (device identity) | **no — by design** | Destination gets a fresh ID. |

Volume-level export requires **the same image version** on both ends, or
destination strictly newer (migrations run forward on first boot; the
backend refuses to open a DB written by a newer version). For cross-version
moves, or moving from a `.deb`/desktop install into Docker, use
`backup-app` / `restore-app` instead — they carry memories/threads/sources/
artifacts/labels in a portable format that's version-independent within
supported migration ranges.

After a successful migration, retire the source server. Running both
side-by-side diverges state and double-bills your license seats.

**Standard backup tools work too.** Because the data lives in plain host
directories, `rsync`, `restic`, `borg`, ZFS/Btrfs snapshots, and `tar`
all work directly. Stop the container first (`./nmemctl down`) for a
guaranteed-consistent snapshot, then `./nmemctl up` afterward.

### Upgrade

Two independent things you might want to upgrade:

```bash
./nmemctl upgrade 0.8.5                   # the docker image: pull, bump .env, recreate
./nmemctl self-update                     # the controller + compose stack files themselves
./nmemctl self-update --check             # see what would change without applying
```

`upgrade` and `self-update` are deliberately separate. `upgrade` is a runtime
decision (move to a new server version, may run DB migrations). `self-update`
is purely about the operator tooling sitting next to the container — the
controller script, compose files, Caddyfile. You can do them in any order.

`self-update` auto-detects a git checkout and defers to `git pull` when
`community/` is a git repo. On a curl-pulled standalone install it fetches
files from `raw.githubusercontent.com/nowledge-co/community/main/docker/`,
diffs them against local, and prompts before overwriting anything. Backups
are left as `<file>.bak.<timestamp>`.

`upgrade` refuses pre-release tags (`0.8.5-rc1`, etc.) by default — set
`NMEM_ALLOW_PRERELEASE=1` to override when you're testing a release candidate.

`upgrade` writes the target tag to `.env` (`NMEM_IMAGE_TAG=X.Y.Z`, mode 0600).
`compose.yaml` reads that env var as `${NMEM_IMAGE_TAG:-X.Y.Z}` so future
`up`/`restart` invocations stay on the new version without touching
`compose.yaml`. The fallback default in `compose.yaml` is the release tag at
the time you cloned; `self-update` may bump it but `.env` always wins.

The backend runs schema migrations on startup. There is **no downgrade path**;
once a newer image has opened the database, an older image will refuse to.
Skipping versions (0.8.4 → 0.8.6 without 0.8.5) **is supported** — schema
migrations run forward in order on the new image's first boot.

### Click-to-update from the web UI (optional)

If you'd rather not SSH every time a new release lands, opt in to the
auto-update sidecar:

```bash
./nmemctl auto-update enable
```

That generates a per-deploy random token (mode 0600 in `.env`), adds the
`compose.updater.yaml` overlay to the persisted stack, and brings the stack
back up with a small `nowledgelabs/mem-updater` sidecar attached. From then
on, the Settings → Server card in the web UI surfaces "Update available"
when a newer image lands on Docker Hub, with a Download button (background
pull, no downtime) and an Install button (≈30 s downtime, takes a pre-stop
snapshot to `./cache/_pre-upgrade-<ts>.tar.gz`).

```bash
./nmemctl auto-update status              # current state, last pull, retained snapshots
./nmemctl auto-update rotate              # rotate the updater token
./nmemctl auto-update upgrade             # bump the updater image itself
./nmemctl auto-update disable             # remove the sidecar; keep snapshots
```

**Trust model worth reading before you enable.** The sidecar mounts
`/var/run/docker.sock` — that's why it's opt-in. Docker socket access
is host-root-equivalent for that container. The sidecar is **not exposed
beyond the compose-internal network**, runs a small shell HTTP handler
whose code you can read at `community/docker/updater/`
(`server.sh` ~ 400 lines incl. comments, plus a ~50-line scheduler and
entrypoint), and only accepts requests bearing the per-deploy token.
The mem container itself does **not** mount docker.sock; only the
sidecar does.

Pair this with the new `/admin/upgrade/*` endpoints on the Mem backend:

| Endpoint | Behavior |
|---|---|
| `GET /admin/upgrade/check` | Aggregated state (current/latest/pulled/sidecar-reachable). UI polls every 120 min. |
| `POST /admin/upgrade/download` | Pre-pull a target tag (background, idempotent). |
| `POST /admin/upgrade/install` | Type-to-confirm, snapshot, recreate, wait for `/livez`. |

**Origin guard.** By default, the install endpoint accepts requests only
from the same-host UI (the `/app` served by this Mem container). If you
want to trigger upgrades from the desktop in remote mode or from
`mem.nowledge.co`, set `NOWLEDGE_ADMIN_REMOTE_OPS=1` on the server.
Trusted networks only.

**Recovery from a bad upgrade.** Every Install takes a volume-level
snapshot of `./data` and `./config` (excludes `./cache`) before the
recreate. The snapshot is a `.tar.gz` written to `./cache/` on the
host (NOT an `nmem` application export — different format from
`backup-app`). If the new image's `/livez` doesn't go green within
180s, the UI surfaces the snapshot path. SSH and restore using
`./nmemctl import` (the volume-level matching verb for the
volume-level snapshot):

```bash
# Roll back the image first (so the migration order matches):
./nmemctl upgrade 0.8.4    # whatever version you were on
# Then restore the bind-mount directories from the snapshot:
./nmemctl import ./cache/_pre-upgrade-<ts>.tar.gz --force
```

Snapshots rotate automatically: the last 3 are kept; older are deleted on
each successful Install. Override with `NOWLEDGE_SNAPSHOT_RETAIN`.

### Factory reset

```bash
./nmemctl wipe                            # type WIPE to confirm
```

Stops the container, removes the contents of `./data`, `./config`, and
`./cache` via a one-shot helper container (so you don't need `sudo` to
remove files owned by UID 10001), then brings the stack back up fresh
and prints a new API key. The ceremony is intentional — every prior
memory, thread, source, license activation, and device identity is gone
after this.

### Logs

The image emits structured JSON to stdout. The compose file already configures
rotation (`max-size: 10m`, `max-file: 5`). To follow:

```bash
./nmemctl logs -f                         # tail -f, pass-through to compose
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

If you'd rather not store the license inside `./config/`, mount it as
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
`./config` bind is mounted (`docker compose config` should list
`./config:/etc/nowledge-mem` under the `mem` service) and that the directory
exists. `./nmemctl up` creates it; if you wrote `compose.yaml` by hand, run
`mkdir -p ./config && docker run --rm -v "$PWD/config:/dst" busybox:stable chown -R 10001:10001 /dst`.

**Web UI loads but says "Web Client Not Available".** The image was built
without the SPA. This should not happen with the official image; please file a
bug. If you're building locally, ensure `npm run build:web` produced
`nowledge-graph/dist-web/`.

**MCP plugins won't install.** Plugin install needs network and may shell out
to `npx`/`uvx`. The default image trusts outbound HTTPS but does not include
those CLIs. For now, install plugins on the desktop app and copy
`./config/co.nowledge.mem.desktop/plugins.json` onto the server's `./config`
directory; first-class headless plugin install is on the roadmap.

**A file upload returned 500 and now every page in the UI fails.** The Kuzu
buffer pool exhausted. `docker compose restart mem` recovers; if it keeps
recurring, bump `mem_limit` per the table above or pin
`NOWLEDGE_KUZU_BUFFER_POOL_SIZE` explicitly. See "Memory and recovery"
above.

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
retries) and is tracked upstream; for now, sizing the container
generously per the table above is the working mitigation.
