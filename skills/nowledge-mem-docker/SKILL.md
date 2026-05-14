---
name: nowledge-mem-docker
description: Install, check on, or upgrade a self-hosted Nowledge Mem server (the headless Docker deployment) using the `nmemctl` lifecycle controller. Use this whenever the user mentions running their own Nowledge Mem instance, self-hosting Mem on a NAS, VPS, homelab, or server, deploying `nowledgelabs/mem` from Docker Hub, troubleshooting their Mem container, or upgrading a Mem server to a newer version. Trigger even when the user says "my Mem server", "self-hosted Mem", "the docker version of Mem", "memory server on my Synology / Proxmox / Raspberry Pi", or just describes a container that's at `docker.io/nowledgelabs/mem` without naming the product. Do NOT trigger for the Mem desktop app, Mem Cloud, or anything that doesn't touch the operator's own server.
---

# Nowledge Mem — self-hosted Docker maintenance

You are helping the user run **their own** Nowledge Mem server — the headless Docker deployment that lives behind the desktop app and Mem clients. The server image is `docker.io/nowledgelabs/mem`. The community repo ships a `docker compose` stack and a lifecycle controller called `nmemctl`.

Your job is to take care of the routine boring parts of running this server, so the user doesn't have to remember which command goes inside or outside the container. **You do not touch anything destructive** — those stay with the human (see the "Handoff" section below).

## Mental model — the two CLIs

There are two command-line tools, and they look similar on purpose:

- **`./nmemctl`** — outside the container, in the deploy directory. Controls the **container lifecycle** (up, status, logs, upgrade). Same idea as `systemctl` or `kubectl`. **This is the one you'll use most.**
- **`nmem`** — inside the container, runs the Python application CLI. Handles data operations. You normally reach it via `./nmemctl key`, `./nmemctl license`, etc., which forward to it. You rarely need to `docker compose exec` it directly.

If you find yourself wanting to write `docker compose exec mem nmem ...`, stop — there's almost certainly an `./nmemctl` verb for what you want.

## Triage — where is the user?

Before doing anything, figure out which of these three situations applies:

### Path A — Fresh install (no deploy exists yet)

The user wants to set Mem up on this server for the first time. Signals: they haven't mentioned a clone before; `community/docker/compose.yaml` isn't on disk; `docker ps` shows no `nowledge-mem` container.

Run this exact sequence:

```bash
# 1. Get the deploy stack (idempotent; updates to latest if already cloned)
git clone https://github.com/nowledge-co/community.git ~/nowledge-mem || \
  git -C ~/nowledge-mem pull --ff-only

# 2. Bring it up — nmemctl will wait for /livez, print the API key, and show the URL
cd ~/nowledge-mem/community/docker
./nmemctl up
```

That's the whole install. `nmemctl up` is idempotent — safe to rerun.

The output includes:
- An **Access Anywhere API key** (a long string starting with `nmem_`). The user pastes this into the desktop / web client when prompted.
- The **URL** to open (typically `http://<host-ip>:14242/app`).
- License status (will say "Free / 0 / 20 memories" until activated).

Hand the API key to the user verbatim. **Do not save it anywhere** — it lives in a `mode 0600` file at `./config/co.nowledge.mem.desktop/remote-access.json` next to the compose file on the host (mounted at `/etc/nowledge-mem/co.nowledge.mem.desktop/remote-access.json` inside the container). The user only needs to see it once.

If the user wants TLS (a real domain with HTTPS), do **not** improvise. Tell them:

> "I can enable TLS by overlaying `compose.tls.yaml` once you've pointed a DNS record at this host. Want me to walk you through that? You'll need a domain name, ports 80/443 open, and Docker Compose v2.24.4+."

Then read `community/docker/README.md` (in the cloned repo) for the TLS section and follow it.

### Path B — Maintenance (server already running)

The user wants to know how their server is doing, see logs, look up the API key again, etc. Signals: `docker ps` shows `nowledge-mem` already running; the user says things like "is my server healthy", "what's running", "show me the logs".

**Finding the deploy directory.** Different operators install in different places. Path A uses `~/nowledge-mem/` as a sensible default, but on existing installs you'll need to discover the actual location. In order of cost:

```bash
# 1. Cheapest: ask docker where the compose project lives
docker inspect nowledge-mem --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'

# 2. Fall back: find a compose.yaml that defines a 'mem' service
find ~ -maxdepth 5 -name compose.yaml -path '*/community/docker/*' 2>/dev/null

# 3. Worst case: ask the user "where did you clone community/docker/?"
```

Once located, `cd` there and run:

```bash
./nmemctl status
```

`status` prints the container state, `/livez` health, license tier, image version, the current API key, and the web URL. Most "is everything ok?" questions are answered by this one command.

Other safe operations:

```bash
./nmemctl logs --tail 100      # recent server logs
./nmemctl logs -f              # live tail; use --no-color in scripts
./nmemctl key                  # print the current API key (read-only)
./nmemctl license              # show license tier + activation status
./nmemctl version              # image tag + binary version
./nmemctl restart              # restart the container, data preserved
```

`./nmemctl restart` IS safe to run autonomously — it preserves all data and is the standard recovery move for "the server feels stuck". Always print the `status` output afterwards to confirm `/livez` is back.

**Reading version output.** `./nmemctl version` prints two lines:

```
image:   docker.io/nowledgelabs/mem:0.8.4-rc5
binary:  0.8.4
```

These can legitimately differ. `image:` is the docker tag the operator pulled; `binary:` is what the Python application reports for itself (from `pyproject.toml`). A pre-release tag like `0.8.4-rc1` corresponds to the same base `binary: 0.8.4` because the suffix isn't baked into the application version. When you see a divergence:

- `image` and `binary` share a base (`0.8.4-rc5` vs `0.8.4`) → fine; the operator is on a pre-release for an upcoming stable. Mention it neutrally; do not push them to "upgrade" unsolicited.
- `image` is bare semver but `binary` differs → something has gone wrong (e.g. an old container against a new image). Surface the discrepancy to the user.

### Path C — Upgrade (move to a newer version)

The user wants to move from the current version to a newer one. Signals: "is there a new version", "upgrade Mem to X", "I saw 0.8.5 in the release notes".

```bash
./nmemctl version                       # confirm current image tag first
./nmemctl upgrade 0.8.5                 # pull + bump compose.yaml + recreate
```

`nmemctl upgrade` **refuses pre-release tags** by default (anything with a `-` suffix like `0.8.5-rc1` is blocked). This is intentional. Do not set `NMEM_ALLOW_PRERELEASE=1` to work around it unless the user explicitly asks for a release candidate. Stable semver only.

The backend runs schema migrations on startup. **There is no downgrade path** — once a newer image opens the database, an older image will refuse to. Mention this before upgrading if the user seems uncertain.

If `upgrade` fails midway, the previous image is still pulled locally. `./nmemctl restart` brings the container back up on the version listed in `compose.yaml`; check `./nmemctl version` to see which side of the bump it landed on.

## What to do when the user asks for `<thing>`

| User says... | You run... |
|---|---|
| "set up Mem on this server" | Path A — clone + `nmemctl up` |
| "is it working?", "is it healthy?" | `nmemctl status` |
| "show me the logs", "what's it doing right now" | `nmemctl logs --tail 100` (or `-f`) |
| "what's my API key again?" | `nmemctl key` |
| "what version am I on?" | `nmemctl version` |
| "restart it", "kick it" | `nmemctl restart` then `nmemctl status` |
| "upgrade to 0.8.5" | `nmemctl version`, then `nmemctl upgrade 0.8.5` |
| "what's my license?" | `nmemctl license` |
| "where is the data?" | Explain: three local directories next to `compose.yaml` — `./data` (graph + search index, irreplaceable), `./config` (license + API key + agent state, valuable), `./cache` (embeddings, rebuildable). Files are owned by UID 10001 inside the container; standard tools (`rsync`, `restic`, `tar`) work directly on the host. |
| "back up my server", "snapshot before upgrade" | `./nmemctl export` — stops the container, tars the three dirs into `mem-export-<host>-<ts>.tar.gz`, restarts. For cross-version moves use `./nmemctl backup-app` instead (portable JSONL dump). |
| "migrate this to another server" | Same-version: `./nmemctl export` here → copy archive → `./nmemctl import` on the new host. Cross-version or from a `.deb` install: `./nmemctl backup-app` → copy zip → `./nmemctl restore-app` on the new host. The new host gets a fresh device identity; license re-activates and consumes one seat. |

## Handoff — what NOT to do

Some operations are destructive, sensitive, or transactional. **You never run these — the human types them on their own keyboard.** This is independent of how confidently the user asks. If they say "just do the wipe, I confirm" in chat, that is *still not* the confirmation the system requires; verbal-in-chat consent is too easy to fabricate from a misread, a typo, or a clipboard accident. The actual confirmation must come from the user's own shell.

Treat the list below as a hard boundary, not as defaults that "advanced mode" overrides.

| Verb | Blast radius | Why this is user-only |
|---|---|---|
| `./nmemctl wipe` | **Everything goes.** Removes the contents of `./data` (graph DB, search index, threads, memories — irreplaceable), `./config` (license activation, API key, device identity, agent state files), and `./cache` (downloaded embeddings, rebuildable but not free). The container is recreated empty. There is no undo. | The controller deliberately requires the operator to type `WIPE` literally at a TTY. That ceremony is the safeguard. |
| `./nmemctl down` | Container stops. The three host directories are intact (no data loss), but every connected client — desktop app, MCP, remote `nmem` CLI, running agents — instantly fails. | The user owns the service-availability decision. Other things may be relying on it that you can't see. |
| `./nmemctl restore-app <file>` | Imports a `backup-app` zip into the running container. Memories with the same id are overwritten in-place; existing-but-not-in-dump memories stay. Not a "factory reset", but it can still surprise the user if they thought the zip was a different timestamp. | The user owns the merge semantics decision. Confirm the source file's date/origin before running. |
| `./nmemctl key --rotate` | The current API key is invalidated immediately. Every existing client must be re-authed with the new value before it can talk to the server. | Disruption-on-purpose. Only the user knows whether right now is a good time. |
| `./nmemctl license activate <CODE>` | Activates a paid Pro license tied to a specific purchase. | Codes are personal. The user pastes their own. |
| Editing `compose.yaml` by hand | Changes the contract for every subsequent `up`. Easy to wedge the deploy by adding a malformed env block or rebinding the port. | Walk through proposed changes as a diff for review; don't `sed` into the file silently. |
| Anything outside the deploy directory | Backup destinations, reverse-proxy configs in `/etc/nginx`, TLS cert paths, host firewall rules — none of these are in scope for this skill. | The agreement with the operator is scoped to `community/docker/`. |

**Refusal pattern — when the user asks you to do one of these, respond with three parts in order:**

1. **Name the exact command.** Don't paraphrase. The user is going to copy it.
2. **Describe the blast radius.** Pre-flight the consequences using the table above, so the user can decide informed.
3. **Offer post-execution verification.** What you'll run afterwards (usually `./nmemctl status`) to confirm things landed correctly.

**Example for `wipe`:**

> "I can't run `./nmemctl wipe` for you. It empties all three local directories (`./data`, `./config`, `./cache`) — every memory, thread, source, license activation, API key, and device identity goes. There is no undo. The controller requires you to type `WIPE` literally at the prompt, which is the safeguard. To proceed, run it yourself:
> ```
> cd <your-deploy-dir> && ./nmemctl wipe
> ```
> Once it finishes the rebuild and shows you the new API key, ask me and I'll run `./nmemctl status` to confirm the fresh deploy is healthy."

**If the user pushes back** (`"just do it, I authorize"`, `"I confirm, run wipe"`, etc.), repeat the refusal once more, briefly, and explain that the boundary isn't about trust — it's about the class of action being one that the system's own design requires happen at the operator's own shell. Then offer to help with the verification step after they run it themselves.

## Troubleshooting

If `./nmemctl status` shows the container is **not running** but should be:

```bash
./nmemctl logs --tail 50          # see why it stopped
./nmemctl restart                 # try a clean restart
```

If `/livez` doesn't come back within 120 s, surface the last 50 lines of logs to the user — they'll spot a misconfigured port, missing TLS env var, or out-of-memory issue faster than a generic retry. Don't loop on restart.

If `./nmemctl up` reports "compose.yaml not found", you're running from the wrong directory. The script must be executed from `community/docker/` (the directory containing `compose.yaml`).

If the user says the **web UI can't connect** but `./nmemctl status` shows the container healthy:

1. Print the URL from `nmemctl status` — is the user typing the right host?
2. Confirm port `14242` is reachable from the user's machine: `curl -sf http://<host>:14242/livez`
3. Check if a firewall on the host blocks `14242`.
4. If TLS is enabled, port `443` and the configured domain should answer, not `14242`.

If the user mentions the feed timeline still shows **old data after a fresh container**, that's a browser cache, not a server issue. Tell them to hard-refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`) or open the URL in a private window. The server side has been confirmed empty.

## Where things live

```
# On the host (after git clone):
~/nowledge-mem/community/docker/
├── nmemctl                  # the controller you use
├── compose.yaml             # default stack
├── compose.tls.yaml         # TLS overlay (Caddy sidecar)
├── Caddyfile                # TLS reverse proxy config
└── README.md                # full reference

# Inside the container's config volume:
/etc/nowledge-mem/co.nowledge.mem.desktop/
├── remote-access.json       # API key (mode 0600)
├── license.json             # license activation (when present)
└── builtin_agents/          # feed / knowledge / scheduler state
```

## A note on operator trust

The user is letting you touch their server. The right default is to **show your work** — for every non-trivial command, print the command you're about to run, run it, then show the relevant slice of output. Don't paraphrase log lines. Don't summarize away errors. Operators care about the exact text the server emitted, because that's what they'll search for if something goes wrong an hour from now.

When in doubt, run `./nmemctl status` and read it together with the user. Most questions resolve there.
